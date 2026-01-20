import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Edit, Trash2, Eye, EyeOff, List, Users, Home, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebaseService';
import { MenuCategory } from '../../types';
import toast from 'react-hot-toast';
import { useStore } from '../../store/useStore';



interface PresetItem {
  name: string;
  category: MenuCategory;
  quantity: number;
  notes?: string;
  isRequired: boolean;
}

interface PresetList {
  id: string;
  name: string;
  type: 'salon' | 'participants';
  items: PresetItem[];
  createdAt: number;
  updatedAt: number;
  createdBy?: string;
}

interface PresetListsManagerProps {
  onClose: () => void;
  onSelectList: (items: PresetItem[]) => void;
  selectedItemsForSave?: PresetItem[];
}

const defaultSalonList: PresetItem[] = [
  { name: 'שולחנות', category: 'other', quantity: 4, isRequired: true },
  { name: 'כיסאות', category: 'other', quantity: 20, isRequired: true },
  { name: 'מפות שולחן', category: 'other', quantity: 4, isRequired: false },
  { name: 'צלחות', category: 'other', quantity: 25, isRequired: true },
  { name: 'כוסות', category: 'other', quantity: 25, isRequired: true },
  { name: 'סכו"ם', category: 'other', quantity: 25, isRequired: true },
  { name: 'מגשים', category: 'other', quantity: 5, isRequired: false },
  { name: 'קנקני מים', category: 'drink', quantity: 3, isRequired: true },
  { name: 'מפיות', category: 'other', quantity: 50, isRequired: false },
];

const defaultParticipantsList: PresetItem[] = [
  { name: 'חלה', category: 'main', quantity: 2, isRequired: true },
  { name: 'יין אדום', category: 'drink', quantity: 1, isRequired: true },
  { name: 'יין לבן', category: 'drink', quantity: 1, isRequired: false },
  { name: 'סלט ירוק', category: 'starter', quantity: 1, isRequired: false },
  { name: 'חומוס', category: 'starter', quantity: 1, isRequired: false },
  { name: 'טחינה', category: 'starter', quantity: 1, isRequired: false },
  { name: 'פיתות', category: 'main', quantity: 10, isRequired: false },
  { name: 'גבינות', category: 'starter', quantity: 1, isRequired: false },
  { name: 'פירות', category: 'dessert', quantity: 1, isRequired: false },
  { name: 'עוגה', category: 'dessert', quantity: 1, isRequired: false },
  { name: 'מיץ', category: 'drink', quantity: 2, isRequired: false },
  { name: 'מים', category: 'drink', quantity: 2, isRequired: true },
];

