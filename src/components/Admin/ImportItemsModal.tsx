// src/components/Admin/ImportItemsModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import { AI_TEXT_MAX, ITEM_NAME_MAX, ITEM_NOTE_MAX, ITEMS_PER_EVENT, IMPORT_FILE_BYTES, IMPORT_FILE_ROWS } from '../../constants/limits';
import FocusTrap from 'focus-trap-react';
import { X, Upload, Table, AlertCircle, CheckCircle, Trash2, List, Wand2, Mic, MicOff, Loader2, Clipboard as ClipboardIcon, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory, CategoryConfig } from '../../types';
import { PresetListsManager } from './PresetListsManager';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useTranslation, Trans } from 'react-i18next';
import { compressImage } from '../../utils/imageUtils';
import { getSmartImportErrorMessage } from '../../utils/smartImportErrors';
import { mapRows, countRowsWithData, looksMisdecoded, ImportRow } from '../../utils/importColumns';
import { ConfirmationModal } from './ConfirmationModal';

interface ImportItemsModalProps {
  event: ShishiEvent;
  onClose: () => void;
  onAddSingleItem?: () => void;
  // Called once the database has the items. The screen that opened this window
  // may be holding a list it read once and has no reason to read again, and the
  // event card on the home screen is exactly that: it went on saying no items
  // had been added yet, which is the first reason a product owner thought a
  // successful import had failed. The event form beside it in this same file
  // already gets one. See DOCS/PLANING/76-dashboard-card-does-not-refresh-after-import.md.
  onImported?: () => void;
  initialText?: string;
  autoRunAI?: boolean;
  categoriesOverride?: CategoryConfig[]; // To support new categories before they are saved to the event object
  migrationStartTime?: number; // If present, indicates "Smart Migration" mode (Atomic Update)
}

interface ImportItem {
  name: string;
  category: MenuCategory;
  quantity: number;
  notes?: string;
  isRequired: boolean;
  selected: boolean;
  error?: string;
  // On a Smart Migration only: the item this row already is in the event. A row
  // that carries one is written back under its own id, so the item keeps who
  // signed up for it. Without it the migration builds a brand new item and the
  // sign-up is gone even though the item looks identical on screen.
  existingItem?: MenuItem;
}

// What a file gave up on the way in. The screen says all of it, because the one
// number it used to give, "3 items loaded", was the whole of what the organiser
// knew about a file that had four.
interface FileReadReport {
  /** Rows that held something and nothing in the item name column. */
  skippedRows: number;
  /** Headers of columns that were read and then not used. */
  ignoredColumns: string[];
  /** Sheets after the first, which are not read. */
  extraSheets: string[];
}

interface FileReadResult {
  items: ImportItem[];
  report: FileReadReport;
}

type ImportMethod = 'file' | 'preset' | 'smart';

