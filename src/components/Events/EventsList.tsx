import { useState, useMemo } from 'react';
import { Calendar, Clock, MapPin, ChefHat, Search, X } from 'lucide-react';
import { useStore } from '../../store/useStore';
import AssignmentModal from './AssignmentModal';
import { EditAssignmentModal } from './EditAssignmentModal';
import { RideCard } from './Cards/RideCard';
import { ItemCard } from './Cards/ItemCard';
import { MenuItem, Assignment } from '../../types';
import { formatDate, formatTime, isEventPast } from '../../utils/dateUtils';
import { BulkItemsManager } from '../Admin/BulkItemsManager';
import { UserMenuItemForm } from './UserMenuItemForm';
import { CategorySelector } from './CategorySelector';
import { useTranslation } from 'react-i18next';

export function EventsList() {
  const { t } = useTranslation();
  const { events, menuItems, assignments, isLoading, user } = useStore();
  const isAdmin = user?.isAdmin || false;

  const [selectedMenuItem, setSelectedMenuItem] = useState<{ item: MenuItem; assignment?: Assignment; isAddMore?: boolean } | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<{ item: MenuItem; assignment: Assignment } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkManager, setShowBulkManager] = useState(false);
  const [showUserItemForm, setShowUserItemForm] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showMyAssignments, setShowMyAssignments] = useState(false);

  const activeEvent = useMemo(() => {
    const activeEvents = events.filter(event => {
      const isPastEvent = isEventPast(event.date, event.time);
      return event.isActive && !isPastEvent;
    });
    return activeEvents.length > 0 ? activeEvents[0] : null;
  }, [events]);

  const eventMenuItems = useMemo(() => {
    if (!activeEvent) return [];

    return menuItems.filter(item => {
      if (item.eventId !== activeEvent.id) return false;

      if (!isAdmin && item.category === 'other' &&
        (item.name.includes('שולחן') || item.name.includes('כיסא') ||
          item.name.includes('צלחת') || item.name.includes('כוס') ||
          item.name.includes('סכו"ם') || item.name.includes('מגש') ||
          item.name.includes('מפית') || item.name.includes('מפה'))) {
        return false;
      }

      return true;
    });
  }, [menuItems, activeEvent, isAdmin]);

  const userCreatedItemsCount = useMemo(() => {
    if (!user || !activeEvent) return 0;
    return eventMenuItems.filter(item => item.creatorId === user.id).length;
  }, [eventMenuItems, user, activeEvent]);

  const MAX_USER_ITEMS = 3;
  const canAddMoreItems = userCreatedItemsCount < MAX_USER_ITEMS;

  const eventAssignments = useMemo(() =>
    activeEvent ? assignments.filter(assignment => assignment.eventId === activeEvent.id) : [],
    [assignments, activeEvent]
  );

  const assignedItems = useMemo(() =>
    eventMenuItems.filter(item => {
      return eventAssignments.some(a => a.menuItemId === item.id);
    }),
    [eventMenuItems, eventAssignments]
  );

  const displayedItems = useMemo(() => {
    let items = eventMenuItems;

    if (searchTerm.trim()) {
      return items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
      );
    }

    if (showMyAssignments) {
      return items.filter(item =>
        eventAssignments.some(a => a.menuItemId === item.id && a.userId === user?.id)
      );
    }

    if (selectedCategory) {
      return items.filter(item => item.category === selectedCategory);
    }

    return [];
  }, [eventMenuItems, searchTerm, selectedCategory, showMyAssignments, eventAssignments, user?.id]);

  const availableCategories = useMemo(() => {
    const categories = new Set(eventMenuItems.map(item => item.category));
    return Array.from(categories);
  }, [eventMenuItems]);

  const itemsToRender = useMemo(() => {
    if (searchTerm.trim() || showMyAssignments || selectedCategory) {
      const assigned = displayedItems.filter(item =>
        eventAssignments.some(a => a.menuItemId === item.id)
      );
      const available = displayedItems.filter(item =>
        !eventAssignments.some(a => a.menuItemId === item.id)
      );
      return { assigned, available };
    }
    return { assigned: [], available: [] };
  }, [displayedItems, eventAssignments, searchTerm, showMyAssignments, selectedCategory]);

  const canAssign = activeEvent && !isEventPast(activeEvent.date, activeEvent.time) && activeEvent.isActive;

  const handleAssignItem = (item: MenuItem) => {
    if (!canAssign) return;
    const existingAssignment = eventAssignments.find(a => a.menuItemId === item.id && a.userId === user?.id);
    if (existingAssignment) {
      setSelectedMenuItem({ item, assignment: existingAssignment, isAddMore: true });
    } else {
      setSelectedMenuItem({ item, isAddMore: false });
    }
  };

  const handleEditAssignment = async (item: MenuItem) => {
    if (!user || !canAssign) return;
    const assignment = eventAssignments.find(a => a.menuItemId === item.id && a.userId === user.id);
    if (assignment) {
      setEditingAssignment({ item, assignment });
    }
  };

  if (showBulkManager) {
    return <BulkItemsManager
      onBack={() => setShowBulkManager(false)}
      allEvents={events}
      event={activeEvent || undefined}
    />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">{t('common.loading')}</p>
        </div>
      )}

      {!isLoading && !activeEvent && (
        <div className="text-center py-12">
          <div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><Calendar className="h-8 w-8 text-gray-400" /></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('eventPage.noActiveEvent')}</h3>
          <p className="text-gray-500 mb-4">{isAdmin ? t('eventPage.adminPrompt') : t('eventPage.comingSoon')}</p>
        </div>
      )}

      {!isLoading && activeEvent && (
        <>
          {/* Header Component - Unchanged logic */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-text truncate">{activeEvent.title}</h1>
                {isAdmin && (<button onClick={() => setShowBulkManager(true)} className="text-xs bg-primary hover:bg-primary-dark text-white font-semibold px-3 py-1.5 rounded-md transition-colors">{t('eventPage.actions.bulkEdit')}</button>)}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-text">
                <div className="flex items-center"><Calendar className="h-3 w-3 ml-1" /><span>{formatDate(activeEvent.date)}</span></div>
                <div className="flex items-center"><Clock className="h-3 w-3 ml-1" /><span>{formatTime(activeEvent.time)}</span></div>
                <div className="flex items-center"><MapPin className="h-3 w-3 ml-1" /><span className="truncate max-w-24">{activeEvent.location}</span></div>
                {eventMenuItems.length > 0 && (<div className="flex items-center"><ChefHat className="h-3 w-3 ml-1" /><span className="font-medium text-success">{assignedItems.length}/{eventMenuItems.length} {t('eventPage.stats.assigned')}</span></div>)}
              </div>
            </div>
          </div>

          {/* Search & Filter Component - Unchanged logic */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-4">
            <div className="flex items-center space-x-4 rtl:space-x-reverse">
              <div className="flex-grow">
                <label className="block text-xs font-medium text-text mb-1">{t('eventPage.quickSearch')}</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t('eventPage.searchPlaceholder')}
                    className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent text-base"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label={t('common.clearSearch')}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <label className="block text-xs font-medium text-text mb-1 invisible">{t('eventPage.filter.myAssignments')}</label>
                <button
                  onClick={() => {
                    setShowMyAssignments(!showMyAssignments);
                    setSelectedCategory(null);
                  }}
                  className={`w-full px-4 py-2 font-semibold rounded-lg shadow-sm transition-colors text-sm ${showMyAssignments
                    ? 'bg-accent text-white'
                    : 'bg-primary text-white hover:bg-primary-dark'
                    }`}
                >
                  {t('eventPage.filter.myAssignments')}
                </button>
              </div>
            </div>
          </div>

          {/* Main List Area */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            {searchTerm.trim() === '' && !selectedCategory && !showMyAssignments ? (
              <CategorySelector
                menuItems={eventMenuItems}
                assignments={eventAssignments}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                }}
                onAddItem={() => setShowUserItemForm(true)}
                canAddMoreItems={canAddMoreItems}
                categories={activeEvent.details.categories}
                userCreatedItemsCount={userCreatedItemsCount}
                MAX_USER_ITEMS={MAX_USER_ITEMS}
              />
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowMyAssignments(false);
                      setSearchTerm('');
                    }}
                    className="flex items-center text-sm font-semibold text-primary hover:text-primary-dark transition-colors"
                  >
                    <ArrowRight className="h-4 w-4 ml-2" />
                    {showMyAssignments ? t('eventPage.backToCategories') : selectedCategory ? t('eventPage.backToCategories') : t('common.back')}
                  </button>
                  <h2 className="text-lg font-bold text-text">
                    {showMyAssignments ? t('eventPage.filter.myAssignments') : selectedCategory ? t(`categories.${selectedCategory}`) : t('eventPage.list.searchResults')}
                  </h2>
                </div>

                {itemsToRender.available.length === 0 && itemsToRender.assigned.length === 0 ? (
                  <div className="text-center py-8">
                    <ChefHat className="h-12 w-12 mx-auto text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-text">
                      {showMyAssignments ? t('eventPage.list.noMyAssignments') : t('eventPage.list.noItemsInCategory')}
                    </h3>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Available Items Section */}
                    {itemsToRender.available.length > 0 && (
                      <div>
                        <h3
                          id="available-items-heading"
                          className="text-md font-semibold text-text mb-3"
                        >
                          {t('eventPage.list.available')}
                        </h3>
                        {/* A11Y & Layout Audit Fix: 
                           1. role="list" added.
                           2. aria-labelledby links to heading.
                           3. 'grid' added to <li> to enforce full-height child stretching (Critical Senior Fix).
                        */}
                        <ul
                          aria-labelledby="available-items-heading"
                          role="list"
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0"
                        >
                          {itemsToRender.available.map((item) => {
                            const isRide = item.category === 'trempim' || item.category === 'rides';
                            const commonProps = {
                              item,
                              assignments: eventAssignments.filter(a => a.menuItemId === item.id),
                              assignment: eventAssignments.find(a => a.menuItemId === item.id && a.userId === user?.id),
                              isMyAssignment: eventAssignments.some(a => a.menuItemId === item.id && a.userId === user?.id),
                              isEventActive: !!canAssign,
                              onAssign: () => handleAssignItem(item),
                              onEdit: () => handleEditAssignment(item),
                              onCancel: (assignment: any) => { /* EventsList cancel is simplified, maybe needs fix? */ setSelectedCategory(null); setShowMyAssignments(false); },
                              currentUserId: user?.id,
                              isOrganizer: isAdmin,
                              eventName: activeEvent?.title
                            };

                            return (
                              <li key={item.id} className="grid">
                                {isRide ? <RideCard {...commonProps} onCancel={() => { setSelectedCategory(null); setShowMyAssignments(false); }} /> : <ItemCard {...commonProps} onCancel={() => { setSelectedCategory(null); setShowMyAssignments(false); }} />}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Assigned Items Section */}
                    {itemsToRender.assigned.length > 0 && (
                      <div>
                        <h3
                          id="assigned-items-heading"
                          className="text-md font-semibold text-text mb-3 border-t pt-4 mt-4"
                        >
                          {t('eventPage.list.assignedHeader')}
                        </h3>
                        <ul
                          aria-labelledby="assigned-items-heading"
                          role="list"
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4 list-none p-0 m-0"
                        >
                          {itemsToRender.assigned.map((item) => {
                            const isRide = item.category === 'trempim' || item.category === 'rides';
                            const commonProps = {
                              item,
                              assignments: eventAssignments.filter(a => a.menuItemId === item.id),
                              assignment: eventAssignments.find(a => a.menuItemId === item.id && a.userId === user?.id),
                              isMyAssignment: eventAssignments.some(a => a.menuItemId === item.id && a.userId === user?.id),
                              isEventActive: !!canAssign,
                              onAssign: () => handleAssignItem(item),
                              onEdit: () => handleEditAssignment(item),
                              onCancel: (assignment: any) => { setSelectedCategory(null); setShowMyAssignments(false); },
                              currentUserId: user?.id,
                              isOrganizer: isAdmin,
                              eventName: activeEvent?.title
                            };

                            return (
                              <li key={item.id} className="grid">
                                {isRide ? <RideCard {...commonProps} onCancel={() => { setSelectedCategory(null); setShowMyAssignments(false); }} /> : <ItemCard {...commonProps} onCancel={() => { setSelectedCategory(null); setShowMyAssignments(false); }} />}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {selectedMenuItem && activeEvent && (
        <AssignmentModal
          item={selectedMenuItem.item}
          eventId={activeEvent.id}
          organizerId={activeEvent.organizerId}
          user={user!}
          onClose={() => setSelectedMenuItem(null)}
          isAddMore={selectedMenuItem.isAddMore}
          existingAssignment={selectedMenuItem.assignment}
          isEdit={selectedMenuItem.isAddMore}
        />
      )}
      {editingAssignment && activeEvent && (<EditAssignmentModal menuItem={editingAssignment.item} event={activeEvent} assignment={editingAssignment.assignment} onClose={() => setEditingAssignment(null)} />)}

      {showUserItemForm && activeEvent && (<UserMenuItemForm event={activeEvent} onClose={() => setShowUserItemForm(false)} availableCategories={availableCategories} />)}
    </div>
  );
}