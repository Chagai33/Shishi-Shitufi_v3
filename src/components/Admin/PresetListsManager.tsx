import { useState, useEffect } from 'react';
import { X, Save, Plus, Edit, Trash2, List, CheckCircle, Users, Home } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebaseService';
import { MenuCategory } from '../../types';
import { useTranslation } from 'react-i18next';
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


// Default list items logic moved inside component to support translation

export function PresetListsManager({ onClose, onSelectList, selectedItemsForSave }: PresetListsManagerProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { user } = useStore();
  const isAdmin = user?.isAdmin || false;
  const [presetLists, setPresetLists] = useState<PresetList[]>([]);
  const [editingList, setEditingList] = useState<PresetList | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<'salon' | 'participants'>('participants');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);



  const categoryOptions = [
    { value: 'starter', label: t('categories.starter') },
    { value: 'main', label: t('categories.main') },
    { value: 'dessert', label: t('categories.dessert') },
    { value: 'drink', label: t('categories.drink') },
    { value: 'other', label: t('categories.other') }
  ];

  const getDefaultSalonList = (): PresetItem[] => [
    { name: t('items.tables'), category: 'other', quantity: 4, isRequired: true },
    { name: t('items.chairs'), category: 'other', quantity: 20, isRequired: true },
    { name: t('items.tablecloths'), category: 'other', quantity: 4, isRequired: false },
    { name: t('items.plates'), category: 'other', quantity: 25, isRequired: true },
    { name: t('items.cups'), category: 'other', quantity: 25, isRequired: true },
    { name: t('items.cutlery'), category: 'other', quantity: 25, isRequired: true },
    { name: t('items.trays'), category: 'other', quantity: 5, isRequired: false },
    { name: t('items.waterPitchers'), category: 'drink', quantity: 3, isRequired: true },
    { name: t('items.napkins'), category: 'other', quantity: 50, isRequired: false },
  ];

  const getDefaultParticipantsList = (): PresetItem[] => [
    { name: t('items.challah'), category: 'main', quantity: 2, isRequired: true },
    { name: t('items.redWine'), category: 'drink', quantity: 1, isRequired: true },
    { name: t('items.whiteWine'), category: 'drink', quantity: 1, isRequired: false },
    { name: t('items.greenSalad'), category: 'starter', quantity: 1, isRequired: false },
    { name: t('items.hummus'), category: 'starter', quantity: 1, isRequired: false },
    { name: t('items.tahini'), category: 'starter', quantity: 1, isRequired: false },
    { name: t('items.pitas'), category: 'main', quantity: 10, isRequired: false },
    { name: t('items.cheeses'), category: 'starter', quantity: 1, isRequired: false },
    { name: t('items.fruit'), category: 'dessert', quantity: 1, isRequired: false },
    { name: t('items.cake'), category: 'dessert', quantity: 1, isRequired: false },
    { name: t('items.juice'), category: 'drink', quantity: 2, isRequired: false },
    { name: t('items.water'), category: 'drink', quantity: 2, isRequired: true },
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
      toast.error(t('presetList.form.name'));
      return;
    }

    setIsSubmitting(true);

    try {
      const newList = {
        name: newListName.trim(),
        type: newListType,
        items: selectedItemsForSave && selectedItemsForSave.length > 0
          ? selectedItemsForSave
          : newListType === 'salon' ? getDefaultSalonList() : getDefaultParticipantsList()
      };

      // Pass organizerId to save under specific organizer
      const organizerId = user?.id || authUser?.uid;

      if (!organizerId) {
        toast.error(t('dashboard.general')); // Optimized error
        return null;
      }

      const listId = await FirebaseService.createPresetList(newList, organizerId);

      if (listId) {
        toast.success(t('presetList.form.save') + ` (${newList.items.length})`);
        setShowCreateForm(false);
        setNewListName('');
        onClose(); // Closing the modal
      } else {
        throw new Error(t('dashboard.general'));
      }
    } catch (error: any) {
      console.error('Error creating preset list:', error);
      toast.error(t('dashboard.general'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete preset list
  const handleDeleteList = async (listId: string) => {
    if (listId.startsWith('default-')) {
      toast.error(t('presetList.empty')); // Reusing context or create specific 'cannot delete default'
      return;
    }

    if (!confirm(t('presetList.confirmDelete', { name: presetLists.find(l => l.id === listId)?.name }))) {
      return;
    }

    try {
      const organizerId = user?.id || authUser?.uid;

      if (!organizerId) {
        toast.error('שגיאה: לא זוהה מזהה מארגן');
        return;
      }


      await FirebaseService.deletePresetList(listId, organizerId);
      toast.success(t('presetList.delete'));
    } catch (error: any) {
      console.error('Error deleting preset list:', error);
      toast.error(t('dashboard.general'));
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
        toast.success(t('presetList.form.save'));
        setEditingList(null);
      }
    } catch (error: any) {
      console.error('Error updating preset list:', error);
      toast.error(t('dashboard.general'));
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
          <p className="text-gray-600">{t('dashboard.general')}...</p>
        </div>
      </div>
    );
  }

  if (editingList) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b shrink-0">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className={`rounded-lg p-2 ${editingList.type === 'salon' ? 'bg-purple-100' : 'bg-blue-100'}`}>
                {editingList.type === 'salon' ? (
                  <Home className={`h-5 w-5 ${editingList.type === 'salon' ? 'text-purple-600' : 'text-blue-600'}`} />
                ) : (
                  <Users className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('presetList.edit')}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{editingList.name}</span>
                  {editingList.id.startsWith('default-') && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      {t('presetList.empty')}
                    </span>
                  )}
                </div>
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

          {/* Scrollable Content */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* List Name Input */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('presetList.form.name')}
              </label>
              <input
                type="text"
                value={editingList.name}
                onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:bg-gray-50 disabled:text-gray-500"
                disabled={editingList.id.startsWith('default-')}
              />
            </div>

            {/* Items Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">{t('presetList.title')}</h3>
                {!editingList.id.startsWith('default-') && (
                  <button
                    onClick={addItemToEditingList}
                    disabled={isSubmitting}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 rtl:space-x-reverse shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{t('presetList.form.addItem')}</span>
                  </button>
                )}
              </div>

              {/* Desktop Table Header */}
              <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider rounded-t-lg border border-b-0 border-gray-200">
                <div className="flex-1">{t('importModal.preview.table.name')}</div>
                <div className="w-40">{t('importModal.preview.table.category')}</div>
                <div className="w-24 text-center">{t('importModal.preview.table.quantity')}</div>
                <div className="w-24 text-center">{t('importModal.preview.table.required')}</div>
                <div className="w-10"></div>
              </div>

              <div className="space-y-4 md:space-y-0 md:border md:border-gray-200 md:rounded-b-lg md:divide-y md:divide-gray-200">
                {editingList.items.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row bg-white p-4 md:p-4 gap-4 md:items-start hover:bg-gray-50 transition-colors border border-gray-200 md:border-0 rounded-lg md:rounded-none shadow-sm md:shadow-none">

                    {/* Desktop Layout - Main Row */}
                    <div className="hidden md:flex flex-1 items-start gap-4">
                      {/* Name & Notes Container */}
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItemInEditingList(index, { name: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder={t('importModal.preview.table.name')}
                          disabled={editingList.id.startsWith('default-')}
                        />
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItemInEditingList(index, { notes: e.target.value || undefined })}
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-xs text-gray-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder={t('importModal.preview.table.notes')}
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>

                      {/* Category */}
                      <div className="w-40 pt-0.5">
                        <select
                          value={item.category}
                          onChange={(e) => updateItemInEditingList(index, { category: e.target.value as MenuCategory })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
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
                      <div className="w-24 pt-0.5">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={item.quantity}
                          onChange={(e) => updateItemInEditingList(index, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm text-center focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>

                      {/* Required */}
                      <div className="w-24 flex justify-center pt-2">
                        <input
                          type="checkbox"
                          checked={item.isRequired}
                          onChange={(e) => updateItemInEditingList(index, { isRequired: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>

                      {/* Actions */}
                      <div className="w-10 flex justify-end pt-1">
                        {!editingList.id.startsWith('default-') && (
                          <button
                            onClick={() => removeItemFromEditingList(index)}
                            disabled={isSubmitting}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                            title={t('presetList.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.name')}</label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItemInEditingList(index, { name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-500"
                            disabled={editingList.id.startsWith('default-')}
                          />
                        </div>
                        {!editingList.id.startsWith('default-') && (
                          <button
                            onClick={() => removeItemFromEditingList(index)}
                            className="p-2 text-gray-400 hover:text-red-600 mt-6 disabled:opacity-50"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.category')}</label>
                          <select
                            value={item.category}
                            onChange={(e) => updateItemInEditingList(index, { category: e.target.value as MenuCategory })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
                            disabled={editingList.id.startsWith('default-')}
                          >
                            {categoryOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">{t('importModal.preview.table.quantity')}</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemInEditingList(index, { quantity: parseInt(e.target.value) || 1 })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-center disabled:bg-gray-50 disabled:text-gray-500"
                            disabled={editingList.id.startsWith('default-')}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <label className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isRequired}
                            onChange={(e) => updateItemInEditingList(index, { isRequired: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                            disabled={editingList.id.startsWith('default-')}
                          />
                          <span className="text-sm text-gray-700">{t('importModal.preview.table.required')}</span>
                        </label>
                      </div>

                      <div>
                        <input
                          type="text"
                          value={item.notes || ''}
                          onChange={(e) => updateItemInEditingList(index, { notes: e.target.value || undefined })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 disabled:bg-gray-50 disabled:text-gray-500"
                          placeholder={t('importModal.preview.table.notes')}
                          disabled={editingList.id.startsWith('default-')}
                        />
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 border-t bg-gray-50 rounded-b-xl shrink-0">
            <div className="flex space-x-3 rtl:space-x-reverse">
              {!editingList.id.startsWith('default-') ? (
                <button
                  onClick={() => handleUpdateList(editingList)}
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                      {t('presetList.form.saving')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 ml-2" />
                      {t('presetList.form.save')}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onSelectList(editingList.items)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 rounded-lg font-medium transition-colors flex items-center justify-center shadow-sm"
                >
                  <CheckCircle className="h-4 w-4 ml-2" />
                  {t('presetList.use')}
                </button>
              )}
              <button
                onClick={() => setEditingList(null)}
                disabled={isSubmitting}
                className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-2.5 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {editingList.id.startsWith('default-') ? t('importModal.preview.back') : t('presetList.form.cancel')}
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
              <h2 className="text-lg font-semibold text-gray-900">{t('presetList.title')}</h2>
              <p className="text-sm text-gray-600">{t('importModal.preset.desc')}</p>
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
                <h3 className="font-medium text-blue-800 mb-2">{t('presetList.createNew')}</h3>
                <p className="text-sm text-blue-700">
                  {t('importModal.preset.loadedSuccess', { count: selectedItemsForSave.length })}
                </p>
              </div>
            )}
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <Plus className="h-4 w-4 ml-2" />
                {selectedItemsForSave && selectedItemsForSave.length > 0 ? t('presetList.form.save') : t('presetList.createNew')}
              </button>
            ) : (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('presetList.form.name')}</label>
                    <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder={t('presetList.form.name')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('importModal.preview.table.category')}</label>
                    <select
                      value={newListType}
                      onChange={(e) => setNewListType(e.target.value as 'salon' | 'participants')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                    >
                      <option value="participants">{t('dashboard.eventCard.stats.items', { count: 0, total: 0 }).split(' ')[4] || 'פריטים'}</option>
                      {isAdmin && <option value="salon">{t('categories.other')}</option>}
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
                        {t('presetList.form.saving')}
                      </>
                    ) : (
                      t('presetList.createNew')
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
                    {t('presetList.form.cancel')}
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">{t('presetList.empty')}</h3>
                <p className="text-gray-500">{t('presetList.createNew')}</p>
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
                          {t('importModal.preview.summary.selected', { selected: list.items.length, valid: list.items.length }).replace(/<[^>]*>/g, '')}
                          {list.type === 'salon' && (
                            <span className="text-purple-600 font-medium"> ({t('dashboard.eventCard.admin')})</span>
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
                        <span>{t('presetList.use')}</span>
                      </button>
                      <button
                        onClick={() => setEditingList(list)}
                        className="p-1 text-blue-600 hover:text-blue-700"
                        title={t('presetList.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {!list.id.startsWith('default-') && (
                        <button
                          onClick={() => handleDeleteList(list.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                          title={t('presetList.delete')}
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