export function ImportItemsModal({ event, onClose, onAddSingleItem, onImported, initialText, autoRunAI, categoriesOverride, migrationStartTime }: ImportItemsModalProps) {
  const { t } = useTranslation();
  const { addMenuItem } = useStore();
  const { user: authUser } = useAuth();
  const [activeMethod, setActiveMethod] = useState<ImportMethod>(initialText ? 'smart' : 'smart');

  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);

  // What the last file gave up. It stays on screen for as long as the preview is
  // open, because a message that fades is a message the organiser missed.
  const [fileReport, setFileReport] = useState<FileReadReport | null>(null);

  // How far the write loop has got. A full event of 120 items takes about a
  // minute and a quarter, one write at a time, and it used to pass with nothing
  // on screen but a disabled button.
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [itemsToImport, setItemsToImport] = useState<{ newItems: ImportItem[], duplicateItems: ImportItem[] }>({ newItems: [], duplicateItems: [] });

  // Smart Import State
  const { isListening, transcript, start, stop, reset } = useVoiceInput();
  const [smartInputText, setSmartInputText] = useState(initialText || '');
  const [smartImage, setSmartImage] = useState<File | null>(null);
  const [smartImagePreview, setSmartImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // How the last AI run actually went. The screen used to report success
  // whatever came back, including when nothing at all had been classified.
  const [classificationSummary, setClassificationSummary] = useState<{ classified: number; total: number } | null>(null);
  // How many of the event's own items the model did not return at all on a Smart
  // Migration. They are kept, and the organiser is told so before approving.
  const [migrationKeptCount, setMigrationKeptCount] = useState(0);
  // The items this screen actually had when it built the preview. What the event
  // holds beyond these was never on screen, so the organiser cannot have decided
  // to drop it, and the write leaves it alone.
  const [migrationKnownIds, setMigrationKnownIds] = useState<string[]>([]);

  // Auto-run AI if requested
  const hasAutoRunRef = useRef(false);
  useEffect(() => {
    if (autoRunAI && initialText && !hasAutoRunRef.current) {
      hasAutoRunRef.current = true;
      handleSmartAnalyze();
    }
  }, [autoRunAI, initialText]);

  const categoryOptions = React.useMemo(() => {
    // Priority: Override > Event Categories > Default
    const sourceCategories = categoriesOverride || event.details.categories;

    const cats = sourceCategories && sourceCategories.length > 0
      ? sourceCategories.sort((a, b) => a.order - b.order)
      : [
        { id: 'starter', name: t('categories.starter') },
        { id: 'main', name: t('categories.main') },
        { id: 'dessert', name: t('categories.dessert') },
        { id: 'drink', name: t('categories.drink') },
        { id: 'other', name: t('categories.other') }
      ];

    return cats.map(c => ({ value: c.id, label: c.name }));
  }, [event.details.categories, categoriesOverride, t]);

  // An AI answer counts as a classification only when it names a category this
  // event actually has. Anything else means the model did not classify the item,
  // and the item then keeps whatever category it already had. The automatic run
  // used to force "other" instead, which is what wiped the categories an
  // organiser had already sorted whenever the answer did not come back clean.
  const allowedCategoryIds = React.useMemo(
    () => new Set(categoryOptions.map(opt => opt.value)),
    [categoryOptions]
  );

  // Where an item goes when there is no earlier category to keep, which is the
  // case for a brand new item in a plain Smart Import. The event's own catch-all
  // if it has one, otherwise its first category. Never a hardcoded id: templates
  // such as BBQ and Picnic have no "other" category, so the old hardcoded value
  // was not even in their list and the dropdown came up empty.
  const fallbackCategoryId = React.useMemo(() => {
    const catchAll = categoryOptions.find(opt => opt.value === 'other' || opt.value === 'general');
    return catchAll?.value || categoryOptions[0]?.value || 'other';
  }, [categoryOptions]);

  // A dropdown must never display a value it is not holding, and left alone it
  // does exactly that: React picks the first option whenever the value matches
  // none of them, so an item carrying "main" in an event that has no such
  // category showed up as "meat" and was written as "main". The organiser
  // approved a preview that was telling the truth about nothing.
  // See DOCS/PLANING/75-import-preview-shows-a-category-it-does-not-save.md.
  const isUnknownCategory = (item: ImportItem) => !allowedCategoryIds.has(item.category);

  // Only what is actually going to be written can block the import. A row nobody
  // selected, or one already held back by an error, is not about to reach the
  // database and has no say.
  const unknownCategoryCount = importItems.filter(
    item => item.selected && !item.error && isUnknownCategory(item)
  ).length;

  // The way out of the block, in one click rather than one dropdown per row. It
  // moves every unrecognised item and not only the selected ones, because a row
  // the organiser selects a moment later would otherwise put the block back.
  const moveUnknownToFallback = () => {
    setImportItems(prev => prev.map(item =>
      isUnknownCategory(item) ? { ...item, category: fallbackCategoryId } : item
    ));
  };

  const fallbackCategoryLabel =
    categoryOptions.find(opt => opt.value === fallbackCategoryId)?.label || fallbackCategoryId;

  // How much room the event has left, which the preview had no idea about. The
  // ceiling was enforced one item at a time during the write, so a file of 500
  // items showed a button saying "import 500 items", put in the first 120 and
  // failed the other 380 one by one, at about half a second each, reporting only
  // the first failure. The number the server counts against is itemCount, so
  // that is the one to ask, and the items themselves only when it is missing.
  // A migration replaces the menu rather than adding to it, so it is not
  // measured against what the event already holds.
  // See DOCS/PLANING/74-no-ceiling-on-file-import.md.
  const currentItemCount = event.itemCount ?? Object.keys(event.menuItems || {}).length;
  const remainingCapacity = migrationStartTime
    ? Number.POSITIVE_INFINITY
    : Math.max(0, ITEMS_PER_EVENT - currentItemCount);

  // The items the event already holds, keyed by name. The id lives in the map key
  // rather than on the item, so it has to be carried across here.
  const existingItemsByName = React.useMemo(() => {
    const byName = new Map<string, MenuItem[]>();
    if (!event.menuItems) return byName;
    Object.entries(event.menuItems).forEach(([id, item]) => {
      const key = item.name.trim().toLowerCase();
      const full = { ...item, id, eventId: event.id } as MenuItem;
      const bucket = byName.get(key);
      if (bucket) bucket.push(full);
      else byName.set(key, [full]);
    });
    return byName;
  }, [event.menuItems, event.id]);

  // The categories the items already carry in the event, keyed by name. On a
  // Smart Migration these are exactly what the organiser stands to lose when the
  // model has no answer for an item.
  const existingCategoryByName = React.useMemo(() => {
    const byName = new Map<string, string>();
    existingItemsByName.forEach((items, key) => {
      byName.set(key, items[0].category);
    });
    return byName;
  }, [existingItemsByName]);

  // One place decides what the screen says about a classification run, so the
  // two paths cannot describe the same outcome differently. Nothing is called a
  // success on the strength of having finished.
  const announceClassification = (classified: number, total: number, toastId?: string) => {
    setClassificationSummary({ classified, total });
    const options = toastId ? { id: toastId } : {};

    if (total === 0) {
      toast.error(t('importModal.preview.noItems'), options);
      return;
    }
    if (classified === 0) {
      toast.error(t('importModal.smart.resultNone'), options);
      return;
    }
    if (classified < total) {
      toast(t('importModal.smart.resultPartial', { classified, total }), { ...options, icon: '⚠️' });
      return;
    }
    toast.success(t('importModal.smart.resultAll'), options);
  };

  // Handle active listening transcript
  useEffect(() => {
    if (transcript) {
      setSmartInputText(transcript);
    }
  }, [transcript]);

  // Handle Voice Toggle
  const toggleListening = () => {
    if (isListening) {
      stop();
    } else {
      reset();
      start();
    }
  };

  const handleSmartImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSmartImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSmartImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSmartAnalyze = async () => {
    if (!smartInputText.trim() && !smartImage) {
      toast.error('אנא הזן טקסט, הקלט רשימה, או העלה תמונה');
      return;
    }

    // The function refuses text past this length, and it is reached here without
    // anything unusual happening: a smart migration sends every item in the
    // event as one line each, and an event may now hold 120 of them. Saying so
    // before the call is the difference between a limit and a failure. The check
    // in the function stays where it is; this one only makes it speakable.
    if (smartInputText.length > AI_TEXT_MAX) {
      toast.error(t('importModal.smart.tooLong', { length: smartInputText.length, max: AI_TEXT_MAX }));
      return;
    }

    setIsAnalyzing(true);
    setClassificationSummary(null);
    setFileReport(null);
    setMigrationKeptCount(0);
    setMigrationKnownIds([]);

    try {
      let imageBase64 = null;
      if (smartImage) {
        // Compress image before sending (Client-side optimization)
        imageBase64 = await compressImage(smartImage);
      }

      // Build allowed categories list for AI
      const allowedCats = categoryOptions.map(opt => ({ id: opt.value, name: opt.label }));

      const parseShoppingList = httpsCallable(functions, 'parseShoppingList');
      const result = await parseShoppingList({
        text: smartInputText,
        image: imageBase64,
        mimeType: smartImage?.type,
        allowedCategories: allowedCats
      });
      const data = result.data as { items: { name: string; quantity: number, category?: string }[] };

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('התקבל מבנה נתונים לא תקין מהשרת');
      }

      let classifiedCount = 0;

      // On a Smart Migration the event's own items are the subject of the run, and
      // the answer is only allowed to move them between categories. Each returned
      // row claims the item it matches by name, so that item is written back under
      // its own id, with the people who signed up for it. Whatever the model failed
      // to return is claimed by nobody and is added back below instead of dropped.
      const unclaimed = new Map<string, MenuItem[]>();
      const knownIds: string[] = [];
      if (migrationStartTime) {
        existingItemsByName.forEach((existing, key) => {
          unclaimed.set(key, [...existing]);
          existing.forEach(one => knownIds.push(one.id));
        });
      }
      const claimExisting = (name: string): MenuItem | undefined => {
        const bucket = unclaimed.get(name.trim().toLowerCase());
        return bucket && bucket.length > 0 ? bucket.shift() : undefined;
      };

      const items: ImportItem[] = data.items.map(item => {
        // Validate returned category
        const isValidCategory = !!item.category && allowedCategoryIds.has(item.category);
        if (isValidCategory) classifiedCount++;
        // Not classified: keep the category the item already has in the event, and
        // use the fallback only for an item that has no earlier category at all.
        const previousCategory = existingCategoryByName.get(item.name.trim().toLowerCase());
        const keptCategory = previousCategory && allowedCategoryIds.has(previousCategory)
          ? previousCategory
          : fallbackCategoryId;
        const existing = claimExisting(item.name);
        return {
          // A migration changes categories, so everything except the category comes
          // from the item as the organiser left it. The model's own reading of the
          // name and the quantity is used only for an item that is genuinely new.
          name: existing ? existing.name : item.name,
          category: (isValidCategory ? item.category : keptCategory) as MenuCategory,
          quantity: existing ? existing.quantity : item.quantity,
          notes: existing?.notes,
          isRequired: existing ? !!existing.isRequired : false,
          selected: true,
          existingItem: existing
        };
      });

      // Items the model never returned. Until now they vanished from the event the
      // moment the organiser approved the preview, and took the sign-ups with them.
      const keptItems: ImportItem[] = [];
      unclaimed.forEach(bucket => {
        bucket.forEach(existing => {
          keptItems.push({
            name: existing.name,
            category: (allowedCategoryIds.has(existing.category) ? existing.category : fallbackCategoryId) as MenuCategory,
            quantity: existing.quantity,
            notes: existing.notes,
            isRequired: !!existing.isRequired,
            selected: true,
            existingItem: existing
          });
        });
      });

      const previewItems = [...items, ...keptItems];
      setImportItems(previewItems);
      setMigrationKeptCount(keptItems.length);
      setMigrationKnownIds(knownIds);
      setShowPreview(true);
      announceClassification(classifiedCount, previewItems.length);

    } catch (error: any) {
      console.error("Smart Import Error:", error);
      toast.error(getSmartImportErrorMessage(error));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Accessibility: Unique IDs for ARIA labeling
  const titleId = useId();

  // Accessibility: Store reference to the element that opened the modal
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Accessibility: Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isImporting) {
        if (showDuplicateConfirm) setShowDuplicateConfirm(false);
        else onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isImporting, showDuplicateConfirm]);

  // Accessibility: Store active element on mount, restore on unmount
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Return focus when modal closes
      if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
        returnFocusRef.current.focus();
      }
    };
  }, []);



  // Both readers hand their rows to the same place, so an xlsx file and the same
  // file saved as CSV cannot be read differently. What they get back is the items
  // and an account of what was not read, which the preview then says out loud.
  const buildItemsFromRows = (rows: ImportRow[], extraSheets: string[]): FileReadResult => {
    const mapped = mapRows(rows);

    if (!mapped.ok) {
      // A file with headers and no item name among them is not read at all.
      // Falling back to position here is what turned a column of people into a
      // list of items, so the file is refused and the headers are quoted back.
      throw new Error(t('importModal.file.noNameColumn', { headers: mapped.headerCells.join(', ') }));
    }

    const items: ImportItem[] = mapped.rows.map(row => {
      const base = { name: row.name, notes: row.notes, isRequired: false };
      if (row.name.length < 2) {
        return { ...base, category: fallbackCategoryId, quantity: 1, selected: false, error: t('importModal.preview.errors.nameLength') };
      }
      if (row.quantity < 1 || row.quantity > 100) {
        return { ...base, category: fallbackCategoryId, quantity: 1, selected: false, error: t('importModal.preview.errors.quantityRange') };
      }
      return { ...base, category: fallbackCategoryId, quantity: row.quantity, selected: true };
    });

    return {
      items,
      report: {
        skippedRows: mapped.skippedRows,
        ignoredColumns: mapped.mapping.ignoredColumns,
        extraSheets
      }
    };
  };

  const parseExcelFile = (file: File): Promise<FileReadResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        let rows: ImportRow[];
        let extraSheets: string[];
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as ImportRow[];
          // Only the first sheet is read, and until now nobody was told which one
          // that was or that there had been others.
          extraSheets = workbook.SheetNames.slice(1);
        } catch { reject(new Error(t('importModal.file.parseError'))); return; }

        if (countRowsWithData(rows) > IMPORT_FILE_ROWS) {
          reject(new Error(t('importModal.file.tooManyRows', { max: IMPORT_FILE_ROWS })));
          return;
        }

        try { resolve(buildItemsFromRows(rows, extraSheets)); }
        catch (error) { reject(error instanceof Error ? error : new Error(t('importModal.file.parseError'))); }
      };
      reader.onerror = () => reject(new Error(t('importModal.file.parseError')));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseCSVFile = (file: File): Promise<FileReadResult> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          const rows = results.data as ImportRow[];

          // Excel in a Hebrew locale writes plain CSV in an older encoding, and
          // only "CSV UTF-8" arrives readable. The unreadable one used to be
          // imported as rubbish item names without a word.
          if (looksMisdecoded(rows.flat().join(''))) {
            reject(new Error(t('importModal.file.badEncoding')));
            return;
          }

          if (countRowsWithData(rows) > IMPORT_FILE_ROWS) {
            reject(new Error(t('importModal.file.tooManyRows', { max: IMPORT_FILE_ROWS })));
            return;
          }

          try { resolve(buildItemsFromRows(rows, [])); }
          catch (error) { reject(error instanceof Error ? error : new Error(t('importModal.file.parseError'))); }
        },
        error: () => reject(new Error(t('importModal.file.parseError'))),
        encoding: 'UTF-8'
      });
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Before the read and not after it. The whole file goes into memory in one
    // go, and nothing downstream can undo that.
    if (file.size > IMPORT_FILE_BYTES) {
      toast.error(t('importModal.file.tooLarge', { max: Math.round(IMPORT_FILE_BYTES / (1024 * 1024)) }));
      e.target.value = '';
      return;
    }

    try {
      let result: FileReadResult;
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) { result = await parseExcelFile(file); }
      else if (file.name.endsWith('.csv')) { result = await parseCSVFile(file); }
      else { toast.error(t('importModal.file.unsupportedType')); return; }
      const { items, report } = result;
      setImportItems(items);
      setFileReport(report);
      setClassificationSummary(null);
      setMigrationKeptCount(0);
      setMigrationKnownIds([]);
      setShowPreview(true);
      if (items.length === 0) { toast.error(t('importModal.preview.noItems')); } else { toast.success(t('importModal.preset.loadedSuccess', { count: items.length })); }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error(error instanceof Error ? error.message : t('importModal.file.parseError'));
    }
    e.target.value = '';
  };



  const handlePresetListSelect = (presetItems: { name: string; category: MenuCategory; quantity: number; notes?: string; isRequired: boolean; }[]) => {
    const items: ImportItem[] = presetItems.map(item => ({ name: item.name, category: item.category, quantity: item.quantity, notes: item.notes, isRequired: item.isRequired, selected: true }));
    setImportItems(items);
    setClassificationSummary(null);
    setFileReport(null);
    setMigrationKeptCount(0);
    setMigrationKnownIds([]);
    setShowPreview(true);
    setShowPresetManager(false);
    toast.success(t('importModal.preset.loadedSuccess', { count: items.length }));
  };

  const updateItem = (index: number, field: keyof ImportItem, value: string | number | boolean | undefined) => {
    setImportItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeItem = (index: number) => { setImportItems(prev => prev.filter((_, i) => i !== index)); };

  const toggleSelectAll = () => {
    const validItems = importItems.filter(item => !item.error);
    const allSelected = validItems.every(item => item.selected);
    setImportItems(prev => prev.map(item => item.error ? item : { ...item, selected: !allSelected }));
  };

  const executeImport = async (itemsToProcess: ImportItem[]) => {
    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    // ATOMIC MIGRATION MODE
    if (migrationStartTime) {
      try {
        const itemsForDb: (Omit<MenuItem, 'id'> & { id?: string })[] = itemsToProcess.map(item => {
          const edited = {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            notes: item.notes || '',
            isRequired: item.isRequired
          };

          // An item the event already holds goes back under its own id, carrying
          // everything the organiser never asked to change: who created it, when,
          // and who signed up to bring it. Only what the preview shows is edited.
          if (item.existingItem) {
            return {
              ...item.existingItem,
              ...edited,
              eventId: event.id,
              // An item old enough to have no flag at all falls back to the same
              // rule every other path uses, rather than to "not splittable".
              isSplittable: item.existingItem.isSplittable ?? item.quantity > 1
            };
          }

          return {
            ...edited,
            eventId: event.id,
            creatorId: authUser?.uid || 'admin',
            creatorName: authUser?.displayName || 'Admin',
            createdAt: Date.now(),
            isSplittable: item.quantity > 1
          };
        });

        const { concurrentItemCount } = await FirebaseService.replaceAllMenuItems(
          event.id,
          itemsForDb,
          authUser?.uid || 'admin',
          migrationStartTime,
          migrationKnownIds,
          { allowedIds: Array.from(allowedCategoryIds), fallbackId: fallbackCategoryId }
        );

        // The screen used to announce, on every migration, that items added
        // alongside it were saved in a category named "general". Usually nothing
        // was added at all, and no event has a category by that name.
        toast.success(concurrentItemCount > 0
          ? t('importModal.migration.doneWithConcurrent', { count: concurrentItemCount })
          : t('importModal.migration.done'));
        onImported?.();
        onClose();
        return;
      } catch (error: any) {
        console.error("Migration Failed:", error);
        toast.error("שגיאה בביצוע המיגרציה.");
        setIsImporting(false);
        return;
      }
    }

    // STANDARD IMPORT MODE (Loop)
    const newItemsForStore: MenuItem[] = [];
    // What the loop is not going to attempt, so it can be said afterwards rather
    // than discovered. One item refused because the event is full is the sign
    // that every item behind it will be refused too, and at around half a second
    // each that is nine minutes of failure on a file of a thousand.
    let notAttempted = 0;
    try {
      for (const item of itemsToProcess) {
        if (successCount >= remainingCapacity) {
          notAttempted = itemsToProcess.length - successCount - errorCount;
          break;
        }
        setImportProgress({ done: successCount + errorCount, total: itemsToProcess.length });
        try {
          const menuItemData: Omit<MenuItem, 'id'> = {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            notes: item.notes || '',
            isRequired: item.isRequired,
            createdAt: Date.now(),
            creatorId: authUser?.uid || 'admin',
            creatorName: authUser?.displayName || 'Admin',
            eventId: event.id,
            isSplittable: item.quantity > 1, // Auto-set splittable if quantity > 1
          };
          const itemId = await FirebaseService.addMenuItem(event.id, menuItemData);
          if (itemId) {
            newItemsForStore.push({ ...menuItemData, id: itemId });
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error: any) {
          console.error(`Error importing item ${item.name}:`, error);
          errorCount++;
          // Show specific error for the first failure to give context
          if (errorCount === 1) {
            toast.error(`${item.name}: ${error.message || t('dashboard.general')}`);
          }
        }
      }

      if (newItemsForStore.length > 0) {
        newItemsForStore.forEach(item => addMenuItem(item));
      }

      if (successCount > 0) toast.success(t('importModal.preset.loadedSuccess', { count: successCount }));
      if (errorCount > 0) toast.error(t('importModal.preview.summary.errors', { count: errorCount }));
      if (notAttempted > 0) toast.error(t('importModal.preview.stoppedAtCeiling', { count: notAttempted, limit: ITEMS_PER_EVENT }));
      // Anything written at all is a reason to refresh, including a run that
      // stopped part way: what did get in is what the card is now wrong about.
      if (successCount > 0) { onImported?.(); onClose(); }
    } catch (error) {
      console.error('Error during import:', error);
      toast.error(t('dashboard.general')); // Optimized
    } finally {
      setIsImporting(false);
      setImportProgress(null);
      setShowDuplicateConfirm(false);
    }
  };

  const handleImport = async () => {
    // If in migration mode (Atomic update), skip duplicate checks as we are replacing everything
    if (migrationStartTime) {
      const selectedItems = importItems.filter(item => item.selected && !item.error);
      if (selectedItems.length === 0) {
        toast.error(t('importModal.preview.noItems'));
        return;
      }
      await executeImport(selectedItems);
      return;
    }

    const selectedItems = importItems.filter(item => item.selected && !item.error);
    if (selectedItems.length === 0) {
      toast.error(t('importModal.preview.noItems'));
      return;
    }

    // The button is already disabled while this is true. The check stands here
    // as well because the button is a courtesy and this is the door.
    if (unknownCategoryCount > 0) {
      toast.error(t('importModal.preview.unknownCategoryWarning', { count: unknownCategoryCount }));
      return;
    }

    if (overCapacity) {
      toast.error(t('importModal.preview.overCapacity', { selected: selectedItemsCount, remaining: remainingCapacity, limit: ITEMS_PER_EVENT }));
      return;
    }

    // *** Fix: Using event.menuItems instead of menuItems from Store ***
    const eventMenuItems = event.menuItems ? Object.values(event.menuItems) : [];
    const existingNames = new Set(eventMenuItems.map(mi => mi.name.trim().toLowerCase()));

    const duplicateItems = selectedItems.filter(item => existingNames.has(item.name.trim().toLowerCase()));
    const newItems = selectedItems.filter(item => !existingNames.has(item.name.trim().toLowerCase()));

    if (duplicateItems.length > 0) {
      setItemsToImport({ newItems, duplicateItems });
      setShowDuplicateConfirm(true);
      toast.success(t('importModal.duplicates.desc', { duplicates: duplicateItems.length, new: newItems.length }).replace(/<[^>]*>/g, ''));
    } else {
      await executeImport(newItems);
    }
  };

  const validItemsCount = importItems.filter(item => !item.error).length;
  const selectedItemsCount = importItems.filter(item => item.selected && !item.error).length;
  const overCapacity = selectedItemsCount > remainingCapacity;

  const handleSmartClassify = async () => {
    if (importItems.length === 0) return;

    // 1. Convert items to text list. Built before anything is set spinning,
    // because its length decides whether there is a run at all: this is one
    // string holding every item name in the event, and a full event of 120
    // items goes past what the function accepts long before it looks unusual.
    const listText = importItems.map(i => i.name).join(', ');
    if (listText.length > AI_TEXT_MAX) {
      toast.error(t('importModal.smart.tooLong', { length: listText.length, max: AI_TEXT_MAX }));
      return;
    }

    setIsAnalyzing(true);
    setClassificationSummary(null);
    const toastId = toast.loading(t('importModal.smart.analyzing'));

    try {
      // 2. Build allowed categories
      const allowedCats = categoryOptions.map(opt => ({ id: opt.value, name: opt.label }));

      // 3. Call AI
      const parseShoppingList = httpsCallable(functions, 'parseShoppingList');
      const result = await parseShoppingList({
        text: listText,
        allowedCategories: allowedCats
      });
      const data = result.data as { items: { name: string; quantity: number, category?: string }[] };

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('AI Response Invalid');
      }

      // 4. Map results back to existing items
      // We create a map of Name -> Category for O(1) lookup
      const classificationMap = new Map(data.items.map(i => [i.name.trim().toLowerCase(), i.category]));

      let classifiedCount = 0;
      const updatedItems = importItems.map(item => {
        const aiCategory = classificationMap.get(item.name.trim().toLowerCase());
        // The same acceptance test the automatic run applies, so the two paths can
        // no longer disagree about what an unrecognised answer means.
        const isValidCategory = !!aiCategory && allowedCategoryIds.has(aiCategory);
        if (isValidCategory) classifiedCount++;

        return {
          ...item,
          category: (isValidCategory ? aiCategory : item.category) as MenuCategory // Only update if AI found a valid category
        };
      });

      setImportItems(updatedItems);
      announceClassification(classifiedCount, updatedItems.length, toastId);

    } catch (error) {
      console.error("Smart Classify Error:", error);
      // The same sentence the other call point would give for the same failure.
      // This one used to answer every failure with "classification failed",
      // which said nothing about a limit, a length or a quota.
      toast.error(getSmartImportErrorMessage(error), { id: toastId });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (showDuplicateConfirm) {
    return (
      <ConfirmationModal
        title={t('importModal.duplicates.title')}
        message={t('importModal.duplicates.desc', { duplicates: itemsToImport.duplicateItems.length, new: itemsToImport.newItems.length }).replace(/<[^>]*>/g, '')}
        onClose={() => setShowDuplicateConfirm(false)}
        options={[
          {
            label: isImporting ? t('importModal.preview.importingBtn') : t('importModal.duplicates.importAll', { count: itemsToImport.newItems.length + itemsToImport.duplicateItems.length }),
            onClick: () => executeImport([...itemsToImport.newItems, ...itemsToImport.duplicateItems]),
            className: 'bg-blue-500 text-white hover:bg-blue-600'
          },
          {
            label: isImporting ? t('importModal.preview.importingBtn') : t('importModal.duplicates.importNew', { count: itemsToImport.newItems.length }),
            onClick: () => executeImport(itemsToImport.newItems),
            className: 'bg-green-500 text-white hover:bg-green-600'
          },
          {
            label: t('importModal.duplicates.cancel'),
            onClick: () => setShowDuplicateConfirm(false),
            className: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }
        ]}
      />
    );
  }

  if (showPresetManager) {
    return (<PresetListsManager onClose={() => setShowPresetManager(false)} onSelectList={handlePresetListSelect} />);
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="presentation"
    >
      <FocusTrap>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-green-100 rounded-lg p-2"><Upload className="h-5 w-5 text-green-600" aria-hidden="true" /></div>
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-gray-900">{t('importModal.title')}</h2>
                <p className="text-sm text-gray-600">{event.details.title}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isImporting}
              type="button"
              aria-label={t('common.close')}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="p-6">
            {!showPreview ? (
              <>
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-900 mb-4" id="import-methods-label">{t('importModal.methods.desc')}</h3>
                  <div className="flex flex-col gap-3" role="tablist" aria-labelledby="import-methods-label">
                    {/* Smart Import Button - Preferred Option */}
                    <button
                      role="tab"
                      aria-selected={activeMethod === 'smart'}
                      aria-controls="method-panel-smart"
                      id="method-tab-smart"
                      onClick={() => setActiveMethod('smart')}
                      className={`relative flex items-center p-4 rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-right ${activeMethod === 'smart' ? 'bg-indigo-50 border-indigo-500 shadow-md' : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'}`}
                    >
                      <div className={`p-3 rounded-full ml-4 shrink-0 ${activeMethod === 'smart' ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                        <Wand2 className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold text-lg ${activeMethod === 'smart' ? 'text-indigo-900' : 'text-gray-900'}`}>
                            {t('importModal.smart.title')}
                          </span>
                          {activeMethod !== 'smart' && <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">מנוע AI</span>}
                        </div>
                        <p className={`text-sm ${activeMethod === 'smart' ? 'text-indigo-700' : 'text-gray-500'}`}>
                          {t('importModal.smart.subtitle')}
                        </p>
                      </div>
                    </button>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <button
                        role="tab"
                        aria-selected={activeMethod === 'preset'}
                        aria-controls="method-panel-preset"
                        id="method-tab-preset"
                        onClick={() => setActiveMethod('preset')}
                        className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 h-full ${activeMethod === 'preset' ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                        <List className="h-5 w-5 md:h-5 md:w-5" aria-hidden="true" />
                        <span className="text-xs md:text-sm text-center">{t('importModal.methods.preset')}</span>
                      </button>

                      <button
                        role="tab"
                        aria-selected={activeMethod === 'file'}
                        aria-controls="method-panel-file"
                        id="method-tab-file"
                        onClick={() => setActiveMethod('file')}
                        className={`flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 h-full ${activeMethod === 'file' ? 'bg-green-50 border-green-200 text-green-700 font-medium' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      >
                        <Table className="h-5 w-5 md:h-5 md:w-5" aria-hidden="true" />
                        <span className="text-xs md:text-sm text-center line-clamp-1">{t('importModal.methods.file').split(' ')[0]} {t('importModal.methods.file').split(' ')[1]}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onAddSingleItem?.()}
                        className="flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 h-full"
                      >
                        <Plus className="h-5 w-5 md:h-5 md:w-5" aria-hidden="true" />
                        <span className="text-xs md:text-sm text-center">{t('bulkEdit.addSingleItem')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {activeMethod === 'preset' && (
                  <div role="tabpanel" id="method-panel-preset" aria-labelledby="method-tab-preset" className="mb-6">
                    <div className="text-center py-8">
                      <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                        <List className="h-8 w-8 text-green-600" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{t('importModal.preset.title')}</h3>
                      <p className="text-gray-500 mb-4">{t('importModal.preset.desc')}</p>
                      <button onClick={() => setShowPresetManager(true)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                        {t('importModal.preset.openBtn')}
                      </button>
                    </div>
                  </div>
                )}

                {activeMethod === 'file' && (
                  <div role="tabpanel" id="method-panel-file" aria-labelledby="method-tab-file" className="mb-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
                      <div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                        <Table className="h-8 w-8 text-green-600" aria-hidden="true" />
                      </div>
                      <label htmlFor="file-upload" className="block text-lg font-medium text-gray-900 mb-1 cursor-pointer hover:text-green-600 transition-colors">
                        {t('importModal.file.label', { type: 'Excel / CSV' })}
                      </label>
                      <p className="text-sm text-gray-500 mb-4">גרור קובץ לכאן או לחץ לבחירה</p>
                      <input
                        id="file-upload"
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label htmlFor="file-upload" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                        בחר קובץ מהמחשב
                      </label>
                      <p className="text-xs text-gray-400 mt-4 max-w-sm mx-auto">{t('importModal.file.help')}</p>
                    </div>
                  </div>
                )}

                {activeMethod === 'smart' && (
                  <div role="tabpanel" id="method-panel-smart" aria-labelledby="method-tab-smart" className="mb-6">
                    {isAnalyzing ? (
                      <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" aria-hidden="true" />
                        <p className="text-gray-600 font-medium">{t('importModal.smart.analyzing')}</p>
                      </div>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('importModal.smart.inputLabel')}</label>

                        <div className="space-y-4">
                          {/* Text / Voice Input */}
                          <div className="relative">
                            <textarea
                              value={smartInputText}
                              onChange={(e) => setSmartInputText(e.target.value)}
                              placeholder={t('importModal.smart.inputPlaceholder')}
                              rows={4}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-base"
                              dir="rtl"
                              aria-label={t('importModal.smart.inputLabel')}
                            />
                            <div className="absolute bottom-2 left-2 flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    const text = await navigator.clipboard.readText();
                                    if (text) {
                                      setSmartInputText(prev => prev + (prev ? '\n' : '') + text);
                                      toast.success(t('common.pasted') || 'הודבק מהלוח');
                                    }
                                  } catch (err) {
                                    toast.error('לא ניתן לגשת ללוח');
                                  }
                                }}
                                className="p-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-100 text-gray-600 hover:bg-gray-200"
                                aria-label="הדבק מהלוח"
                                title="הדבק מהלוח"
                              >
                                <ClipboardIcon className="h-5 w-5" aria-hidden="true" />
                              </button>
                              <button
                                onClick={toggleListening}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                aria-label={isListening ? "עצור הקלטה" : "הקלטה קולית"}
                                aria-pressed={isListening}
                                title={isListening ? "עצור הקלטה" : "התחל הקלטה"}
                              >
                                {isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
                                <span className="text-xs font-medium">{isListening ? 'מקליט...' : 'הקלטה'}</span>
                              </button>
                            </div>
                          </div>

                          {/* Image Input */}
                          <div className="flex items-center space-x-4 rtl:space-x-reverse">
                            <div className="flex-1">
                              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-all focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  <Upload className="w-8 h-8 mb-3 text-gray-400 group-hover:text-indigo-500 transition-colors" aria-hidden="true" />
                                  <p className="text-sm text-gray-500 group-hover:text-indigo-700"><span className="font-semibold">לחץ להעלאת תמונה</span></p>
                                  <p className="text-xs text-gray-400 group-hover:text-indigo-600">PNG, JPG, HEIC</p>
                                </div>
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept="image/*"
                                  onChange={handleSmartImageSelect}
                                  aria-label="העלה תמונת רשימת קניות"
                                />
                              </label>
                            </div>
                            {smartImagePreview && (
                              <div className="relative h-32 w-32 rounded-xl overflow-hidden border border-gray-200 group shadow-sm">
                                <img src={smartImagePreview} alt="תצוגה מקדימה" className="h-full w-full object-cover" />
                                <button
                                  onClick={() => { setSmartImage(null); setSmartImagePreview(null); }}
                                  className="absolute top-1 right-1 bg-white/90 p-1.5 rounded-full text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"
                                  aria-label="הסר תמונה"
                                  title="הסר תמונה"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-6 flex flex-col items-center">
                          <p className="text-xs text-gray-500 mb-3 text-center">{t('importModal.smart.autoDetect')}</p>
                          <button
                            onClick={handleSmartAnalyze}
                            disabled={(!smartInputText.trim() && !smartImage) || isAnalyzing}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl transition-all flex items-center justify-center space-x-2 rtl:space-x-reverse font-bold text-lg shadow-lg shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <Wand2 className="h-5 w-5" aria-hidden="true" />
                            <span>{t('importModal.smart.analyzeBtn')}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-md font-medium text-gray-900">{t('importModal.preview.title', { count: importItems.length })}</h3>
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <button
                        onClick={handleSmartClassify}
                        disabled={isAnalyzing}
                        className="flex items-center space-x-1 rtl:space-x-reverse text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition-colors text-sm font-medium disabled:opacity-50 mx-2"
                        title={t('importModal.smart.title')}
                      >
                        {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                        <span className="hidden sm:inline">{t('importModal.smart.classifyBtn')}</span>
                      </button>

                      <button onClick={toggleSelectAll} className="text-sm text-green-600 hover:text-green-700">{validItemsCount > 0 && importItems.filter(item => !item.error).every(item => item.selected) ? t('importModal.preview.deselectAll') : t('importModal.preview.selectAll')}</button>
                      <button onClick={() => { setShowPreview(false); setImportItems([]); setSmartInputText(''); setClassificationSummary(null); setFileReport(null); setMigrationKeptCount(0); setMigrationKnownIds([]); }} className="text-sm text-gray-600 hover:text-gray-700">{t('importModal.preview.back')}</button>
                    </div>
                  </div>
                  {migrationKeptCount > 0 && (
                    <div role="status" className="mb-4 flex items-start space-x-2 rtl:space-x-reverse rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{t('importModal.smart.migrationKept', { count: migrationKeptCount })}</span>
                    </div>
                  )}
                  {fileReport && (fileReport.skippedRows > 0 || fileReport.ignoredColumns.length > 0 || fileReport.extraSheets.length > 0) && (
                    <div role="status" className="mb-4 flex items-start space-x-2 rtl:space-x-reverse rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <div className="space-y-1">
                        {fileReport.skippedRows > 0 && (
                          <p>{t('importModal.file.report.skippedRows', { count: fileReport.skippedRows })}</p>
                        )}
                        {fileReport.ignoredColumns.length > 0 && (
                          <p>{t('importModal.file.report.ignoredColumns', { count: fileReport.ignoredColumns.length, columns: fileReport.ignoredColumns.join(', ') })}</p>
                        )}
                        {fileReport.extraSheets.length > 0 && (
                          <p>{t('importModal.file.report.extraSheets', { count: fileReport.extraSheets.length, sheets: fileReport.extraSheets.join(', ') })}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {overCapacity && (
                    <div role="status" className="mb-4 flex items-start space-x-2 rtl:space-x-reverse rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>{t('importModal.preview.overCapacity', { selected: selectedItemsCount, remaining: remainingCapacity, limit: ITEMS_PER_EVENT })}</span>
                    </div>
                  )}
                  {unknownCategoryCount > 0 && (
                    <div role="status" className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      <span className="flex items-start space-x-2 rtl:space-x-reverse flex-1">
                        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{t('importModal.preview.unknownCategoryWarning', { count: unknownCategoryCount })}</span>
                      </span>
                      <button
                        type="button"
                        onClick={moveUnknownToFallback}
                        className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                      >
                        {t('importModal.preview.unknownCategoryFix', { category: fallbackCategoryLabel })}
                      </button>
                    </div>
                  )}
                  {classificationSummary && classificationSummary.total > 0 && classificationSummary.classified < classificationSummary.total && (
                    <div role="status" className="mb-4 flex items-start space-x-2 rtl:space-x-reverse rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                      <span>
                        {classificationSummary.classified === 0
                          ? t('importModal.smart.resultNone')
                          : t('importModal.smart.resultPartial', { classified: classificationSummary.classified, total: classificationSummary.total })}
                      </span>
                    </div>
                  )}
                  {importItems.length === 0 ? (<div className="text-center py-8"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">{t('importModal.preview.noItems')}</p></div>) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Desktop View: Table */}
                      <div className="hidden md:block max-h-96 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.select')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.name')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.category')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.quantity')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.notes')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.required')}</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.actions')}</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {importItems.map((item, index) => (
                              <tr key={index} className={item.error ? 'bg-red-50' : ''}>
                                <td className="px-4 py-3"><input type="checkbox" checked={item.selected} onChange={(e) => updateItem(index, 'selected', e.target.checked)} disabled={!!item.error} className="rounded border-gray-300 text-green-600 focus:ring-green-500" /></td>
                                <td className="px-4 py-3">
                                  <input type="text" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                                  {item.error && (<p className="text-xs text-red-600 mt-1 flex items-center"><AlertCircle className="h-3 w-3 ml-1" />{item.error}</p>)}
                                </td>
                                <td className="px-4 py-3">
                                  <select value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)} className={`w-full px-2 py-1 border rounded text-sm ${isUnknownCategory(item) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-300'}`}>
                                    {isUnknownCategory(item) && (<option value={item.category}>{t('importModal.preview.unknownCategory')}</option>)}
                                    {categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                  </select>
                                </td>
                                <td className="px-4 py-3"><input type="number" min="1" max="100" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-3"><input type="text" value={item.notes || ''} onChange={(e) => updateItem(index, 'notes', e.target.value || undefined)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-3"><input type="checkbox" checked={item.isRequired} onChange={(e) => updateItem(index, 'isRequired', e.target.checked)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" /></td>
                                <td className="px-4 py-3"><button onClick={() => removeItem(index)} className="text-red-600 hover:text-red-700" title="הסר פריט"><Trash2 className="h-4 w-4" /></button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile View: Cards */}
                      <div className="md:hidden space-y-4 p-4 max-h-[60vh] overflow-y-auto">
                        {importItems.map((item, index) => (
                          <div key={index} className={`bg-white border rounded-xl p-4 shadow-sm mb-3 ${item.error ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}>
                            <div className="flex items-center justify-between mb-3 border-b pb-2">
                              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  onChange={(e) => updateItem(index, 'selected', e.target.checked)}
                                  disabled={!!item.error}
                                  className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm font-medium text-gray-500">{index + 1}</span>
                              </div>
                              <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700 p-1">
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.name')}</label>
                                <input
                                  type="text"
                                  value={item.name}
                                  maxLength={ITEM_NAME_MAX}
                                  onChange={(e) => updateItem(index, 'name', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                />
                                {item.error && (<p className="text-xs text-red-600 mt-1 flex items-center"><AlertCircle className="h-3 w-3 ml-1" />{item.error}</p>)}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.quantity')}</label>
                                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-[38px]">
                                    <button
                                      onClick={() => updateItem(index, 'quantity', Math.max(1, item.quantity - 1))}
                                      className="px-3 bg-gray-50 hover:bg-gray-100 border-l border-gray-300 text-gray-600 focus:outline-none focus:bg-gray-200 active:bg-gray-300 h-full flex items-center justify-center"
                                      type="button"
                                      aria-label="הפחת כמות"
                                    >
                                      <span className="text-lg font-bold">-</span>
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      max="100"
                                      value={item.quantity}
                                      readOnly
                                      className="w-full text-center text-sm focus:outline-none border-none bg-white h-full"
                                    />
                                    <button
                                      onClick={() => updateItem(index, 'quantity', Math.min(100, item.quantity + 1))}
                                      className="px-3 bg-gray-50 hover:bg-gray-100 border-r border-gray-300 text-gray-600 focus:outline-none focus:bg-gray-200 active:bg-gray-300 h-full flex items-center justify-center"
                                      type="button"
                                      aria-label="הגדל כמות"
                                    >
                                      <span className="text-lg font-bold">+</span>
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.category')}</label>
                                  <select
                                    value={item.category}
                                    onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)}
                                    className={`w-full px-3 py-2 border rounded-lg text-sm ${isUnknownCategory(item) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-gray-300 bg-white'}`}
                                  >
                                    {isUnknownCategory(item) && (<option value={item.category}>{t('importModal.preview.unknownCategory')}</option>)}
                                    {categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.notes')}</label>
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  maxLength={ITEM_NOTE_MAX}
                                  onChange={(e) => updateItem(index, 'notes', e.target.value || undefined)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  placeholder={t('importModal.preview.table.notes')}
                                />
                              </div>

                              <div className="flex items-center pt-2">
                                <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={item.isRequired}
                                    onChange={(e) => updateItem(index, 'isRequired', e.target.checked)}
                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                                  />
                                  <span className="text-sm text-gray-700">{t('importModal.preview.table.required')}</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {importItems.length > 0 && (<div className="bg-blue-50 rounded-lg p-4 mb-6"><div className="flex items-center space-x-3 rtl:space-x-reverse"><CheckCircle className="h-5 w-5 text-blue-600" aria-hidden="true" /><div><p className="text-sm text-blue-800"><Trans i18nKey="importModal.preview.summary.selected" values={{ selected: selectedItemsCount, valid: validItemsCount }} components={{ strong: <strong /> }} /></p>{importItems.some(item => item.error) && (<p className="text-xs text-red-600 mt-1">{t('importModal.preview.summary.errors', { count: importItems.filter(item => item.error).length })}</p>)}</div></div></div>)}
                <div className="flex space-x-3 rtl:space-x-reverse">
                  <button onClick={handleImport} disabled={selectedItemsCount === 0 || isImporting || unknownCategoryCount > 0 || overCapacity} type="button" className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isImporting ? (<> <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div> {importProgress ? t('importModal.preview.importingProgress', { done: importProgress.done, total: importProgress.total }) : t('importModal.preview.importingBtn')} </>) : (t('importModal.preview.importBtn', { count: selectedItemsCount }))}</button>
                  <button onClick={onClose} disabled={isImporting} type="button" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">{t('importModal.preview.cancelBtn')}</button>
                </div>
              </>
            )}
          </div>
        </div >
      </FocusTrap >
    </div >
  );
}