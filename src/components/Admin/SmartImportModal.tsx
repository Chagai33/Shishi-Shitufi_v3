import React, { useState } from 'react';
import { X, Mic, MicOff, Check, Edit2, Trash2, Wand2, Loader2, ArrowRight } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { MenuItem } from '../../types';
import toast from 'react-hot-toast';

interface ImportedItem {
  id: string; // Temporary ID for review
  name: string;
  quantity: number;
}

interface SmartImportModalProps {
  onImport: (items: Omit<MenuItem, 'id'>[]) => Promise<void>;
  onClose: () => void;
}

export function SmartImportModal({ onImport, onClose }: SmartImportModalProps) {
  const [step, setStep] = useState<'INPUT' | 'PROCESSING' | 'REVIEW'>('INPUT');
  const [inputText, setInputText] = useState('');
  const [importedItems, setImportedItems] = useState<ImportedItem[]>([]);
  const { isListening, transcript, start, stop, reset, error: voiceError } = useVoiceInput();

  // Handle active listening transcript
  React.useEffect(() => {
    if (transcript) {
      setInputText(transcript);
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

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast.error('אנא הזן טקסט או הקלט רשימה');
      return;
    }

    setStep('PROCESSING');

    try {
      const parseShoppingList = httpsCallable(functions, 'parseShoppingList');
      const result = await parseShoppingList({ text: inputText });
      const data = result.data as { items: { name: string; quantity: number }[] };

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('התקבל מבנה נתונים לא תקין מהשרת');
      }

      const itemsWithIds = data.items.map((item, idx) => ({
        ...item,
        id: `temp-${Date.now()}-${idx}`
      }));

      setImportedItems(itemsWithIds);
      setStep('REVIEW');
    } catch (error: any) {
      console.error("Smart Import Error:", error);
      toast.error('שגיאה בפענוח הרשימה: ' + (error.message || 'נסה שוב'));
      setStep('INPUT');
    }
  };

  const handleUpdateItem = (id: string, field: 'name' | 'quantity', value: string | number) => {
    setImportedItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleDeleteItem = (id: string) => {
    setImportedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleFinalImport = async () => {
    try {
      const finalItems = importedItems.map(({ name, quantity }) => ({
        name,
        quantity: Number(quantity), // Ensure number
        category: 'other', // Default category
        importance: 'medium', // Default importance
      }));

      await onImport(finalItems as any);
      onClose();
      toast.success('הפריטים יובאו בהצלחה!');
    } catch (error) {
      console.error("Import Error:", error);
      toast.error('שגיאה בשמירת הפריטים');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white flex justify-between items-center">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Wand2 className="h-5 w-5" />
            <span className="font-bold text-lg">יבוא חכם (Smart Import)</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'INPUT' && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                הזן רשימת קניות, או לחץ על המיקרופון והקרא אותה. המערכת תזהה אוטומטית כמויות ופריטים.
              </p>

              <div className="relative">
                <textarea
                  className="w-full border border-gray-300 rounded-lg p-3 min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-right"
                  placeholder="דוגמה: 2 חלב, לחם וגבינה בולגרית..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
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

              {voiceError && (
                <p className="text-red-500 text-xs">שגיאה בזיהוי קולי: {voiceError}</p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleAnalyze}
                  disabled={!inputText.trim()}
                  className="flex items-center space-x-2 rtl:space-x-reverse bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Wand2 className="h-4 w-4" />
                  <span>פענח רשימה</span>
                </button>
              </div>
            </div>
          )}

          {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-gray-600 font-medium">הבינה המלאכותית מנתחת את הרשימה שלך...</p>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-800">נמצאו {importedItems.length} פריטים</h3>
                <button onClick={() => setStep('INPUT')} className="text-xs text-blue-600 hover:underline">חזור לעריכה</button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                {importedItems.map((item) => (
                  <div key={item.id} className="flex items-center space-x-2 rtl:space-x-reverse bg-gray-50 border rounded-lg p-2 group hover:border-blue-300 transition-colors">
                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full text-center border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm py-1"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                        className="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm py-1 px-2"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t flex justify-end space-x-3 rtl:space-x-reverse">
                <button
                  onClick={() => setStep('INPUT')}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleFinalImport}
                  className="flex items-center space-x-2 rtl:space-x-reverse bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm hover:shadow"
                >
                  <Check className="h-4 w-4" />
                  <span>אשר ויבא {importedItems.length} פריטים</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