export function PresetListsManager({ onClose, onSelectList, selectedItemsForSave }: PresetListsManagerProps) {
  const { isAdmin, user: authUser } = useAuth();
  const { user } = useStore();
  const [presetLists, setPresetLists] = useState<PresetList[]>([]);
  const [editingList, setEditingList] = useState<PresetList | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<'salon' | 'participants'>('participants');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categoryOptions = [
    { value: 'starter', label: 'מנה ראשונה' },
    { value: 'main', label: 'מנה עיקרית' },
    { value: 'dessert', label: 'קינוח' },
    { value: 'drink', label: 'משקה' },
    { value: 'other', label: 'אחר' }
  ];

  // Load preset lists from Firebase
  useEffect(() => {
    const organizerId = user?.id || authUser?.uid;
    
    if (!organizerId) {
      setIsLoading(false);
      return;
    }
    
    const unsubscribe = FirebaseService.subscribeToPresetLists((lists) => {
      setPresetLists(lists);
      setIsLoading(false);
    }, organizerId);

    return unsubscribe;
  }, [user?.id, authUser?.uid]);

  // Create new preset list
  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error('יש להזין שם לרשימה');
      return;
    }

    setIsSubmitting(true);

    try {
      const newList = {
        name: newListName.trim(),
        type: newListType,
        items: selectedItemsForSave && selectedItemsForSave.length > 0 
          ? selectedItemsForSave 
          : newListType === 'salon' ? [...defaultSalonList] : [...defaultParticipantsList]
      };

      // Pass organizerId to save under specific organizer
      const organizerId = user?.id || authUser?.uid;
      
      if (!organizerId) {
        toast.error('שגיאה: לא זוהה מזהה מארגן');
        return null;
      }
      
      const listId = await FirebaseService.createPresetList(newList, organizerId);
      
      if (listId) {
        toast.success(`רשימה "${newListName.trim()}" נשמרה בהצלחה עם ${newList.items.length} פריטים`);
        setShowCreateForm(false);
        setNewListName('');
        onClose(); // Closing the modal
      } else {
        throw new Error('לא התקבל מזהה רשימה מהשרת');
      }
    } catch (error: any) {
      console.error('Error creating preset list:', error);
      toast.error(error.message || 'שגיאה ביצירת הרשימה');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete preset list
  const handleDeleteList = async (listId: string) => {
    if (listId.startsWith('default-')) {
      toast.error('לא ניתן למחוק רשימות ברירת מחדל');
      return;
    }

    if (!confirm('האם אתה בטוח שברצונך למחוק רשימה זו?')) {
      return;
    }

    try {
      const organizerId = user?.id || authUser?.uid;
      
      if (!organizerId) {
        toast.error('שגיאה: לא זוהה מזהה מארגן');
        return;
      }
      
      await FirebaseService.deletePresetList(listId, organizerId);
      toast.success('הרשימה נמחקה');
    } catch (error: any) {
      console.error('Error deleting preset list:', error);
      toast.error(error.message || 'שגיאה במחיקת הרשימה');
    }
  };

  // Update preset list
  const handleUpdateList = async (updatedList: PresetList) => {
    if (updatedList.id.startsWith('default-')) {
      toast.error('לא ניתן לערוך רשימות ברירת מחדל');
      return;
    }

    setIsSubmitting(true);

    try {
      const organizerId = user?.id || authUser?.uid;
      
      if (!organizerId) {
        toast.error('שגיאה: לא זוהה מזהה מארגן');
        return;
      }
      
      const success = await FirebaseService.updatePresetList(updatedList.id, {
        name: updatedList.name,
        items: updatedList.items
      }, organizerId);

      if (success) {
        toast.success('הרשימה עודכנה');
        setEditingList(null);
      }
    } catch (error: any) {
      console.error('Error updating preset list:', error);
      toast.error(error.message || 'שגיאה בעדכון הרשימה');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add item to editing list
  const addItemToEditingList = () => {
    if (!editingList) return;

    const newItem: PresetItem = {
      name: '',
      category: 'main',
      quantity: 1,
      isRequired: false
    };

    setEditingList({
      ...editingList,
      items: [...editingList.items, newItem]
    });
  };

  // Update item in editing list
  const updateItemInEditingList = (index: number, updates: Partial<PresetItem>) => {
    if (!editingList) return;

    const updatedItems = editingList.items.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );

    setEditingList({
      ...editingList,
      items: updatedItems
    });
  };

  // Remove item from editing list
  const removeItemFromEditingList = (index: number) => {
    if (!editingList) return;

    const updatedItems = editingList.items.filter((_, i) => i !== index);
    setEditingList({
      ...editingList,
      items: updatedItems
    });
  };

  // Filter lists based on admin status - salon lists only for admins
  const visibleLists = presetLists.filter(list => 
    list.type === 'participants' || (list.type === 'salon' && isAdmin)
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען רשימות מוכנות...</p>
        </div>
      </div>
    );
  }

  if (editingList) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className={`rounded-lg p-2 ${editingList.type === 'salon' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                {editingList.type === 'salon' ? (
                  <Home className={`h-5 w-5 ${editingList.type === 'salon' ? 'text-purple-600' : 'text-blue-600'}`} />
                ) : (
                  <Users className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">עריכת רשימה</h2>
                <p className="text-sm text-gray-600">{editingList.name}</p>
              </div>
            </div>
            <button
              onClick={() => setEditingList(null)}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* List Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                שם הרשימה
              </label>
              <input
                type="text"
                value={editingList.name}
                onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={editingList.id.startsWith('default-')}
              />
              {editingList.id.startsWith('default-') && (
                <p className="text-xs text-gray-500 mt-1">
                  לא ניתן לערוך רשימות ברירת מחדל
                </p>
              )}
            </div>

            {/* Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md font-medium text-gray-900">פריטים ברשימה</h3>
                {!editingList.id.startsWith('default-') && (
                  <button
                    onClick={addItemToEditingList}
                    disabled={isSubmitting}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-2 rtl:space-x-reverse"
                  >
                    <Plus className="h-4 w-4" />
                    <span>הוסף פריט</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {editingList.items.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      {/* Name */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">שם</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemInEditingList(index, { name: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="שם הפריט"
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">קטגוריה</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateItemInEditingList(index, { category: e.target.value as MenuCategory })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          disabled={editingList.id.startsWith('default-')}
                        >
                          {categoryOptions.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">כמות</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={item.quantity}
                          onChange={(e) => updateItemInEditingList(index, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>

                      {/* Required */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">חובה</label>
                        <div className="flex items-center h-8">
                          <input
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={(e) => updateItemInEditingList(index, { isRequired: e.target.checked })}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            disabled={editingList.id.startsWith('default-')}
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">פעולות</label>
                        {!editingList.id.startsWith('default-') && (
                          <button
                            onClick={() => removeItemFromEditingList(index)}
                            disabled={isSubmitting}
                            className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="הסר פריט"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">הערות</label>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateItemInEditingList(index, { notes: e.target.value || undefined })}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        placeholder="הערות נוספות..."
                        disabled={editingList.id.startsWith('default-')}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 rtl:space-x-reverse">
              {!editingList.id.startsWith('default-') ? (
                <button
                  onClick={() => handleUpdateList(editingList)}
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                      שומר...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 ml-2" />
                      שמור רשימה
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onSelectList(editingList.items)}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  <CheckCircle className="h-4 w-4 ml-2" />
                  בחר רשימה זו
                </button>
              )}
              <button
                onClick={() => setEditingList(null)}
                disabled={isSubmitting}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {editingList.id.startsWith('default-') ? 'סגור' : 'ביטול'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="bg-green-100 rounded-lg p-2">
              <List className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">רשימות מוכנות</h2>
              <p className="text-sm text-gray-600">בחר רשימה או צור רשימה חדשה</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Create New List */}
          <div className="mb-6">
            {selectedItemsForSave && selectedItemsForSave.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-blue-800 mb-2">שמירת פריטים נבחרים</h3>
                <p className="text-sm text-blue-700">
                  {selectedItemsForSave.length} פריטים נבחרו לשמירה כרשימה מוכנה
                </p>
              </div>
            )}
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4 ml-2" />
                {selectedItemsForSave && selectedItemsForSave.length > 0 ? 'שמור כרשימה חדשה' : 'צור רשימה חדשה'}
              </button>
            ) : (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">שם הרשימה</label>
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="שם הרשימה החדשה"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">סוג רשימה</label>
                    <select
                      value={newListType}
                      onChange={(e) => setNewListType(e.target.value as 'salon' | 'participants')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                    >
                      <option value="participants">פריטים למשתתפים</option>
                      {isAdmin && <option value="salon">ציוד סלון</option>}
                    </select>
                  </div>
                </div>
                <div className="flex space-x-3 rtl:space-x-reverse">
                  <button
                    onClick={handleCreateList}
                    disabled={!newListName.trim() || isSubmitting}
                    className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                        יוצר...
                      </>
                    ) : (
                      'צור רשימה'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewListName('');
                    }}
                    disabled={isSubmitting}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Existing Lists */}
          <div className="space-y-3">
            {visibleLists.length === 0 ? (
              <div className="text-center py-8">
                <List className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">אין רשימות</h3>
                <p className="text-gray-500">צור רשימה חדשה כדי להתחיל</p>
              </div>
            ) : (
              visibleLists.map((list) => (
                <div key={list.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3 rtl:space-x-reverse">
                      <div className={`rounded-lg p-2 ${list.type === 'salon' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                        {list.type === 'salon' ? (
                          <Home className="h-4 w-4 text-purple-600" />
                        ) : (
                          <Users className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{list.name}</h4>
                        <p className="text-sm text-gray-600">
                          {list.items.length} פריטים • 
                          {list.type === 'salon' ? ' ציוד סלון' : ' פריטים למשתתפים'}
                          {list.type === 'salon' && (
                            <span className="text-purple-600 font-medium"> (מנהלים בלבד)</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button
                        onClick={() => onSelectList(list.items)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1 rtl:space-x-reverse"
                      >
                        <CheckCircle className="h-3 w-3" />
                        <span>בחר</span>
                      </button>
                      <button
                        onClick={() => setEditingList(list)}
                        className="p-1 text-blue-600 hover:text-blue-700"
                        title="ערוך"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {!list.id.startsWith('default-') && (
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title="מחק"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Preview of items */}
                  <div className="text-xs text-gray-500">
                    {list.items.slice(0, 3).map(item => item.name).join(', ')}
                    {list.items.length > 3 && ` ועוד ${list.items.length - 3}...`}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}