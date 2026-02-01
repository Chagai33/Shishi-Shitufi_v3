// src/components/Admin/ImportItemsModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, Upload, FileText, Table, AlertCircle, CheckCircle, Trash2, List, Wand2, Mic, MicOff, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory } from '../../types';
import { PresetListsManager } from './PresetListsManager';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useTranslation, Trans } from 'react-i18next';

interface ImportItemsModalProps {
  event: ShishiEvent;
  onClose: () => void;
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

type ImportMethod = 'excel' | 'csv' | 'text' | 'preset' | 'smart';

export function ImportItemsModal({ event, onClose }: ImportItemsModalProps) {
  const { t } = useTranslation();
  const { addMenuItem } = useStore();
  const { user: authUser } = useAuth();
  const [activeMethod, setActiveMethod] = useState<ImportMethod>('preset');
  const [textInput, setTextInput] = useState('');
  const [importItems, setImportItems] = useState<ImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);

  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [itemsToImport, setItemsToImport] = useState<{ newItems: ImportItem[], duplicateItems: ImportItem[] }>({ newItems: [], duplicateItems: [] });

  // Smart Import State
  const { isListening, transcript, start, stop, reset, error: voiceError } = useVoiceInput();
  const [smartInputText, setSmartInputText] = useState('');
  const [smartImage, setSmartImage] = useState<File | null>(null);
  const [smartImagePreview, setSmartImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const categoryOptions: { value: MenuCategory; label: string }[] = [
    { value: 'starter', label: t('categories.starter') },
    { value: 'main', label: t('categories.main') },
    { value: 'dessert', label: t('categories.dessert') },
    { value: 'drink', label: t('categories.drink') },
    { value: 'other', label: t('categories.other') }
  ];

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
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(smartImage);
        });
      }

      const parseShoppingList = httpsCallable(functions, 'parseShoppingList');
      const result = await parseShoppingList({
        text: smartInputText,
        image: imageBase64,
        mimeType: smartImage?.type
      });
      const data = result.data as { items: { name: string; quantity: number }[] };

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('התקבל מבנה נתונים לא תקין מהשרת');
      }

      const items: ImportItem[] = data.items.map(item => ({
        name: item.name,
        category: 'other', // Default for AI, will be editable
        quantity: item.quantity,
        isRequired: false,
        selected: true
      }));

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
  const duplicateTitleId = useId();

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

  const parseTextInput = (text: string): ImportItem[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const items: ImportItem[] = [];

    lines.forEach((line) => {
      const parts = line.split(',').map(part => part.trim());
      if (parts.length === 0 || !parts[0]) return;
      const name = parts[0];
      const quantity = parts[1] ? parseInt(parts[1]) || 1 : 1;
      const notes = parts[2] || undefined;
      if (name.length < 2) {
        items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.nameLength') });
        return;
      }
      if (quantity < 1 || quantity > 100) {
        items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: t('importModal.preview.errors.quantityRange') });
        return;
      }
      items.push({ name, category: 'main', quantity, notes, isRequired: false, selected: true });
    });
    return items;
  };

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
      if (activeMethod === 'excel' && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) { items = await parseExcelFile(file); }
      else if (activeMethod === 'csv' && file.name.endsWith('.csv')) { items = await parseCSVFile(file); }
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

  const handleTextParse = () => {
    if (!textInput.trim()) { toast.error(t('importModal.text.emptyError')); return; }
    try {
      const items = parseTextInput(textInput);
      setImportItems(items);
      setShowPreview(true);
      if (items.length === 0) { toast.error(t('importModal.preview.noItems')); } else { toast.success(t('importModal.preset.loadedSuccess', { count: items.length })); }
    } catch (error) { console.error('Error parsing text:', error); toast.error(t('importModal.text.parseError')); }
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
          } else { errorCount++; }
        } catch (error) { console.error(`Error importing item ${item.name}:`, error); errorCount++; }
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

  if (showDuplicateConfirm) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
        role="presentation"
      >
        <FocusTrap>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={duplicateTitleId}
            className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6"
          >
            <h2 id={duplicateTitleId} className="text-lg font-semibold text-gray-900 mb-2">{t('importModal.duplicates.title')}</h2>
            <p className="text-sm text-gray-600 mb-4">
              <Trans i18nKey="importModal.duplicates.desc" values={{ duplicates: itemsToImport.duplicateItems.length, new: itemsToImport.newItems.length }} components={{ strong: <strong />, br: <br /> }} />
            </p>
            <div className="space-y-3">
              <button
                onClick={() => executeImport([...itemsToImport.newItems, ...itemsToImport.duplicateItems])}
                disabled={isImporting}
                type="button"
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {isImporting ? t('importModal.preview.importingBtn') : t('importModal.duplicates.importAll', { count: itemsToImport.newItems.length + itemsToImport.duplicateItems.length })}
              </button>
              <button
                onClick={() => executeImport(itemsToImport.newItems)}
                disabled={isImporting || itemsToImport.newItems.length === 0}
                type="button"
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {isImporting ? t('importModal.preview.importingBtn') : t('importModal.duplicates.importNew', { count: itemsToImport.newItems.length })}
              </button>
              <button
                onClick={() => setShowDuplicateConfirm(false)}
                disabled={isImporting}
                type="button"
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                {t('importModal.duplicates.cancel')}
              </button>
            </div>
          </div>
        </FocusTrap>
      </div>
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
                  <h3 className="text-md font-medium text-gray-900 mb-4">{t('importModal.methods.desc')}</h3>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setActiveMethod('preset')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'preset' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><List className="h-4 w-4" /><span>{t('importModal.methods.preset')}</span></button>
                    <button onClick={() => setActiveMethod('text')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'text' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><FileText className="h-4 w-4" /><span>{t('importModal.methods.text')}</span></button>
                    <button onClick={() => setActiveMethod('excel')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'excel' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><Table className="h-4 w-4" /><span>{t('importModal.methods.excel')}</span></button>
                    <button onClick={() => setActiveMethod('csv')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'csv' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><Table className="h-4 w-4" /><span>{t('importModal.methods.csv')}</span></button>
                    {/* Smart Import Button - Added manually during merge */}
                    <button onClick={() => setActiveMethod('smart')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'smart' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><Wand2 className="h-4 w-4" /><span>AI Smart Import</span></button>
                  </div>
                </div>
                {activeMethod === 'preset' && (<div className="mb-6"><div className="text-center py-8"><div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><List className="h-8 w-8 text-green-600" /></div><h3 className="text-lg font-medium text-gray-900 mb-2">{t('importModal.preset.title')}</h3><p className="text-gray-500 mb-4">{t('importModal.preset.desc')}</p><button onClick={() => setShowPresetManager(true)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">{t('importModal.preset.openBtn')}</button></div></div>)}
                {activeMethod === 'text' && (<div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">{t('importModal.text.label')}</label><textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder={t('importModal.text.placeholder')} rows={8} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" /><p className="text-xs text-gray-500 mt-2">{t('importModal.text.help')}</p><button onClick={handleTextParse} disabled={!textInput.trim()} className="mt-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors">{t('importModal.text.parseBtn')}</button></div>)}
                {(activeMethod === 'excel' || activeMethod === 'csv') && (<div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">{t('importModal.file.label', { type: activeMethod === 'excel' ? 'Excel' : 'CSV' })}</label><input type="file" accept={activeMethod === 'excel' ? '.xlsx,.xls' : '.csv'} onChange={handleFileUpload} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /><p className="text-xs text-gray-500 mt-2">{t('importModal.file.help')}</p></div>)}

                {/* Smart Import UI - Added manually during merge */}
                {activeMethod === 'smart' && (
                  <div className="mb-6">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
                        <p className="text-gray-600 font-medium">הבינה המלאכותית מנתחת את הרשימה שלך...</p>
                      </div>
                    ) : (

                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-2">הזן רשימת פריטים (טקסט, הקלטה או תמונה)</label>

                        <div className="space-y-4">
                          {/* Text / Voice Input */}
                          <div className="relative">
                            <textarea
                              value={smartInputText}
                              onChange={(e) => setSmartInputText(e.target.value)}
                              placeholder="דוגמה: 2 חלב, לחם וגבינה בולגרית..."
                              rows={4}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                              dir="rtl"
                            />
                            <div className="absolute bottom-2 left-2">
                              <button
                                onClick={toggleListening}
                                className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                title="הקרא רשימה"
                              >
                                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>

                          {/* Image Input */}
                          <div className="flex items-center space-x-4 rtl:space-x-reverse">
                            <div className="flex-1">
                              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  <Upload className="w-8 h-8 mb-3 text-gray-400" />
                                  <p className="text-sm text-gray-500"><span className="font-semibold">לחץ להעלאת תמונה</span></p>
                                  <p className="text-xs text-gray-500">PNG, JPG, HEIC</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleSmartImageSelect} />
                              </label>
                            </div>
                            {smartImagePreview && (
                              <div className="relative h-32 w-32 rounded-lg overflow-hidden border border-gray-200 group">
                                <img src={smartImagePreview} alt="Preview" className="h-full w-full object-cover" />
                                <button
                                  onClick={() => { setSmartImage(null); setSmartImagePreview(null); }}
                                  className="absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">המערכת תזהה אוטומטית כמויות ופריטים (גם מכתב יד).</p>
                        <button onClick={handleSmartAnalyze} disabled={!smartInputText.trim() && !smartImage} className="mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 rtl:space-x-reverse font-medium">
                          <Wand2 className="h-4 w-4" />
                          <span>פענח עם AI</span>
                        </button>
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
                      <button onClick={toggleSelectAll} className="text-sm text-green-600 hover:text-green-700">{validItemsCount > 0 && importItems.filter(item => !item.error).every(item => item.selected) ? t('importModal.preview.deselectAll') : t('importModal.preview.selectAll')}</button>
                      <button onClick={() => { setShowPreview(false); setImportItems([]); setTextInput(''); setSmartInputText(''); }} className="text-sm text-gray-600 hover:text-gray-700">{t('importModal.preview.back')}</button>
                    </div>
                  </div>
                  {importItems.length === 0 ? (<div className="text-center py-8"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">{t('importModal.preview.noItems')}</p></div>) : (
                    <div className="border border-gray-200 rounded-lg overflow-hidden"><div className="max-h-96 overflow-y-auto"><table className="w-full"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.select')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.name')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.category')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.quantity')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.notes')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.required')}</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('importModal.preview.table.actions')}</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{importItems.map((item, index) => (<tr key={index} className={item.error ? 'bg-red-50' : ''}><td className="px-4 py-3"><input type="checkbox" checked={item.selected} onChange={(e) => updateItem(index, 'selected', e.target.checked)} disabled={!!item.error} className="rounded border-gray-300 text-green-600 focus:ring-green-500" /></td><td className="px-4 py-3"><input type="text" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />{item.error && (<p className="text-xs text-red-600 mt-1 flex items-center"><AlertCircle className="h-3 w-3 ml-1" />{item.error}</p>)}</td><td className="px-4 py-3"><select value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm">{categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}</select></td><td className="px-4 py-3"><input type="number" min="1" max="100" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td><td className="px-4 py-3"><input type="text" value={item.notes || ''} onChange={(e) => updateItem(index, 'notes', e.target.value || undefined)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td><td className="px-4 py-3"><input type="checkbox" checked={item.isRequired} onChange={(e) => updateItem(index, 'isRequired', e.target.checked)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" /></td><td className="px-4 py-3"><button onClick={() => removeItem(index)} className="text-red-600 hover:text-red-700" title="הסר פריט"><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody></table></div></div>
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
        </div>
      </FocusTrap>
    </div>
  );
}