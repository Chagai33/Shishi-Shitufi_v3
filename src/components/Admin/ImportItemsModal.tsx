// src/components/Admin/ImportItemsModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
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
import { ConfirmationModal } from './ConfirmationModal';

interface ImportItemsModalProps {
  event: ShishiEvent;
  onClose: () => void;
  onAddSingleItem?: () => void;
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
}

type ImportMethod = 'file' | 'preset' | 'smart';

export function ImportItemsModal({ event, onClose, onAddSingleItem, initialText, autoRunAI, categoriesOverride, migrationStartTime }: ImportItemsModalProps) {
  const { t } = useTranslation();
  const { addMenuItem } = useStore();
  const { user: authUser } = useAuth();
  const [activeMethod, setActiveMethod] = useState<ImportMethod>(initialText ? 'smart' : 'smart');

  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);

  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [itemsToImport, setItemsToImport] = useState<{ newItems: ImportItem[], duplicateItems: ImportItem[] }>({ newItems: [], duplicateItems: [] });

  // Smart Import State
  const { isListening, transcript, start, stop, reset } = useVoiceInput();
  const [smartInputText, setSmartInputText] = useState(initialText || '');
  const [smartImage, setSmartImage] = useState<File | null>(null);
  const [smartImagePreview, setSmartImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

    setIsAnalyzing(true);

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

      const items: ImportItem[] = data.items.map(item => {
        // Validate returned category
        const isValidCategory = allowedCats.some(c => c.id === item.category);
        return {
          name: item.name,
          category: (isValidCategory ? item.category : 'other') as MenuCategory,
          quantity: item.quantity,
          isRequired: false,
          selected: true
        };
      });

      setImportItems(items);
      setShowPreview(true);
      toast.success('הרשימה פוענחה בהצלחה!');

    } catch (error: any) {
      console.error("Smart Import Error:", error);

      let userMessage = 'שגיאה בפענוח הרשימה. אנא נסה שוב.';

      // Analyze Firebase HttpsError
      if (error.code) {
        switch (error.code) {
          case 'functions/resource-exhausted':
            userMessage = 'מכסת השימוש ב-AI הסתיימה זמנית. אנא נסה שוב מאוחר יותר.';
            break;
          case 'functions/failed-precondition':
            userMessage = 'התוכן נחסם על ידי מסנני הבטיחות. נסה לנסח אחרת.';
            break;
          case 'functions/invalid-argument':
            userMessage = 'יש לספק טקסט או תמונה תקינים.';
            break;
          case 'functions/data-loss':
            userMessage = 'ה-AI התקשה להבין את הפלט. נסה לכתוב בצורה ברורה יותר.';
            break;
          case 'functions/internal': // Often generic, check details if possible, otherwise default
            userMessage = 'שגיאה פנימית בשרת. נסה שוב מאוחר יותר.';
            break;
        }
      }

      // Fallback: Check raw message if code isn't helpful
      if (error.message?.includes('quota')) {
        userMessage = 'מכסת השימוש ב-AI הסתיימה זמנית.';
      } else if (error.message?.includes('network')) {
        userMessage = 'בעיית תקשורת. בדוק את החיבור לאינטרנט.';
      }

      toast.error(userMessage);
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



  const parseExcelFile = (file: File): Promise<ImportItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];
          const items: ImportItem[] = [];
          const startRow = jsonData[0] && typeof jsonData[0][0] === 'string' && (jsonData[0][0].includes('שם') || jsonData[0][0].includes('name')) ? 1 : 0;
          for (let i = startRow; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || !row[0]) continue;
            const name = String(row[0]).trim();
            const quantity = row[1] ? parseInt(String(row[1])) || 1 : 1;
            const notes = row[2] ? String(row[2]).trim() : undefined;
            if (name.length < 2) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.nameLength') }); continue; }
            if (quantity < 1 || quantity > 100) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.quantityRange') }); continue; }
            items.push({ name, category: 'main', quantity, notes, isRequired: false, selected: true });
          }
          resolve(items);
        } catch { reject(new Error(t('importModal.file.parseError'))); }
      };
      reader.onerror = () => reject(new Error(t('importModal.file.parseError')));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseCSVFile = (file: File): Promise<ImportItem[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          try {
            const items: ImportItem[] = [];
            const data = results.data as string[][];
            const startRow = data[0] && data[0][0] && (data[0][0].includes('שם') || data[0][0].includes('name')) ? 1 : 0;
            for (let i = startRow; i < data.length; i++) {
              const row = data[i];
              if (!row || !row[0] || !row[0].trim()) continue;
              const name = row[0].trim();
              const quantity = row[1] ? parseInt(row[1]) || 1 : 1;
              const notes = row[2] ? row[2].trim() : undefined;
              if (name.length < 2) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.nameLength') }); continue; }
              if (quantity < 1 || quantity > 100) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.quantityRange') }); continue; }
              items.push({ name, category: 'main', quantity, notes, isRequired: false, selected: true });
            }
            resolve(items);
          } catch { reject(new Error(t('importModal.file.parseError'))); }
        },
        error: () => reject(new Error(t('importModal.file.parseError'))),
        encoding: 'UTF-8'
      });
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let items: ImportItem[] = [];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) { items = await parseExcelFile(file); }
      else if (file.name.endsWith('.csv')) { items = await parseCSVFile(file); }
      else { toast.error(t('importModal.file.unsupportedType')); return; }
      setImportItems(items);
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
        const itemsForDb: Omit<MenuItem, 'id'>[] = itemsToProcess.map(item => ({
          eventId: event.id,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          notes: item.notes || '',
          isRequired: item.isRequired,
          creatorId: authUser?.uid || 'admin',
          creatorName: authUser?.displayName || 'Admin',
          createdAt: Date.now(),
          isSplittable: item.quantity > 1
        }));

        await FirebaseService.replaceAllMenuItems(event.id, itemsForDb, authUser?.uid || 'admin', migrationStartTime);

        toast.success('מיגרציה הושלמה! פריטים חדשים שנוספו במקביל נשמרו בקטגוריית "כללי"');
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
    try {
      for (const item of itemsToProcess) {
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
      if (successCount > 0) onClose();
    } catch (error) {
      console.error('Error during import:', error);
      toast.error(t('dashboard.general')); // Optimized
    } finally {
      setIsImporting(false);
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

  const handleSmartClassify = async () => {
    if (importItems.length === 0) return;

    setIsAnalyzing(true);
    const toastId = toast.loading(t('importModal.smart.analyzing'));

    try {
      // 1. Convert items to text list
      const listText = importItems.map(i => i.name).join(', ');

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

      const updatedItems = importItems.map(item => {
        const aiCategory = classificationMap.get(item.name.trim().toLowerCase());
        const isValidCategory = aiCategory && allowedCats.some(c => c.id === aiCategory);

        return {
          ...item,
          category: (isValidCategory ? aiCategory : item.category) as MenuCategory // Only update if AI found a valid category
        };
      });

      setImportItems(updatedItems);
      toast.success(t('importModal.smart.success'), { id: toastId });

    } catch (error) {
      console.error("Smart Classify Error:", error);
      toast.error(t('importModal.smart.error'), { id: toastId });
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
                      <button onClick={() => { setShowPreview(false); setImportItems([]); setSmartInputText(''); }} className="text-sm text-gray-600 hover:text-gray-700">{t('importModal.preview.back')}</button>
                    </div>
                  </div>
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
                                  <select value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm">
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                  >
                                    {categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.notes')}</label>
                                <input
                                  type="text"
                                  value={item.notes || ''}
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
                  <button onClick={handleImport} disabled={selectedItemsCount === 0 || isImporting} type="button" className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isImporting ? (<> <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div> {t('importModal.preview.importingBtn')} </>) : (t('importModal.preview.importBtn', { count: selectedItemsCount }))}</button>
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