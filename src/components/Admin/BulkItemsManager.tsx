// src/components/Admin/BulkItemsManager.tsx

import { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Edit, Save, X, CheckSquare, Square, Search, AlertCircle, CheckCircle, Plus, Upload, Filter, ChevronDown, ChevronUp, List as ListIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, MenuCategory, ShishiEvent, Assignment } from '../../types';
import { ref, onValue } from 'firebase/database';
import { database } from '../../lib/firebase';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ImportItemsModal } from './ImportItemsModal';
import { PresetListsManager } from './PresetListsManager';

interface BulkItemsManagerProps {
  onBack: () => void;
  event?: ShishiEvent;
  allEvents: ShishiEvent[];
}

interface EditableItem extends MenuItem {
  isEditing: boolean;
  isSelected: boolean;
  hasChanges: boolean;
  originalData: MenuItem;
}

const FilterButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap ${isActive
      ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-100'
      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
      }`}
  >
    {label}
  </button>
);

const MobileItemCard = ({
  item,
  onSelect,
  onEdit,
  isEditing,
  onUpdateField,
  onSave,
  onCancel,
  categoryOptions,
  t
}: {
  item: EditableItem;
  onSelect: () => void;
  onEdit: () => void;
  isEditing: boolean;
  onUpdateField: (field: keyof MenuItem, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  categoryOptions: { value: string; label: string }[];
  t: any;
}) => {
  return (
    <div className={`p-4 border-b border-gray-100 last:border-0 ${item.isSelected ? 'bg-blue-50/30' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onSelect}
          className="mt-1 flex-shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
        >
          {item.isSelected ? (
            <CheckSquare className="h-5 w-5 text-blue-600" />
          ) : (
            <Square className="h-5 w-5" />
          )}
        </button>

        <div className="flex-1 space-y-2">
          {/* Header: Name & Quantity */}
          <div className="flex justify-between items-start">
            {isEditing ? (
              <div className="w-full space-y-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => onUpdateField('name', e.target.value)}
                  className="w-full px-2 py-1 text-sm border-b border-blue-300 focus:border-blue-500 outline-none bg-transparent"
                  placeholder={t('bulkEdit.table.name')}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t('bulkEdit.table.quantity')}:</span>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => onUpdateField('quantity', parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 text-sm border rounded bg-gray-50 text-center"
                  />
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-gray-900">{item.name}</h4>
                <div className="text-xs text-gray-500 mt-0.5">
                  {t('bulkEdit.table.quantity')}: <span className="font-semibold">{item.quantity}</span>
                </div>
              </div>
            )}
            {!isEditing && (
              <button onClick={onEdit} className="p-1 text-gray-400 hover:text-blue-600">
                <Edit className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Body: Category & Options */}
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <select
                value={item.category}
                onChange={(e) => onUpdateField('category', e.target.value as MenuCategory)}
                className="text-xs py-1 px-2 border rounded bg-white"
              >
                {categoryOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <span className={`text-xs px-2 py-0.5 rounded-full ${item.category === 'starter' ? 'bg-orange-100 text-orange-800' :
                item.category === 'main' ? 'bg-blue-100 text-blue-800' :
                  item.category === 'dessert' ? 'bg-pink-100 text-pink-800' :
                    'bg-gray-100 text-gray-800'
                }`}>
                {categoryOptions.find(opt => opt.value === item.category)?.label}
              </span>
            )}

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={item.isRequired}
                onChange={(e) => isEditing && onUpdateField('isRequired', e.target.checked)}
                disabled={!isEditing}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-3 w-3"
              />
              <span className={`text-xs ${item.isRequired ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                {t('bulkEdit.table.required')}
              </span>
            </label>
          </div>

          {/* Footer: Notes & Actions */}
          {isEditing ? (
            <div className="space-y-2 mt-2 pt-2 border-t border-dashed border-gray-100">
              <input
                type="text"
                value={item.notes || ''}
                onChange={(e) => onUpdateField('notes', e.target.value)}
                className="w-full text-xs px-2 py-1 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 placeholder-yellow-800/50 focus:ring-1 focus:ring-yellow-400 outline-none"
                placeholder={t('bulkEdit.table.notes')}
              />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onCancel} className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={onSave} className="p-1.5 rounded bg-blue-600 text-white hover:bg-blue-700">
                  <Save className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            item.notes && (
              <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 mt-1">
                {item.notes}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};


function BulkItemsManager({ onBack, event, allEvents = [] }: BulkItemsManagerProps) {
  const { t } = useTranslation();
  const { updateMenuItem, deleteAssignment } = useStore();
  const [realtimeEvents, setRealtimeEvents] = useState<ShishiEvent[]>(allEvents);

  // Set up real-time listeners for all events
  useEffect(() => {
    if (!allEvents || allEvents.length === 0) return;

    const unsubscribers: (() => void)[] = [];

    // Listen to each event for real-time updates
    allEvents.forEach(eventData => {
      const eventRef = ref(database, `events/${eventData.id}`);

      const unsubscribe = onValue(eventRef, (snapshot) => {
        if (snapshot.exists()) {
          const updatedEventData = snapshot.val();
          const fullEvent: ShishiEvent = {
            id: eventData.id,
            ...updatedEventData
          };

          // Update the specific event in realtimeEvents
          setRealtimeEvents(prev =>
            prev.map(e => e.id === eventData.id ? fullEvent : e)
          );
        }
      });

      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [allEvents]);

  const allItems = useMemo(() => {
    if (!realtimeEvents) return [];
    return realtimeEvents.flatMap(e =>
      e.menuItems ? Object.entries(e.menuItems).map(([id, itemData]) => ({
        ...(itemData as Omit<MenuItem, 'id' | 'eventId'>),
        id,
        eventId: e.id,
      })) : []
    );
  }, [realtimeEvents]);

  // Get all assignments from all events
  const allAssignments = useMemo(() => {
    if (!realtimeEvents) return [];
    return realtimeEvents.flatMap(e =>
      e.assignments ? Object.entries(e.assignments).map(([id, assignmentData]) => ({
        ...(assignmentData as Omit<Assignment, 'id'>),
        id,
      })) : []
    );
  }, [realtimeEvents]);

  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>(event?.id || 'all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');
  const [filterAddedBy, setFilterAddedBy] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [bulkAction, setBulkAction] = useState<'delete' | 'category' | 'required' | 'cancel_assignments' | null>(null);
  const [bulkCategory, setBulkCategory] = useState<MenuCategory>('main');
  const [bulkRequired, setBulkRequired] = useState(false);
  const [editAllMode, setEditAllMode] = useState(false);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPresetManager, setShowPresetManager] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'main' as MenuCategory,
    quantity: 1,
    notes: '',
    isRequired: false
  });

  const [showFilters, setShowFilters] = useState(false);
  const activeFiltersCount = [
    filterEvent !== 'all',
    filterCategory !== 'all',
    filterAssigned !== 'all',
    filterAddedBy !== 'all'
  ].filter(Boolean).length;

  useEffect(() => {
    const items: EditableItem[] = (allItems || []).map(item => ({
      ...item, isEditing: false, isSelected: false, hasChanges: false, originalData: { ...item }
    }));
    setEditableItems(items);
  }, [allItems]);

  const categoryOptions = [
    { value: 'starter', label: t('categories.starter') }, { value: 'main', label: t('categories.main') },
    { value: 'dessert', label: t('categories.dessert') }, { value: 'drink', label: t('categories.drink') },
    { value: 'other', label: t('categories.other') }
  ];

  const assignedOptions = [
    { value: 'all', label: t('bulkEdit.filters.allOf') }, { value: 'assigned', label: t('bulkEdit.filters.assigned') },
    { value: 'unassigned', label: t('bulkEdit.filters.unassigned') },
  ];

  const filteredItems = useMemo(() => {
    return (editableItems || []).filter(item => {
      if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterEvent !== 'all' && item.eventId !== filterEvent) return false;
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;
      const isItemAssigned = (allAssignments || []).some(a => a.menuItemId === item.id);
      if (filterAssigned === 'assigned' && !isItemAssigned) return false;
      if (filterAssigned === 'unassigned' && isItemAssigned) return false;
      if (filterAddedBy !== 'all') {
        const eventData = realtimeEvents.find(e => e.id === item.eventId);
        if (!eventData) return false; // If event not found, hide the item
        const isAdminItem = item.creatorId === eventData.organizerId;
        if (filterAddedBy === 'user' && isAdminItem) return false;
        if (filterAddedBy === 'admin' && !isAdminItem) return false;
      }
      return true;
    });
  }, [editableItems, searchTerm, filterEvent, filterCategory, filterAssigned, filterAddedBy, allAssignments, realtimeEvents]);

  // Group items by category in the desired order
  const categorizedItems = useMemo(() => {
    const categories = ['starter', 'main', 'dessert', 'drink', 'other'];
    const grouped: { [key: string]: EditableItem[] } = {};

    categories.forEach(category => {
      grouped[category] = filteredItems.filter(item => item.category === category);
    });

    return grouped;
  }, [filteredItems]);

  const getCategoryStats = (categoryItems: EditableItem[]) => {
    const assigned = categoryItems.filter(item =>
      (allAssignments || []).some(a => a.menuItemId === item.id)
    ).length;
    return { total: categoryItems.length, assigned };
  };
  const selectedCount = (filteredItems || []).filter(item => item.isSelected).length;
  const changedCount = (editableItems || []).filter(item => item.hasChanges).length;

  const toggleItemSelection = (itemId: string) => { setEditableItems(prev => (prev || []).map(item => item.id === itemId ? { ...item, isSelected: !item.isSelected } : item)); };

  const startEditing = (itemId: string) => { setEditableItems(prev => (prev || []).map(item => item.id === itemId ? { ...item, isEditing: true } : item)); };
  const cancelEditing = (itemId: string) => { setEditableItems(prev => (prev || []).map(item => item.id === itemId ? { ...item.originalData, isEditing: false, isSelected: item.isSelected, hasChanges: false, originalData: item.originalData } : item)); };
  const updateItemField = (itemId: string, field: keyof MenuItem, value: any) => {
    setEditableItems(prev => (prev || []).map(item => {
      if (item.id === itemId) {
        // Convert undefined to null for Firebase compatibility
        const sanitizedValue = value === undefined || value === '' ? null : value;
        const updatedItem = { ...item, [field]: sanitizedValue };
        const originalForComparison = { ...item.originalData };
        const currentForComparison = { ...updatedItem };
        delete (currentForComparison as any).isEditing;
        delete (currentForComparison as any).isSelected;
        delete (currentForComparison as any).hasChanges;
        delete (currentForComparison as any).originalData;
        const hasChanges = JSON.stringify(originalForComparison) !== JSON.stringify(currentForComparison);
        return { ...updatedItem, hasChanges };
      }
      return item;
    }));
  };

  // ****** FIX START ******
  const saveItem = async (itemId: string) => {
    const item = editableItems.find(i => i.id === itemId);
    if (!item || !item.hasChanges) return;

    setIsLoading(true);
    try {
      // Sanitize updates to convert undefined/empty strings to null
      const updates = {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        notes: (item.notes === undefined || item.notes === '') ? null : item.notes as any,
        isRequired: item.isRequired,
        isSplittable: item.quantity > 1 // Auto-calculated
      };
      // Fix: Pass eventId as first parameter for Multi-Tenant model
      await FirebaseService.updateMenuItem(item.eventId, item.id, updates);

      // Update local store
      updateMenuItem(itemId, updates);
      setEditableItems(prev => prev.map(i =>
        i.id === itemId ? { ...i, isEditing: false, hasChanges: false, originalData: { ...i, isEditing: false, hasChanges: false, isSelected: i.isSelected, originalData: i.originalData } } : i
      ));
      toast.success(t('bulkEdit.messages.itemUpdated'));

    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(t('bulkEdit.messages.errorUpdating'));
    } finally {
      setIsLoading(false);
    }
  };
  // ****** FIX END ******

  const saveAllChanges = async () => {
    const changedItems = editableItems.filter(item => item.hasChanges);
    if (changedItems.length === 0) return;

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of changedItems) {
        try {
          // Sanitize updates to convert undefined/empty strings to null
          const updates = {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            notes: (item.notes === undefined || item.notes === '') ? null : item.notes as any,
            isRequired: item.isRequired,
            isSplittable: item.quantity > 1 // Auto-calculated
          };

          await FirebaseService.updateMenuItem(item.eventId, item.id, updates);
          updateMenuItem(item.id, updates);
          successCount++;
        } catch (error) {
          console.error(`Error updating item ${item.id}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setEditableItems(prev => prev.map(item => {
          if (changedItems.some(changed => changed.id === item.id)) {
            return { ...item, isEditing: false, hasChanges: false, originalData: { ...item, isEditing: false, hasChanges: false, isSelected: item.isSelected, originalData: item.originalData } };
          }
          return item;
        }));
        toast.success(t('bulkEdit.messages.itemsUpdated', { count: successCount }));
      }
      if (errorCount > 0) {
        toast.error(t('bulkEdit.messages.itemsUpdateFailed', { count: errorCount }));
      }
    } catch (error) {
      console.error('Error in saveAllChanges:', error);
      toast.error(t('bulkEdit.messages.errorGeneral'));
    } finally {
      setIsLoading(false);
    }
  };

  // ****** FIX START ******
  const executeBulkAction = async () => {
    const selectedItems = filteredItems.filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      toast.error(t('bulkEdit.messages.selectAction'));
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      switch (bulkAction) {
        case 'delete':
          if (!confirm(t('bulkEdit.messages.confirmDelete', { count: selectedItems.length }))) {
            setIsLoading(false);
            return;
          }
          const deletedItemIds = new Set<string>();
          for (const item of selectedItems) {
            try {
              await FirebaseService.deleteMenuItem(item.eventId, item.id);
              deletedItemIds.add(item.id);
              successCount++;
            } catch (error) { errorCount++; }
          }
          if (deletedItemIds.size > 0) {
            setEditableItems(prev => prev.filter(item => !deletedItemIds.has(item.id)));
          }
          break;

        case 'cancel_assignments':
          const assignedItemsToCancel = selectedItems.filter(item => allAssignments.some(a => a.menuItemId === item.id));
          if (assignedItemsToCancel.length === 0) {
            toast.error(t('bulkEdit.messages.noAssignedToCancel'));
            setIsLoading(false);
            return;
          }
          if (!confirm(t('bulkEdit.messages.confirmCancelAssignments', { count: assignedItemsToCancel.length }))) {
            setIsLoading(false);
            return;
          }

          for (const item of assignedItemsToCancel) {
            const itemAssignments = allAssignments.filter(a => a.menuItemId === item.id);

            for (const assignment of itemAssignments) {
              try {
                await FirebaseService.cancelAssignment(item.eventId, assignment.id, item.id);

                // Update local store - remove assignment
                deleteAssignment(assignment.id);

                // Update the item in local state to show as unassigned
                setEditableItems(prev => prev.map(editItem =>
                  editItem.id === item.id
                    ? { ...editItem, assignedTo: undefined, assignedToName: undefined, assignedAt: undefined }
                    : editItem
                ));

                successCount++;
              } catch (error) {
                console.error(`❌ Error canceling assignment ${assignment.id}:`, error);
                errorCount++;
              }
            }
          }
          break;

        case 'category':
          for (const item of selectedItems) {
            try {
              await FirebaseService.updateMenuItem(item.eventId, item.id, { category: bulkCategory });
              updateMenuItem(item.id, { category: bulkCategory });
              successCount++;
            } catch (error) {
              console.error('Error updating category:', error);
              errorCount++;
            }
          }
          break;

        case 'required':
          for (const item of selectedItems) {
            try {
              await FirebaseService.updateMenuItem(item.eventId, item.id, { isRequired: bulkRequired });
              updateMenuItem(item.id, { isRequired: bulkRequired });
              successCount++;
            } catch (error) {
              console.error('Error updating required status:', error);
              errorCount++;
            }
          }
          break;
      }

      if (successCount > 0) {
        let successMessage = '';
        switch (bulkAction) {
          case 'delete': successMessage = t('bulkEdit.messages.successDelete', { count: successCount }); break;
          case 'category': successMessage = t('bulkEdit.messages.successCategory', { count: successCount }); break;
          case 'required': successMessage = t('bulkEdit.messages.successRequired', { count: successCount }); break;
          case 'cancel_assignments': successMessage = t('bulkEdit.messages.successCancelAssignments', { count: successCount }); break;
        }
        toast.success(successMessage);
      }
      if (errorCount > 0) toast.error(t('bulkEdit.messages.failure', { count: errorCount }));

    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error(t('bulkEdit.messages.error'));
    } finally {
      setIsLoading(false);
      setBulkAction(null);
      setEditableItems(prev => prev.map(item => ({ ...item, isSelected: false })));
    }
  };
  // ****** FIX END ******

  const getEventName = (eventId: string) => {
    const event = (realtimeEvents || []).find(e => e.id === eventId);
    return event ? event.details.title : 'אירוע לא ידוע';
  };
  const getItemAssignment = (itemId: string) => { return (allAssignments || []).find(a => a.menuItemId === itemId); };

  const toggleEditAll = () => {
    if (editAllMode) {
      // Exit edit mode - cancel all changes
      setEditableItems(prev => prev.map(item => ({
        ...item.originalData,
        isEditing: false,
        isSelected: item.isSelected,
        hasChanges: false,
        originalData: item.originalData
      })));
    } else {
      // Enter edit mode - open all items for editing
      setEditableItems(prev => prev.map(item => ({
        ...item,
        isEditing: true
      })));
    }
    setEditAllMode(!editAllMode);
  };

  const handleAddItem = async () => {
    if (!newItem.name.trim()) {
      toast.error(t('bulkEdit.messages.enterItemName'));
      return;
    }

    if (!event) {
      toast.error(t('bulkEdit.messages.selectEvent'));
      return;
    }

    // Check for duplicates
    const existingItem = editableItems.find(item =>
      item.name.toLowerCase().trim() === newItem.name.toLowerCase().trim() &&
      item.eventId === event.id
    );

    if (existingItem) {
      if (!confirm(t('bulkEdit.messages.duplicateItem', { name: newItem.name, event: getEventName(event.id) }))) {
        return;
      }
    }

    setIsLoading(true);
    try {
      const itemData = {
        name: newItem.name.trim(),
        category: newItem.category,
        quantity: newItem.quantity,
        notes: newItem.notes.trim() || undefined,
        isRequired: newItem.isRequired,
        isSplittable: newItem.quantity > 1, // Auto-calculated
        createdAt: Date.now(),
        creatorId: 'admin',
        creatorName: 'Admin',
        eventId: event.id
      };

      const itemId = await FirebaseService.addMenuItem(event.id, itemData);
      if (itemId) {
        toast.success(t('bulkEdit.messages.itemAdded'));
        setShowAddItemForm(false);
        setNewItem({
          name: '',
          category: 'main',
          quantity: 1,
          notes: '',
          isRequired: false
        });
      }
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error(t('bulkEdit.messages.errorAdding'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsPreset = async () => {
    const selectedItems = filteredItems.filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      toast.error(t('bulkEdit.messages.selectToSave'));
      return;
    }

    const listName = prompt(t('bulkEdit.messages.enterListName', { count: selectedItems.length }));
    if (!listName || !listName.trim()) {
      toast.error(t('bulkEdit.messages.enterListNameError'));
      return;
    }

    setIsLoading(true);
    try {
      // Clean undefined values from items
      const presetItems = selectedItems.map(item => ({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes || undefined, // Convert null to undefined, then remove it
        isRequired: item.isRequired
      })).map(item => {
        // Remove fields with undefined values
        const cleanItem: any = { ...item };
        if (cleanItem.notes === undefined || cleanItem.notes === null || cleanItem.notes === '') {
          delete cleanItem.notes;
        }
        return cleanItem;
      });

      const listData = {
        name: listName.trim(),
        type: 'participants' as const,
        items: presetItems
      };

      const listId = await FirebaseService.createPresetList(listData);

      if (listId) {
        toast.success(t('bulkEdit.messages.listSaved', { name: listName.trim(), count: presetItems.length }));
        // Cancel item selection
        setEditableItems(prev => prev.map(item => ({ ...item, isSelected: false })));
      } else {
        throw new Error(t('dashboard.general'));
      }
    } catch (error: any) {
      console.error('Error saving preset list:', error);
      toast.error(error.message || t('bulkEdit.messages.errorSavingList'));
    } finally {
      setIsLoading(false);
    }
  };

  // The JSX part remains largely the same, only logic was updated.
  // The full component code is returned below for completeness.

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <button onClick={onBack} className="flex items-center space-x-2 rtl:space-x-reverse text-gray-500 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('bulkEdit.title')}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
                {event ? event.details.title : t('bulkEdit.filters.allEvents')}
              </span>

            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {changedCount > 0 && (
            <button onClick={saveAllChanges} disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md flex items-center space-x-2 rtl:space-x-reverse transition-all font-medium active:scale-95">
              <Save className="h-4 w-4" />
              <span>{t('bulkEdit.saveAll')} ({changedCount})</span>
            </button>
          )}
          <button
            onClick={toggleEditAll}
            className={`px-5 py-2.5 rounded-xl flex items-center space-x-2 rtl:space-x-reverse transition-all font-medium shadow-sm hover:shadow active:scale-95 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${editAllMode
              ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
              : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
              }`}
          >
            <Edit className="h-4 w-4" />
            <span>{editAllMode ? t('bulkEdit.cancelEdit') : t('bulkEdit.editAll')}</span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddItemForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg flex items-center space-x-2 rtl:space-x-reverse transition-all font-medium active:scale-95 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4" />
              <span>{t('bulkEdit.addSingleItem')}</span>
            </button>

            <button
              onClick={() => setShowPresetManager(true)}
              className="bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow flex items-center space-x-2 rtl:space-x-reverse transition-all font-medium active:scale-95"
            >
              <ListIcon className="h-4 w-4" />
              <span>{t('bulkEdit.presetList')}</span>
            </button>

            {event && (
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-white hover:bg-purple-50 text-purple-600 border border-purple-200 px-4 py-2.5 rounded-xl shadow-sm hover:shadow flex items-center space-x-2 rtl:space-x-reverse transition-all font-medium active:scale-95"
              >
                <Upload className="h-4 w-4" />
                <span>{t('bulkEdit.import')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        {/* Search & Filter Toggle */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={t('bulkEdit.filters.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border-transparent focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all text-sm outline-none"
            />
            <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border transition-all text-sm font-medium ${showFilters || activeFiltersCount > 0
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Filter className="h-4 w-4" />
            <span>{t('bulkEdit.filters.filter')}</span>
            {activeFiltersCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Collapsible Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50/50 rounded-xl p-4 border border-gray-100 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {!event && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                    {t('bulkEdit.filters.event')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <FilterButton label={t('bulkEdit.filters.allEvents')} isActive={filterEvent === 'all'} onClick={() => setFilterEvent('all')} />
                    {(realtimeEvents || []).map(e => (
                      <FilterButton key={e.id} label={e.details.title} isActive={filterEvent === e.id} onClick={() => setFilterEvent(e.id)} />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('bulkEdit.filters.category')}</label>
                <div className="flex flex-wrap gap-2">
                  <FilterButton label={t('bulkEdit.filters.all')} isActive={filterCategory === 'all'} onClick={() => setFilterCategory('all')} />
                  {categoryOptions.map(option => (
                    <FilterButton key={option.value} label={option.label} isActive={filterCategory === option.value} onClick={() => setFilterCategory(option.value)} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('bulkEdit.filters.assignment')}</label>
                <div className="flex flex-wrap gap-2">
                  {assignedOptions.map(option => (
                    <FilterButton key={option.value} label={option.label} isActive={filterAssigned === option.value} onClick={() => setFilterAssigned(option.value)} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('bulkEdit.filters.createdBy')}</label>
                <div className="flex flex-wrap gap-2">
                  <FilterButton label={t('bulkEdit.filters.all')} isActive={filterAddedBy === 'all'} onClick={() => setFilterAddedBy('all')} />
                  <FilterButton label={t('bulkEdit.filters.admin')} isActive={filterAddedBy === 'admin'} onClick={() => setFilterAddedBy('admin')} />
                  <FilterButton label={t('bulkEdit.filters.users')} isActive={filterAddedBy === 'user'} onClick={() => setFilterAddedBy('user')} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}


      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 mb-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="bg-blue-100 p-2 rounded-full">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-blue-900 font-semibold">{t('bulkEdit.actions.selected', { count: selectedCount })}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!bulkAction ? (
                <>
                  <button onClick={() => setBulkAction('cancel_assignments')} className="bg-white hover:bg-yellow-50 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm">{t('bulkEdit.actions.cancelAssignments')}</button>
                  <button onClick={() => setBulkAction('category')} className="bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm">{t('bulkEdit.actions.changeCategory')}</button>
                  <button onClick={() => setBulkAction('required')} className="bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm">{t('bulkEdit.actions.changeRequired')}</button>
                  <button onClick={() => setBulkAction('delete')} className="bg-white hover:bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm icon-delete">{t('bulkEdit.actions.delete')}</button>
                  <button onClick={handleSaveAsPreset} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm">{t('bulkEdit.actions.saveAsList')}</button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
                  {bulkAction === 'category' && (<select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as MenuCategory)} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm outline-none shadow-sm text-gray-900">{categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
                  {bulkAction === 'required' && (<select value={bulkRequired.toString()} onChange={(e) => setBulkRequired(e.target.value === 'true')} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-sm outline-none shadow-sm text-gray-900"><option value="true">{t('importModal.preview.table.yes')}</option><option value="false">{t('importModal.preview.table.no')}</option></select>)}
                  <button onClick={executeBulkAction} disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm">{isLoading ? '...' : t('bulkEdit.actions.execute')}</button>
                  <button onClick={() => setBulkAction(null)} className="text-gray-500 hover:text-gray-700 px-3 py-1.5 text-sm font-medium">{t('bulkEdit.actions.cancel')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {/* Categorized Items View */}
      <div className="space-y-8">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-16 text-center">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('bulkEdit.table.noItems')}</h3>
            <p className="text-gray-500 max-w-sm mx-auto">{t('bulkEdit.table.noItemsDesc')}</p>
          </div>
        ) : (
          ['starter', 'main', 'dessert', 'drink', 'other'].map(category => {
            const categoryItems = categorizedItems[category] || [];
            if (categoryItems.length === 0) return null;

            const stats = getCategoryStats(categoryItems);
            const categoryLabel = categoryOptions.find(opt => opt.value === category)?.label || category;

            return (
              <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Category Header */}
                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className={`w-2 h-6 rounded-full ${category === 'starter' ? 'bg-orange-400' :
                        category === 'main' ? 'bg-blue-400' :
                          category === 'dessert' ? 'bg-pink-400' :
                            'bg-gray-400'
                        }`}></span>
                      {categoryLabel}
                    </h3>
                    <div className="flex items-center space-x-6 rtl:space-x-reverse text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <span className="font-medium text-gray-900">{stats.total}</span> {t('bulkEdit.table.items')}
                      </div>
                      <div className="flex items-center gap-2 text-green-600">
                        <span className="font-medium">{stats.assigned}</span> {t('bulkEdit.filters.assigned')}
                      </div>
                      <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-500 h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${stats.total > 0 ? (stats.assigned / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items View - Table (Desktop) / Cards (Mobile) */}

                {/* Mobile: Cards List */}
                <div className="md:hidden divide-y divide-gray-100">
                  {categoryItems.map((item) => (
                    <MobileItemCard
                      key={item.id}
                      item={item}
                      onSelect={() => toggleItemSelection(item.id)}
                      onEdit={() => startEditing(item.id)}
                      isEditing={item.isEditing}
                      onUpdateField={(field, value) => updateItemField(item.id, field, value)}
                      onSave={() => saveItem(item.id)}
                      onCancel={() => cancelEditing(item.id)}
                      categoryOptions={categoryOptions}
                      t={t}
                    />
                  ))}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block overflow-x-auto">

                  <table className="w-full relative">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-3 text-right w-12 bg-gray-50">
                          <button
                            onClick={() => {
                              const allCategorySelected = categoryItems.every(item => item.isSelected);
                              const categoryIds = categoryItems.map(item => item.id);
                              setEditableItems(prev => prev.map(item =>
                                categoryIds.includes(item.id)
                                  ? { ...item, isSelected: !allCategorySelected }
                                  : item
                              ));
                            }}
                            className="flex items-center justify-center p-1 rounded hover:bg-gray-200 transition-colors"
                          >
                            {categoryItems.length > 0 && categoryItems.every(item => item.isSelected) ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">{t('bulkEdit.table.name')}</th>
                        {!event && (
                          <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">{t('bulkEdit.table.event')}</th>
                        )}
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 bg-gray-50">{t('bulkEdit.table.quantity')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">{t('bulkEdit.table.notes')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24 bg-gray-50">{t('bulkEdit.table.required')}</th>
                        <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28 bg-gray-50">{t('bulkEdit.table.splittable')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">{t('bulkEdit.table.assignment')}</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-20 bg-gray-50"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-50">
                      {categoryItems.map((item) => {
                        const assignment = getItemAssignment(item.id);
                        return (
                          <tr key={item.id} className={`group transition-colors ${item.hasChanges ? 'bg-orange-50/30' : item.isSelected ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}`}>
                            <td className="px-6 py-4">
                              <button onClick={() => toggleItemSelection(item.id)} className="flex items-center justify-center text-gray-400 hover:text-blue-600 transition-colors">
                                {item.isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Square className="h-5 w-5 text-gray-300 group-hover:text-gray-400" />
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4">
                              {item.isEditing ? (
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateItemField(item.id, 'name', e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm bg-gray-50 border-transparent focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all outline-none"
                                  placeholder={t('bulkEdit.table.name')}
                                />
                              ) : (
                                <span className="font-medium text-gray-900">{item.name}</span>
                              )}
                            </td>
                            {!event && (
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {getEventName(item.eventId)}
                              </td>
                            )}
                            <td className="px-6 py-4">
                              {item.isEditing ? (
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-full px-3 py-1.5 text-sm bg-gray-50 border-transparent focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all outline-none text-center"
                                />
                              ) : (
                                <div className="text-center font-medium text-gray-700">{item.quantity}</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {item.isEditing ? (
                                <input
                                  type="text"
                                  value={item.notes || ''}
                                  onChange={(e) => updateItemField(item.id, 'notes', e.target.value)}
                                  className="w-full px-3 py-1.5 text-sm bg-gray-50 border-transparent focus:bg-white focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all outline-none placeholder-gray-400"
                                  placeholder={t('bulkEdit.table.addNote')}
                                />
                              ) : (
                                item.notes && (
                                  <span className="inline-block px-2 py-1 text-xs text-amber-700 bg-amber-50 rounded border border-amber-100 max-w-[200px] truncate" title={item.notes}>
                                    {item.notes}
                                  </span>
                                )
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.isEditing ? (
                                <div className="flex justify-center">
                                  <input
                                    type="checkbox"
                                    checked={item.isRequired}
                                    onChange={(e) => updateItemField(item.id, 'isRequired', e.target.checked)}
                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 h-4 w-4"
                                  />
                                </div>
                              ) : (
                                item.isRequired && <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{t('bulkEdit.table.required')}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {/* Auto-calculated, just display */}
                              {item.quantity > 1 ? (
                                <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{t('importModal.preview.table.yes')}</span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {assignment ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{assignment.userName}</p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400 font-light px-2 py-0.5 border border-dashed border-gray-300 rounded text-center block w-max">פנוי</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-left">
                              <div className="flex items-center justify-end space-x-2 rtl:space-x-reverse opacity-0 group-hover:opacity-100 transition-opacity">
                                {item.isEditing ? (
                                  <>
                                    <button
                                      onClick={() => saveItem(item.id)}
                                      disabled={!item.hasChanges || isLoading}
                                      className="p-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:ring-2 focus:ring-green-500"
                                      title="שמור"
                                      aria-label="שמור שינויים"
                                    >
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => cancelEditing(item.id)}
                                      className="p-2 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-gray-500"
                                      title="ביטול"
                                      aria-label="בטל עריכה"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    onClick={() => startEditing(item.id)}
                                    className="p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all focus:ring-2 focus:ring-blue-500"
                                    title="ערוך"
                                    aria-label="ערוך פריט"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
          <div><p className="text-2xl font-bold text-gray-900">{(filteredItems || []).length}</p><p className="text-sm text-gray-600">{t('bulkEdit.stats.itemsDisplayed')}</p></div>
          <div><p className="text-2xl font-bold text-blue-600">{selectedCount}</p><p className="text-sm text-gray-600">{t('bulkEdit.stats.selected')}</p></div>
          <div><p className="text-2xl font-bold text-yellow-600">{changedCount}</p><p className="text-sm text-gray-600">{t('bulkEdit.stats.withChanges')}</p></div>
          <div><p className="text-2xl font-bold text-green-600">{(filteredItems || []).filter(item => (allAssignments || []).some(a => a.menuItemId === item.id)).length}</p><p className="text-sm text-gray-600">{t('bulkEdit.stats.assigned')}</p></div>
        </div>
      </div>

      {/* Add Item Modal */}
      {
        showAddItemForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all overflow-hidden border border-gray-100">
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-bold text-gray-900">הוספת פריט חדש</h2>
                <button
                  onClick={() => setShowAddItemForm(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded-full"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">שם הפריט <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="לדוגמה: פשטידת גבינות"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-500"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">קטגוריה</label>
                      <div className="relative">
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value as MenuCategory }))}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none appearance-none bg-white text-gray-900"
                        >
                          {categoryOptions.map(option => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">כמות</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={newItem.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setNewItem(prev => ({
                            ...prev,
                            quantity: val
                            // isSplittable auto-calculated
                          }));
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">הערות</label>
                    <input
                      type="text"
                      value={newItem.notes}
                      onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="הערות נוספות (אופציונלי)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-gray-900 placeholder-gray-500"
                    />
                  </div>

                  <div className="flex gap-4 pt-2">
                    <label className={`flex-1 flex items-center p-4 rounded-xl border cursor-pointer transition-all ${newItem.isRequired ? 'bg-red-50 border-red-200 ring-1 ring-red-200' : 'bg-gray-50 border-gray-200 hover:bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={newItem.isRequired}
                        onChange={(e) => setNewItem(prev => ({ ...prev, isRequired: e.target.checked }))}
                        className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div className="mr-3">
                        <span className={`block text-sm font-bold ${newItem.isRequired ? 'text-red-800' : 'text-gray-700'}`}>פריט חובה</span>
                        <span className="text-xs text-gray-500">האם חובה להביא?</span>
                      </div>
                    </label>

                    {newItem.quantity > 1 && (
                      <div className="flex-1 flex items-center p-4 rounded-xl border border-blue-200 bg-blue-50 ring-1 ring-blue-200 transition-all">
                        <div className="mr-3">
                          <span className="block text-sm font-bold text-blue-900">ניתן לחלוקה</span>
                          <span className="text-xs text-blue-700">יוגדר אוטומטית כי הכמות {'>'} 1</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex space-x-4 rtl:space-x-reverse mt-8">
                  <button
                    onClick={handleAddItem}
                    disabled={!newItem.name.trim() || isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-3.5 px-6 rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    {isLoading ? 'מוסיף...' : 'הוסף פריט'}
                  </button>
                  <button
                    onClick={() => setShowAddItemForm(false)}
                    className="px-6 py-3.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Save as Preset Modal */}
      {/* Preset Lists Manager Modal */}
      {
        showPresetManager && (
          <PresetListsManager
            onClose={() => setShowPresetManager(false)}
            onSelectList={() => {
              // Do nothing when selecting list - this is only for saving purposes
              setShowPresetManager(false);
              // Cancel item selection after saving
              setEditableItems(prev => prev.map(item => ({ ...item, isSelected: false })));
              toast.success('הרשימה נשמרה בהצלחה!');
            }}
            selectedItemsForSave={filteredItems.filter(item => item.isSelected).map(item => ({
              name: item.name,
              category: item.category,
              quantity: item.quantity,
              notes: item.notes,
              isRequired: item.isRequired
            }))}
          />
        )
      }

      {/* Import Items Modal */}
      {
        showImportModal && event && (
          <ImportItemsModal
            event={event!}
            onClose={() => setShowImportModal(false)}
            onAddSingleItem={() => {
              console.log('BulkItemsManager: onAddSingleItem triggered. Closing import modal and opening add item form.');
              setShowImportModal(false);
              console.log('BulkItemsManager: Setting showAddItemForm to true');
              setShowAddItemForm(true);
            }}
          />
        )
      }
    </div >
  );
}

export { BulkItemsManager };