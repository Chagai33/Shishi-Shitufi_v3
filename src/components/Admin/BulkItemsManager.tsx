// src/components/Admin/BulkItemsManager.tsx

import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Edit, Trash2, Save, X, CheckSquare, Square, Search, Filter, AlertCircle, CheckCircle, RefreshCw, Slash, Plus, Upload } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, MenuCategory, ShishiEvent, Assignment } from '../../types';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../lib/firebase';
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
    className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-blue-600 text-white shadow'
        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    }`}
  >
    {label}
  </button>
);

function BulkItemsManager({ onBack, event, allEvents = [] }: BulkItemsManagerProps) {
  const { updateMenuItem, deleteMenuItem, deleteAssignment } = useStore();
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

  useEffect(() => {
    const items: EditableItem[] = (allItems || []).map(item => ({
      ...item, isEditing: false, isSelected: false, hasChanges: false, originalData: { ...item }
    }));
    setEditableItems(items);
  }, [allItems]);

  const categoryOptions = [
    { value: 'starter', label: 'מנה ראשונה' }, { value: 'main', label: 'מנה עיקרית' },
    { value: 'dessert', label: 'קינוח' }, { value: 'drink', label: 'שתייה' },
    { value: 'other', label: 'אחר' }
  ];
  
  const assignedOptions = [
      { value: 'all', label: 'כל הפריטים'}, { value: 'assigned', label: 'משובצים'},
      { value: 'unassigned', label: 'לא משובצים'},
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
  const toggleSelectAll = () => { const allSelected = (filteredItems || []).every(item => item.isSelected); const filteredIds = (filteredItems || []).map(item => item.id); setEditableItems(prev => (prev || []).map(item => filteredIds.includes(item.id) ? { ...item, isSelected: !allSelected } : item)); };
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
        notes: item.notes === undefined || item.notes === '' ? null : item.notes, 
        isRequired: item.isRequired 
      };
      // Fix: Pass eventId as first parameter for Multi-Tenant model
      await FirebaseService.updateMenuItem(item.eventId, item.id, updates);
      
      // Update local store
      updateMenuItem(itemId, updates);
      setEditableItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, isEditing: false, hasChanges: false, originalData: { ...i, isEditing: false, hasChanges: false, isSelected: i.isSelected, originalData: i.originalData } } : i
      ));
      toast.success('הפריט עודכן בהצלחה');

    } catch (error) {
      console.error('Error saving item:', error);
      toast.error('שגיאה בשמירת הפריט');
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
            notes: item.notes === undefined || item.notes === '' ? null : item.notes, 
            isRequired: item.isRequired 
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
        toast.success(`${successCount} פריטים עודכנו בהצלחה`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} פריטים נכשלו בעדכון`);
      }
    } catch (error) {
      console.error('Error in saveAllChanges:', error);
      toast.error('שגיאה כללית בשמירת השינויים');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ****** FIX START ******
  const executeBulkAction = async () => {
    const selectedItems = filteredItems.filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      toast.error('יש לבחור פריטים לפעולה');
      return;
    }
    
    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      switch (bulkAction) {
        case 'delete':
          if (!confirm(`האם אתה בטוח שברצונך למחוק ${selectedItems.length} פריטים? הפעולה כוללת מחיקת שיבוצים קיימים.`)) {
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
            toast.error('לא נבחרו פריטים משובצים לביטול.');
            setIsLoading(false);
            return;
          }
          if (!confirm(`האם אתה בטוח שברצונך לבטל ${assignedItemsToCancel.length} שיבוצים?`)) {
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
          case 'delete': successMessage = `${successCount} פריטים נמחקו בהצלחה`; break;
          case 'category': successMessage = `קטגוריה עודכנה עבור ${successCount} פריטים`; break;
          case 'required': successMessage = `סטטוס חובה עודכן עבור ${successCount} פריטים`; break;
          case 'cancel_assignments': successMessage = `בוטלו שיבוצים עבור ${successCount} פריטים`; break;
        }
        toast.success(successMessage);
      }
      if (errorCount > 0) toast.error(`הפעולה נכשלה עבור ${errorCount} פריטים`);

    } catch (error) {
      console.error('Bulk action error:', error);
      toast.error('שגיאה בביצוע הפעולה');
    } finally {
      setIsLoading(false);
      setBulkAction(null);
      setEditableItems(prev => prev.map(item => ({...item, isSelected: false})));
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
      toast.error('יש להזין שם פריט');
      return;
    }

    if (!event) {
      toast.error('יש לבחור אירוע');
      return;
    }

    // Check for duplicates
    const existingItem = editableItems.find(item => 
      item.name.toLowerCase().trim() === newItem.name.toLowerCase().trim() && 
      item.eventId === event.id
    );

    if (existingItem) {
      if (!confirm(`פריט בשם "${newItem.name}" כבר קיים באירוע "${getEventName(event.id)}". האם להוסיף בכל זאת?`)) {
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
        createdAt: Date.now(),
        creatorId: 'admin',
        creatorName: 'Admin'
      };

      const itemId = await FirebaseService.addMenuItem(event.id, itemData);
      if (itemId) {
        toast.success('הפריט נוסף בהצלחה');
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
      toast.error('שגיאה בהוספת הפריט');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAsPreset = async () => {
    const selectedItems = filteredItems.filter(item => item.isSelected);
    if (selectedItems.length === 0) {
      toast.error('יש לבחור פריטים לשמירה');
      return;
    }

    const listName = prompt(`הזן שם לרשימה החדשה (${selectedItems.length} פריטים):`);
    if (!listName || !listName.trim()) {
      toast.error('יש להזין שם לרשימה');
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
        toast.success(`רשימה "${listName.trim()}" נשמרה בהצלחה עם ${presetItems.length} פריטים`);
        // Cancel item selection
        setEditableItems(prev => prev.map(item => ({ ...item, isSelected: false })));
      } else {
        throw new Error('לא התקבל מזהה רשימה');
      }
    } catch (error: any) {
      console.error('Error saving preset list:', error);
      toast.error(error.message || 'שגיאה בשמירת הרשימה');
    } finally {
      setIsLoading(false);
    }
  };

  // The JSX part remains largely the same, only logic was updated.
  // The full component code is returned below for completeness.

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4 rtl:space-x-reverse">
          <button onClick={onBack} className="flex items-center space-x-2 rtl:space-x-reverse text-gray-600 hover:text-gray-900 transition-colors">
            <ArrowRight className="h-4 w-4" />
            <span>חזור</span>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">עריכת פריטים</h1>
            <p className="text-gray-600">{event ? `אירוע: ${event.details.title}` : 'כלל האירועים'}</p>
            <a 
              href="https://www.linkedin.com/in/chagai-yechiel/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              פותח ע"י חגי יחיאל
            </a>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 rtl:space-x-reverse">
          {changedCount > 0 && (
            <button onClick={saveAllChanges} disabled={isLoading} className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center space-x-2 rtl:space-x-reverse transition-colors">
              <Save className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-sm sm:text-base">שמור הכל ({changedCount})</span>
            </button>
          )}
          <button 
            onClick={toggleEditAll} 
            className={`px-3 sm:px-4 py-2 rounded-lg flex items-center space-x-2 rtl:space-x-reverse transition-colors text-sm sm:text-base ${
              editAllMode 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>{editAllMode ? 'בטל עריכה' : 'ערוך הכל'}</span>
          </button>
          <button 
            onClick={() => setShowAddItemForm(true)} 
            className="bg-green-500 hover:bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center space-x-2 rtl:space-x-reverse transition-colors text-sm sm:text-base"
          >
            <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
            <span>הוסף פריט</span>
          </button>
          {event && (
            <button 
              onClick={() => setShowImportModal(true)} 
              className="bg-purple-500 hover:bg-purple-600 text-white px-3 sm:px-4 py-2 rounded-lg flex items-center space-x-2 rtl:space-x-reverse transition-colors text-sm sm:text-base"
            >
              <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>ייבא פריטים</span>
            </button>
          )}
        </div>
      </div>
  
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input type="text" placeholder="חפש פריטים..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-3 py-1.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm" />
              </div>
              
              {!event && (
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <label className="text-xs font-medium text-gray-700 whitespace-nowrap">אירוע:</label>
                    <div className="flex flex-wrap gap-1">
                        <FilterButton label="כל האירועים" isActive={filterEvent === 'all'} onClick={() => setFilterEvent('all')} />
                        {(realtimeEvents || []).map(e => (
                            <FilterButton key={e.id} label={e.details.title} isActive={filterEvent === e.id} onClick={() => setFilterEvent(e.id)} />
                        ))}
                    </div>
                </div>
              )}

              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <label className="text-xs font-medium text-gray-700 whitespace-nowrap">קטגוריה:</label>
                  <div className="flex flex-wrap gap-1">
                      <FilterButton label="הכל" isActive={filterCategory === 'all'} onClick={() => setFilterCategory('all')} />
                      {categoryOptions.map(option => (
                          <FilterButton key={option.value} label={option.label} isActive={filterCategory === option.value} onClick={() => setFilterCategory(option.value)} />
                      ))}
                  </div>
              </div>
              
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <label className="text-xs font-medium text-gray-700 whitespace-nowrap">שיבוץ:</label>
                  <div className="flex flex-wrap gap-1">
                      {assignedOptions.map(option => (
                          <FilterButton key={option.value} label={option.label} isActive={filterAssigned === option.value} onClick={() => setFilterAssigned(option.value)} />
                      ))}
                  </div>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <label className="text-xs font-medium text-gray-700 whitespace-nowrap">נוצר ע"י:</label>
                  <div className="flex flex-wrap gap-1">
                      <FilterButton label="הכל" isActive={filterAddedBy === 'all'} onClick={() => setFilterAddedBy('all')} />
                      <FilterButton label="פריטי מנהלים" isActive={filterAddedBy === 'admin'} onClick={() => setFilterAddedBy('admin')} />
                      <FilterButton label="פריטי משתמשים" isActive={filterAddedBy === 'user'} onClick={() => setFilterAddedBy('user')} />
                  </div>
              </div>
          </div>
      </div>
      
      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800 font-medium">{selectedCount} פריטים נבחרו</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!bulkAction ? (
                <>
                  <button onClick={() => setBulkAction('cancel_assignments')} className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded-md text-xs h-7">בטל שיבוצים</button>
                  <button onClick={() => setBulkAction('category')} className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded-md text-xs h-7">שנה קטגוריה</button>
                  <button onClick={() => setBulkAction('required')} className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded-md text-xs h-7">שנה חובה</button>
                  <button onClick={() => setBulkAction('delete')} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-md text-xs h-7">מחק</button>
                  <button onClick={handleSaveAsPreset} className="bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-md text-xs h-7">שמור כרשימה</button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {bulkAction === 'category' && (<select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value as MenuCategory)} className="px-3 py-1 border border-gray-300 rounded text-sm">{categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>)}
                  {bulkAction === 'required' && (<select value={bulkRequired.toString()} onChange={(e) => setBulkRequired(e.target.value === 'true')} className="px-3 py-1 border border-gray-300 rounded text-sm"><option value="true">חובה</option><option value="false">לא חובה</option></select>)}
                  <button onClick={executeBulkAction} disabled={isLoading} className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white px-3 py-1 rounded-md text-sm h-7">{isLoading ? 'מבצע...' : 'בצע'}</button>
                  <button onClick={() => setBulkAction(null)} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm h-7">ביטול</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
  
      {/* Table */}
      {/* Categorized Items View */}
      <div className="space-y-6">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">לא נמצאו פריטים</h3>
            <p className="text-gray-500">נסה לשנות את הפילטרים או מונחי החיפוש</p>
          </div>
        ) : (
          ['starter', 'main', 'dessert', 'drink', 'other'].map(category => {
            const categoryItems = categorizedItems[category] || [];
            if (categoryItems.length === 0) return null;
            
            const stats = getCategoryStats(categoryItems);
            const categoryLabel = categoryOptions.find(opt => opt.value === category)?.label || category;
            
            return (
              <div key={category} className="bg-white rounded-lg shadow-md overflow-hidden">
                {/* Category Header */}
                <div className="bg-gray-50 px-4 py-3 border-b">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">{categoryLabel}</h3>
                    <div className="flex items-center space-x-4 rtl:space-x-reverse text-sm">
                      <span className="text-gray-600">
                        {stats.total} פריטים
                      </span>
                      <span className="text-green-600 font-medium">
                        {stats.assigned} שובצו
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${stats.total > 0 ? (stats.assigned / stats.total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-right">
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
                            className="flex items-center space-x-2 rtl:space-x-reverse"
                          >
                            {categoryItems.length > 0 && categoryItems.every(item => item.isSelected) ? (
                              <CheckSquare className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="text-xs font-medium text-gray-500 uppercase">בחר</span>
                          </button>
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">שם פריט</th>
                        {!event && (
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">אירוע</th>
                        )}
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">כמות</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">הערות</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">חובה</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">שיבוץ</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {categoryItems.map((item) => {
                        const assignment = getItemAssignment(item.id);
                        return (
                          <tr key={item.id} className={`${item.hasChanges ? 'bg-yellow-50' : ''} ${item.isSelected ? 'bg-blue-50' : ''}`}>
                            <td className="px-4 py-3">
                              <button onClick={() => toggleItemSelection(item.id)} className="flex items-center">
                                {item.isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              {item.isEditing ? (
                                <input 
                                  type="text" 
                                  value={item.name} 
                                  onChange={(e) => updateItemField(item.id, 'name', e.target.value)} 
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm" 
                                />
                              ) : (
                                <span className="font-medium text-gray-900">{item.name}</span>
                              )}
                            </td>
                            {!event && (
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600">{getEventName(item.eventId)}</span>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              {item.isEditing ? (
                                <input 
                                  type="number" 
                                  min="1" 
                                  max="100" 
                                  value={item.quantity} 
                                  onChange={(e) => updateItemField(item.id, 'quantity', parseInt(e.target.value) || 1)} 
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm" 
                                />
                              ) : (
                                <span className="text-sm text-gray-600">{item.quantity}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.isEditing ? (
                                <input 
                                  type="text" 
                                  value={item.notes || ''} 
                                  onChange={(e) => updateItemField(item.id, 'notes', e.target.value || undefined)} 
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm" 
                                />
                              ) : (
                                <span className="text-sm text-gray-600">{item.notes || '-'}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {item.isEditing ? (
                                <input 
                                  type="checkbox" 
                                  checked={item.isRequired} 
                                  onChange={(e) => updateItemField(item.id, 'isRequired', e.target.checked)} 
                                  className="rounded border-gray-300 text-red-600 focus:ring-red-500" 
                                />
                              ) : (
                                <span className={`px-2 py-1 rounded-full text-xs ${item.isRequired ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                  {item.isRequired ? 'חובה' : 'רגיל'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {assignment ? (
                                <div>
                                  <span className="text-sm font-medium text-green-700">{assignment.userName}</span>
                                  <div className="text-xs text-gray-500">משובץ</div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">זמין</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                {item.isEditing ? (
                                  <>
                                    <button 
                                      onClick={() => saveItem(item.id)} 
                                      disabled={!item.hasChanges || isLoading} 
                                      className="p-1 text-green-600 hover:text-green-700 disabled:text-gray-400" 
                                      title="שמור"
                                    >
                                      <Save className="h-4 w-4" />
                                    </button>
                                    <button 
                                      onClick={() => cancelEditing(item.id)} 
                                      className="p-1 text-gray-600 hover:text-gray-700" 
                                      title="ביטול"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button 
                                    onClick={() => startEditing(item.id)} 
                                    className="p-1 text-blue-600 hover:text-blue-700" 
                                    title="ערוך"
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
          <div><p className="text-2xl font-bold text-gray-900">{(filteredItems || []).length}</p><p className="text-sm text-gray-600">פריטים מוצגים</p></div>
          <div><p className="text-2xl font-bold text-blue-600">{selectedCount}</p><p className="text-sm text-gray-600">נבחרו</p></div>
          <div><p className="text-2xl font-bold text-yellow-600">{changedCount}</p><p className="text-sm text-gray-600">עם שינויים</p></div>
          <div><p className="text-2xl font-bold text-green-600">{(filteredItems || []).filter(item => (allAssignments || []).some(a => a.menuItemId === item.id)).length}</p><p className="text-sm text-gray-600">משובצים</p></div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">הוסף פריט חדש</h2>
              <button
                onClick={() => setShowAddItemForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">שם הפריט *</label>
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="שם הפריט"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">קטגוריה</label>
                    <select
                      value={newItem.category}
                      onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value as MenuCategory }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      {categoryOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">כמות</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">הערות</label>
                  <input
                    type="text"
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="הערות נוספות..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newItem.isRequired}
                      onChange={(e) => setNewItem(prev => ({ ...prev, isRequired: e.target.checked }))}
                      className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="mr-2 text-sm text-gray-700">פריט חובה</span>
                  </label>
                </div>
              </div>
              <div className="flex space-x-3 rtl:space-x-reverse mt-6">
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.name.trim() || isLoading}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  {isLoading ? 'מוסיף...' : 'הוסף פריט'}
                </button>
                <button
                  onClick={() => setShowAddItemForm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save as Preset Modal */}
      {/* Preset Lists Manager Modal */}
      {showPresetManager && (
        <PresetListsManager
          onClose={() => setShowPresetManager(false)}
          onSelectList={(items) => {
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
      )}

      {/* Import Items Modal */}
      {showImportModal && event && (
        <ImportItemsModal
          event={event}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

export { BulkItemsManager };