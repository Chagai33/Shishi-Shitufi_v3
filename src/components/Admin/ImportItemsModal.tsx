// src/components/Admin/ImportItemsModal.tsx

import React, { useState } from 'react';
import { X, Upload, FileText, Table, AlertCircle, CheckCircle, Trash2, List } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory } from '../../types';
import { PresetListsManager } from './PresetListsManager';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

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

type ImportMethod = 'excel' | 'csv' | 'text' | 'preset';

export function ImportItemsModal({ event, onClose }: ImportItemsModalProps) {
  // *** Fix: Removed menuItems from this line ***
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

  const categoryOptions: { value: MenuCategory; label: string }[] = [
    { value: 'starter', label: 'מנה ראשונה' },
    { value: 'main', label: 'מנה עיקרית' },
    { value: 'dessert', label: 'קינוח' },
    { value: 'drink', label: 'משקה' },
    { value: 'other', label: 'אחר' }
  ];

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
        items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'שם הפריט חייב להכיל לפחות 2 תווים' });
        return;
      }
      if (quantity < 1 || quantity > 100) {
        items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'הכמות חייבת להיות בין 1 ל-100' });
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
            if (name.length < 2) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'שם הפריט חייב להכיל לפחות 2 תווים' }); continue; }
            if (quantity < 1 || quantity > 100) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'הכמות חייבת להיות בין 1 ל-100' }); continue; }
            items.push({ name, category: 'main', quantity, notes, isRequired: false, selected: true });
          }
          resolve(items);
        } catch { reject(new Error('שגיאה בקריאת קובץ Excel')); }
      };
      reader.onerror = () => reject(new Error('שגיאה בטעינת הקובץ'));
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
              if (name.length < 2) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'שם הפריט חייב להכיל לפחות 2 תווים' }); continue; }
              if (quantity < 1 || quantity > 100) { items.push({ name, category: 'main', quantity: 1, notes, isRequired: false, selected: false, error: 'הכמות חייבת להיות בין 1 ל-100' }); continue; }
              items.push({ name, category: 'main', quantity, notes, isRequired: false, selected: true });
          }
          resolve(items);
        } catch { reject(new Error('שגיאה בעיבוד קובץ CSV')); }
      },
        error: () => reject(new Error('שגיאה בקריאת קובץ CSV')),
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
      else { toast.error('סוג קובץ לא נתמך'); return; }
      setImportItems(items);
      setShowPreview(true);
      if (items.length === 0) { toast.error('לא נמצאו פריטים תקינים בקובץ'); } else { toast.success(`נמצאו ${items.length} פריטים`); }
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error(error instanceof Error ? error.message : 'שגיאה בעיבוד הקובץ');
    }
    e.target.value = '';
  };

  const handleTextParse = () => {
    if (!textInput.trim()) { toast.error('יש להזין טקסט'); return; }
    try {
      const items = parseTextInput(textInput);
      setImportItems(items);
      setShowPreview(true);
      if (items.length === 0) { toast.error('לא נמצאו פריטים תקינים'); } else { toast.success(`נמצאו ${items.length} פריטים`); }
    } catch (error) { console.error('Error parsing text:', error); toast.error('שגיאה בעיבוד הטקסט'); }
  };

  const handlePresetListSelect = (presetItems: { name: string; category: MenuCategory; quantity: number; notes?: string; isRequired: boolean; }[]) => {
    const items: ImportItem[] = presetItems.map(item => ({ name: item.name, category: item.category, quantity: item.quantity, notes: item.notes, isRequired: item.isRequired, selected: true }));
    setImportItems(items);
    setShowPreview(true);
    setShowPresetManager(false);
    toast.success(`נטענו ${items.length} פריטים מהרשימה`);
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
            creatorName: authUser?.displayName || 'Admin'
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

      if (successCount > 0) toast.success(`יובאו בהצלחה ${successCount} פריטים`);
      if (errorCount > 0) toast.error(`${errorCount} פריטים נכשלו בייבוא`);
      if (successCount > 0) onClose();
    } catch (error) {
      console.error('Error during import:', error);
      toast.error('שגיאה כללית בייבוא');
    } finally {
      setIsImporting(false);
      setShowDuplicateConfirm(false);
    }
  };

  const handleImport = async () => {
    const selectedItems = importItems.filter(item => item.selected && !item.error);
    if (selectedItems.length === 0) {
      toast.error('יש לבחור לפחות פריט אחד לייבוא');
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
      toast.success(`נמצאו ${duplicateItems.length} פריטים כפולים. בחר איך להמשיך.`);
    } else {
      await executeImport(newItems);
    }
  };

  const validItemsCount = importItems.filter(item => !item.error).length;
  const selectedItemsCount = importItems.filter(item => item.selected && !item.error).length;

  if (showDuplicateConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">נמצאו פריטים כפולים</h2>
          <p className="text-sm text-gray-600 mb-4">
            זוהו <strong>{itemsToImport.duplicateItems.length}</strong> פריטים שכבר קיימים באירוע.
            <br />
            בנוסף להם, יש <strong>{itemsToImport.newItems.length}</strong> פריטים חדשים.
            <br/>
            איך תרצה להמשיך?
          </p>
          <div className="space-y-3">
            <button onClick={() => executeImport([...itemsToImport.newItems, ...itemsToImport.duplicateItems])} disabled={isImporting} className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              {isImporting ? 'מייבא...' : `ייבא הכל (${itemsToImport.newItems.length + itemsToImport.duplicateItems.length} פריטים)`}
            </button>
            <button onClick={() => executeImport(itemsToImport.newItems)} disabled={isImporting || itemsToImport.newItems.length === 0} className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors">
              {isImporting ? 'מייבא...' : `ייבא חדשים בלבד (${itemsToImport.newItems.length} פריטים)`}
            </button>
            <button onClick={() => setShowDuplicateConfirm(false)} disabled={isImporting} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors">
              ביטול
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showPresetManager) {
    return (<PresetListsManager onClose={() => setShowPresetManager(false)} onSelectList={handlePresetListSelect} />);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="bg-green-100 rounded-lg p-2"><Upload className="h-5 w-5 text-green-600" /></div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ייבוא פריטים</h2>
              <p className="text-sm text-gray-600">{event.details.title}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isImporting} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">
          {!showPreview ? (
            <>
              <div className="mb-6">
                <h3 className="text-md font-medium text-gray-900 mb-4">בחר שיטת ייבוא</h3>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveMethod('preset')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'preset' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><List className="h-4 w-4" /><span>רשימה התחלתית</span></button>
                  <button onClick={() => setActiveMethod('text')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'text' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><FileText className="h-4 w-4" /><span>טקסט חופשי</span></button>
                  <button onClick={() => setActiveMethod('excel')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'excel' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><Table className="h-4 w-4" /><span>Excel</span></button>
                  <button onClick={() => setActiveMethod('csv')} className={`flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-lg border transition-colors ${activeMethod === 'csv' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}><Table className="h-4 w-4" /><span>CSV</span></button>
                </div>
              </div>
              {activeMethod === 'preset' && ( <div className="mb-6"><div className="text-center py-8"><div className="bg-green-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><List className="h-8 w-8 text-green-600" /></div><h3 className="text-lg font-medium text-gray-900 mb-2">רשימות מוכנות</h3><p className="text-gray-500 mb-4">בחר מרשימות מוכנות מראש או צור רשימה חדשה</p><button onClick={() => setShowPresetManager(true)} className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition-colors">פתח רשימות מוכנות</button></div></div> )}
              {activeMethod === 'text' && ( <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">הדבק רשימת פריטים</label><textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="לחם, 2&#10;סלט ירוק, 1, סלט עלים טריים&#10;יין אדום, 1&#10;עוגת שוקולד, 1, קינוח מיוחד" rows={8} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none" /><p className="text-xs text-gray-500 mt-2">פורמט: שם פריט, כמות (אופציונלי), הערות (אופציונלי)<br />כל פריט בשורה נפרדת. אם לא צוינה כמות, תיקבע כמות 1.</p><button onClick={handleTextParse} disabled={!textInput.trim()} className="mt-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg transition-colors">עבד טקסט</button></div> )}
              {(activeMethod === 'excel' || activeMethod === 'csv') && ( <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">העלה קובץ {activeMethod === 'excel' ? 'Excel' : 'CSV'}</label><input type="file" accept={activeMethod === 'excel' ? '.xlsx,.xls' : '.csv'} onChange={handleFileUpload} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent" /><p className="text-xs text-gray-500 mt-2">פורמט: עמודה ראשונה - שם פריט, עמודה שנייה - כמות (אופציונלי), עמודה שלישית - הערות (אופציונלי)<br />השורה הראשונה יכולה להכיל כותרות ותתעלם.</p></div> )}
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-md font-medium text-gray-900">תצוגה מקדימה ({importItems.length} פריטים)</h3>
                  <div className="flex items-center space-x-3 rtl:space-x-reverse">
                    <button onClick={toggleSelectAll} className="text-sm text-green-600 hover:text-green-700">{validItemsCount > 0 && importItems.filter(item => !item.error).every(item => item.selected) ? 'בטל בחירת הכל' : 'בחר הכל'}</button>
                    <button onClick={() => { setShowPreview(false); setImportItems([]); setTextInput(''); }} className="text-sm text-gray-600 hover:text-gray-700">חזור לייבוא</button>
                  </div>
                </div>
                {importItems.length === 0 ? ( <div className="text-center py-8"><AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">לא נמצאו פריטים לייבוא</p></div> ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden"><div className="max-h-96 overflow-y-auto"><table className="w-full"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">בחר</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם פריט</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">קטגוריה</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">כמות</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">הערות</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">חובה</th><th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{importItems.map((item, index) => ( <tr key={index} className={item.error ? 'bg-red-50' : ''}><td className="px-4 py-3"><input type="checkbox" checked={item.selected} onChange={(e) => updateItem(index, 'selected', e.target.checked)} disabled={!!item.error} className="rounded border-gray-300 text-green-600 focus:ring-green-500" /></td><td className="px-4 py-3"><input type="text" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />{item.error && ( <p className="text-xs text-red-600 mt-1 flex items-center"><AlertCircle className="h-3 w-3 ml-1" />{item.error}</p> )}</td><td className="px-4 py-3"><select value={item.category} onChange={(e) => updateItem(index, 'category', e.target.value as MenuCategory)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm">{categoryOptions.map(option => ( <option key={option.value} value={option.value}>{option.label}</option> ))}</select></td><td className="px-4 py-3"><input type="number" min="1" max="100" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td><td className="px-4 py-3"><input type="text" value={item.notes || ''} onChange={(e) => updateItem(index, 'notes', e.target.value || undefined)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td><td className="px-4 py-3"><input type="checkbox" checked={item.isRequired} onChange={(e) => updateItem(index, 'isRequired', e.target.checked)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" /></td><td className="px-4 py-3"><button onClick={() => removeItem(index)} className="text-red-600 hover:text-red-700" title="הסר פריט"><Trash2 className="h-4 w-4" /></button></td></tr> ))}</tbody></table></div></div>
                )}
              </div>
              {importItems.length > 0 && ( <div className="bg-blue-50 rounded-lg p-4 mb-6"><div className="flex items-center space-x-3 rtl:space-x-reverse"><CheckCircle className="h-5 w-5 text-blue-600" /><div><p className="text-sm text-blue-800"><strong>{selectedItemsCount}</strong> פריטים נבחרו לייבוא מתוך <strong>{validItemsCount}</strong> פריטים תקינים</p>{importItems.some(item => item.error) && ( <p className="text-xs text-red-600 mt-1">{importItems.filter(item => item.error).length} פריטים עם שגיאות לא ייובאו</p> )}</div></div></div> )}
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button onClick={handleImport} disabled={selectedItemsCount === 0 || isImporting} className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isImporting ? ( <> <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div> מייבא פריטים... </> ) : ( `ייבא ${selectedItemsCount} פריטים` )}</button>
                <button onClick={onClose} disabled={isImporting} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">ביטול</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}