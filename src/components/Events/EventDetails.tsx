import React, { useState, useMemo, useEffect } from 'react';
import { ArrowRight, Calendar, Clock, MapPin, Users, ChefHat, Plus, Phone, Mail, RefreshCw, Settings } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { MenuItemCard } from './MenuItemCard';
import { AssignmentModal } from './AssignmentModal';
import { EditAssignmentModal } from './EditAssignmentModal';
import { UserInfoModal } from './UserInfoModal';
import { BulkItemsManager } from '../Admin/BulkItemsManager';
import { UserMenuItemForm } from './UserMenuItemForm'; // 1. Importing the new component
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, Assignment } from '../../types';
import { formatDate, formatTime, isEventPast, isEventFinished } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

interface EventDetailsProps {
  event: ShishiEvent;
  onBack: () => void;
}

export function EventDetails({ event, onBack }: EventDetailsProps) {
  const { user, menuItems, assignments, deleteAssignment, updateMenuItem } = useStore();
  const { isAdmin } = useAuth();
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ item: MenuItem; assignment: Assignment } | null>(null);
  const [showUserInfo, setShowUserInfo] = useState(false);
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [showUserItemForm, setShowUserItemForm] = useState(false); // 2. Adding State for the new form
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const eventMenuItems = useMemo(() => 
    menuItems.filter(item => item.eventId === event.id),
    [menuItems, event.id]
  );

  const eventAssignments = useMemo(() => 
    assignments.filter(assignment => assignment.eventId === event.id),
    [assignments, event.id]
  );

  // 3. Logic for counting items created by the user
  const userCreatedItemsCount = useMemo(() => {
    if (!user) return 0;
    return eventMenuItems.filter(item => item.creatorId === user.id).length;
  }, [eventMenuItems, user]);

  const MAX_USER_ITEMS = 3;
  const canAddMoreItems = userCreatedItemsCount < MAX_USER_ITEMS;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDataLoaded(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const categorizedItems = useMemo(() => {
    const categories = {
      starter: eventMenuItems.filter(item => item.category === 'starter'),
      main: eventMenuItems.filter(item => item.category === 'main'),
      dessert: eventMenuItems.filter(item => item.category === 'dessert'),
      drink: eventMenuItems.filter(item => item.category === 'drink'),
      equipment: eventMenuItems.filter(item => item.category === 'equipment'),
      other: eventMenuItems.filter(item => item.category === 'other')
    };
    return categories;
  }, [eventMenuItems]);

  const categoryNames = {
    starter: 'מנות ראשונות',
    main: 'מנות עיקריות', 
    dessert: 'קינוחים',
    drink: 'שתייה',
    equipment: 'ציוד כללי',
    other: 'אחר'
  };

  const filteredItems = activeCategory === 'all' 
    ? eventMenuItems 
    : categorizedItems[activeCategory as keyof typeof categorizedItems] || [];

  const isPast = isEventPast(event.date, event.time);
  const isFinished = isEventFinished(event.date, event.time);
  const hasUserName = user?.name && user.name.trim().length > 0;
  const canAssign = !isPast && event.isActive;

  const handleAssignItem = (item: MenuItem) => {
    if (!canAssign) return;
    setSelectedMenuItem(item);
  };

  const findUserAssignment = async (item: MenuItem): Promise<Assignment | null> => {
    if (!user) return null;
    let assignment = eventAssignments.find(a => a.menuItemId === item.id && a.userId === user.id);
    if (assignment) return assignment;
    assignment = assignments.find(a => a.menuItemId === item.id && a.userId === user.id);
    return assignment || null;
  };

  const handleEditAssignment = async (item: MenuItem) => {
    if (!user || !canAssign || !dataLoaded) {
      if (!dataLoaded) toast.error('המערכת עדיין טוענת נתונים, אנא המתן...');
      return;
    }
    const assignment = await findUserAssignment(item);
    if (assignment) setEditingAssignment({ item, assignment });
    else toast.error('לא נמצא שיבוץ לעריכה');
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    try {
      await FirebaseService.forceDataConsistencyCheck();
      toast.success('הנתונים רועננו בהצלחה');
      setTimeout(() => setIsRefreshing(false), 2000);
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('שגיאה ברענון הנתונים');
      setIsRefreshing(false);
    }
  };

  if (showBulkManager) {
    return <BulkItemsManager onBack={() => setShowBulkManager(false)} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 rtl:space-x-reverse text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        <span>חזור לאירועים</span>
      </button>

      <div className="bg-white rounded-xl shadow-md p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${isPast ? 'bg-gray-100 text-gray-600' : isFinished ? 'bg-yellow-100 text-yellow-700' : event.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {isPast ? 'האירוע הסתיים' : isFinished ? 'בעיצומו' : event.isActive ? 'פעיל' : 'לא פעיל'}
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            {isPast ? 'האירוע הסתיים - ניתן לצפות בפרטים בלבד' : isFinished ? 'האירוע בעיצומו - ניתן עדיין לשבץ פריטים' : 'האירוע פעיל - ניתן לשבץ פריטים'}
          </div>
          {hasUserName && (
            <div className="mt-4 sm:mt-0 bg-orange-50 rounded-lg p-3">
              <div className="flex items-center text-orange-700">
                <Users className="h-4 w-4 ml-2" />
                <span className="font-medium">{user.name}</span>
              </div>
              <p className="text-xs text-orange-600 mt-1">שם זה יישמר לשיבוצים הבאים</p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center text-gray-600"><Calendar className="h-5 w-5 ml-3 text-orange-500" /><span>{formatDate(event.date)}</span></div>
            <div className="flex items-center text-gray-600"><Clock className="h-5 w-5 ml-3 text-orange-500" /><span>{formatTime(event.time)}</span></div>
            <div className="flex items-center text-gray-600"><MapPin className="h-5 w-5 ml-3 text-orange-500" /><span>{event.location}</span></div>
            <div className="flex items-center text-gray-600"><Users className="h-5 w-5 ml-3 text-orange-500" /><span>מארח: {event.hostName}</span></div>
        </div>
        {event.description && (<div className="border-t pt-4"><p className="text-gray-700">{event.description}</p></div>)}
      </div>

      {!dataLoaded && (<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6"><div className="flex items-center justify-between"><div className="flex items-center"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 ml-2"></div><span className="text-blue-700 text-sm">טוען נתונים מהשרת ומסנכרן...</span></div><button onClick={handleForceRefresh} disabled={isRefreshing} className="flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm transition-colors disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} /><span>רענן נתונים</span></button></div></div>)}
      
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>הכל ({eventMenuItems.length})</button>
          {Object.entries(categorizedItems).map(([category, items]) => (items.length > 0 && (<button key={category} onClick={() => setActiveCategory(category)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === category ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{categoryNames[category as keyof typeof categoryNames]} ({items.length})</button>)))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
                <ChefHat className="h-5 w-5 ml-3 text-orange-500" />
                <h2 className="text-lg font-semibold text-gray-900">פריטים לשיבוץ{filteredItems.length > 0 && (<span className="text-gray-500 text-sm mr-2">({filteredItems.filter(item => item.assignedTo).length}/{filteredItems.length} משובצים)</span>)}</h2>
            </div>

            {/* 4. Adding new buttons for admin and user */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              {!isAdmin && canAssign && (
                <button
                  onClick={() => setShowUserItemForm(true)}
                  disabled={!canAddMoreItems}
                  title={canAddMoreItems ? "הוסף פריט חדש" : `הגעת למכסת ${MAX_USER_ITEMS} הפריטים`}
                  className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  <span>הוסף פריט ({userCreatedItemsCount}/{MAX_USER_ITEMS})</span>
                </button>
              )}
              {isAdmin && (
                <button onClick={() => setShowBulkManager(true)} className="flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"><Settings className="h-4 w-4" /><span>ניהול מתקדם</span></button>
              )}
            </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="text-center py-8"><div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><ChefHat className="h-8 w-8 text-gray-400" /></div><h3 className="text-lg font-medium text-gray-900 mb-2">אין פריטים בקטגוריה זו</h3><p className="text-gray-500">עדיין לא נוספו פריטים לקטגוריה הנבחרת</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredItems.map((item) => (<MenuItemCard key={item.id} item={item} canAssign={canAssign && dataLoaded} onAssign={() => handleAssignItem(item)} onEdit={() => handleEditAssignment(item)} />))}
          </div>
        )}
      </div>

      {showUserInfo && (<UserInfoModal onClose={() => setShowUserInfo(false)} onComplete={() => {setShowUserInfo(false);}}/>)}
      {selectedMenuItem && (<AssignmentModal menuItem={selectedMenuItem} event={event} onClose={() => setSelectedMenuItem(null)}/>)}
      {editingAssignment && (<EditAssignmentModal menuItem={editingAssignment.item} event={event} assignment={editingAssignment.assignment} onClose={() => setEditingAssignment(null)}/>)}
      
      {/* 5. Adding the modal for the new form */}
      {showUserItemForm && (
        <UserMenuItemForm
          event={event}
          onClose={() => setShowUserItemForm(false)}
        />
      )}
    </div>
  );
}