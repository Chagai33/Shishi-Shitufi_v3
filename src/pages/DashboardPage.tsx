// src/pages/DashboardPage.tsx

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FirebaseService } from '../services/firebaseService';
import { ShishiEvent, EventDetails } from '../types';
import { toast } from 'react-hot-toast';
import { Plus, Calendar, MapPin, Clock, ChefHat, Home, ListChecks, ArrowRight, Trash2, Edit, Sparkles, Share2, MoreVertical } from 'lucide-react';
import { ImportItemsModal } from '../components/Admin/ImportItemsModal';
import { BulkItemsManager } from '../components/Admin/BulkItemsManager';
import { PresetListsManager } from '../components/Admin/PresetListsManager';
import FocusTrap from 'focus-trap-react';

import { useTranslation } from 'react-i18next';
import { EventForm } from '../components/Admin/EventForm';

// --- Event card component ---
const EventCard: React.FC<{
    event: ShishiEvent,
    onDelete: (eventId: string, title: string) => void,
    onEdit: (event: ShishiEvent) => void,
    onImport: (event: ShishiEvent) => void,
    onBulkEdit: (event: ShishiEvent) => void;
}> = ({ event, onDelete, onEdit, onImport, onBulkEdit }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [showAdminActions, setShowAdminActions] = useState(false);
    const eventUrl = `${window.location.origin}/event/${event.id}`;
    const isPast = new Date(event.details.date) < new Date();

    const copyToClipboard = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(eventUrl);
        toast.success(t('dashboard.eventCard.messages.linkCopied'));
    };

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    const menuItemsCount = event.menuItems ? Object.keys(event.menuItems).length : 0;
    const assignmentsCount = event.assignments ? Object.keys(event.assignments).length : 0;
    const participantsWithAssignmentsCount = event.assignments
        ? new Set(Object.values(event.assignments).map(a => a.userId)).size
        : 0;
    const assignmentPercentage = menuItemsCount > 0 ? (assignmentsCount / menuItemsCount) * 100 : 0;

    return (
        <div
            className={`relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col border border-neutral-200 border-r-4 ${isPast
                ? 'border-r-neutral-300 opacity-75'
                : event.details.isActive
                    ? 'border-r-primary'
                    : 'border-r-neutral-300'
                }`}>
            <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                    {/* Content Side */}
                    <div className="flex flex-col gap-3 pr-2 flex-grow">
                        <h3 className="text-xl font-bold text-neutral-900 leading-tight">{event.details.title}</h3>

                        <div className="flex flex-col gap-1.5 text-sm text-neutral-700 font-medium">
                            <p className="flex items-center gap-2"><Calendar size={15} className="text-primary shrink-0" aria-hidden="true" /> {new Date(event.details.date).toLocaleDateString('he-IL')}</p>
                            <p className="flex items-center gap-2"><Clock size={15} className="text-primary shrink-0" aria-hidden="true" /> {event.details.time}</p>
                            <p className="flex items-center gap-2"><MapPin size={15} className="text-primary shrink-0" aria-hidden="true" /> {event.details.location}</p>
                        </div>
                    </div>

                    {/* Actions Side (Vertical Stack) */}
                    <div className="flex flex-col items-end gap-3 pointer-events-auto relative z-20 shrink-0 pl-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isPast
                            ? 'bg-neutral-100 text-neutral-700'
                            : event.details.isActive ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                            }`}>
                            {isPast ? t('dashboard.eventCard.status.ended') : event.details.isActive ? t('dashboard.eventCard.status.active') : t('dashboard.eventCard.status.inactive')}
                        </span>

                        {/* Permanent Edit/Delete Icons (Vertical Stack) */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={(e) => handleActionClick(e, () => onEdit(event))}
                                type="button"
                                aria-label={`${t('dashboard.eventCard.actions.editDetails')}: ${event.details.title}`}
                                title={t('dashboard.eventCard.actions.editDetails')}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-sm border border-gray-100"
                            >
                                <Edit size={18} aria-hidden="true" />
                            </button>
                            <button
                                onClick={(e) => handleActionClick(e, () => onDelete(event.id, event.details.title))}
                                type="button"
                                aria-label={`${t('dashboard.eventCard.actions.delete')}: ${event.details.title}`}
                                title={t('dashboard.eventCard.actions.delete')}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 bg-white shadow-sm border border-gray-100"
                            >
                                <Trash2 size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-neutral-200">
                    {menuItemsCount > 0 ? (
                        <p className="text-xs text-neutral-600 mb-2 font-semibold">
                            <span className="text-neutral-900">{t('dashboard.eventCard.stats.items', { count: assignmentsCount, total: menuItemsCount })}</span>
                            <span className="mx-2">|</span>
                            <span className="text-neutral-900">{t('dashboard.eventCard.stats.participants', { count: participantsWithAssignmentsCount })}</span>
                        </p>
                    ) : (
                        <p className="text-xs text-neutral-500 mb-2 font-medium">
                            {t('dashboard.eventCard.stats.noItems')}
                        </p>
                    )}
                    <div className="w-full bg-neutral-200 rounded-full h-1.5">
                        <div
                            className="bg-accent h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${assignmentPercentage}%` }}
                        ></div>
                    </div>
                </div>
            </div>
            <div className="relative z-10 bg-neutral-50 border-t rounded-b-xl">
                {/* Footer Actions: Clean Action Bar */}
                <div className="flex items-center divide-x divide-x-reverse divide-neutral-200">

                    {/* Share Button (Right) */}
                    <button
                        onClick={copyToClipboard}
                        type="button"
                        className="flex-1 py-3 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 first:rounded-br-xl transition-colors group"
                        title={t('dashboard.eventCard.actions.share')}
                    >
                        <Share2 size={20} className="group-hover:text-blue-600 transition-colors" />
                    </button>

                    {/* Go To Event (Center) */}
                    <button
                        onClick={(e) => handleActionClick(e, () => navigate(`/event/${event.id}`))}
                        type="button"
                        className="flex-[2] py-3 flex items-center justify-center font-medium text-sm text-neutral-700 hover:bg-neutral-100 hover:text-orange-600 transition-colors gap-2"
                    >
                        {t('dashboard.eventCard.actions.goToEvent')}
                        <ArrowRight size={16} className="rtl:rotate-180" />
                    </button>

                    {/* AI Import (Left) */}
                    <button
                        onClick={(e) => handleActionClick(e, () => onImport(event))}
                        type="button"
                        className="flex-1 py-3 flex items-center justify-center text-neutral-600 hover:bg-purple-50 transition-colors group"
                        title={t('dashboard.eventCard.actions.import')}
                    >
                        <Sparkles size={20} className="text-purple-600 group-hover:scale-110 transition-transform" />
                    </button>

                    {/* More Actions (Far Left) */}
                    <div className="relative flex-1 flex justify-center border-r border-gray-200 rtl:border-l rtl:border-r-0">
                        <button
                            onClick={(e) => handleActionClick(e, () => setShowAdminActions(!showAdminActions))}
                            type="button"
                            className="w-full py-3 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 last:rounded-bl-xl transition-colors"
                            title={t('common.moreActions')}
                        >
                            <MoreVertical size={20} />
                        </button>

                        {showAdminActions && (
                            <div className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                                <button
                                    onClick={(e) => handleActionClick(e, () => onBulkEdit(event))}
                                    type="button"
                                    className="w-full flex items-center text-left text-sm p-3 hover:bg-neutral-50 transition-colors text-gray-700"
                                >
                                    <ListChecks size={16} className="ml-2" aria-hidden="true" />
                                    {t('dashboard.eventCard.actions.bulkEdit')}
                                </button>

                            </div>
                        )}
                    </div>

                </div>

                {/* More Actions (Absolute Positioned for cleaner main bar) */}
                <div className="absolute left-2 top-0 bottom-0 flex items-center hidden">
                    {/* Kept hidden or remove if redundant. Users can accept just the 3 main actions. 
                     If 'More' is critical, it can replace one or sit in the corner. 
                     For now, sticking to the 3 main requested actions. */}
                </div>

            </div>
        </div>
    );
};


// EventFormModal removed in favor of shared component


// --- Main dashboard component ---
const DashboardPage: React.FC = () => {
    const { t } = useTranslation();
    const { user } = useStore();
    const [events, setEvents] = useState<ShishiEvent[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState<ShishiEvent | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [selectedEventForImport, setSelectedEventForImport] = useState<ShishiEvent | null>(null);

    const [showBulkManager, setShowBulkManager] = useState(false);
    const [selectedEventForBulkEdit, setSelectedEventForBulkEdit] = useState<ShishiEvent | null>(null);

    const [showPresetManager, setShowPresetManager] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
    const [bulkEditInitialAddForm, setBulkEditInitialAddForm] = useState(false);




    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setIsLoadingEvents(true);
        try {
            const fetchedEvents = await FirebaseService.getEventsByOrganizer(user.id);
            setEvents(fetchedEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error(t('dashboard.main.messages.fetchError'));
        } finally {
            setIsLoadingEvents(false);
        }
    }, [user]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);




    // Calculate effective date for event expiration (3:00 AM rule)
    const now = new Date();
    const currentHour = now.getHours();

    // If it's before 3:00 AM, we consider "today" to be "yesterday" for expiration purposes.
    // This allows events from the previous night to remain active until 3 AM.
    const referenceDate = new Date();
    if (currentHour < 3) {
        referenceDate.setDate(referenceDate.getDate() - 1);
    }

    // Format to YYYY-MM-DD using local time components to avoid UTC shifts
    const year = referenceDate.getFullYear();
    const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
    const day = String(referenceDate.getDate()).padStart(2, '0');
    const referenceDateStr = `${year}-${month}-${day}`;

    const activeEvents = events
        .filter(event => event.details.isActive && event.details.date >= referenceDateStr)
        .sort((a, b) => new Date(a.details.date).getTime() - new Date(b.details.date).getTime());

    const inactiveEvents = events
        .filter(event => !event.details.isActive || event.details.date < referenceDateStr)
        .sort((a, b) => new Date(b.details.date).getTime() - new Date(a.details.date).getTime());
    const displayedEvents = activeTab === 'active' ? activeEvents : inactiveEvents;
    const handleDeleteEvent = async (eventId: string, title: string) => {
        if (!user) return;
        if (window.confirm(t('dashboard.main.messages.deleteConfirm', { title }))) {
            try {
                await FirebaseService.deleteEvent(eventId);
                toast.success(t('dashboard.main.messages.deleteSuccess'));
                fetchEvents();
            } catch (error) {
                toast.error(t('dashboard.main.messages.deleteError'));
            }
        }
    };

    const handleImportItems = (event: ShishiEvent) => {
        setSelectedEventForImport(event);
        setShowImportModal(true);
    };

    const handleBulkEdit = (event: ShishiEvent, showAddForm = false) => {
        setSelectedEventForBulkEdit(event);
        setBulkEditInitialAddForm(showAddForm);
        setShowBulkManager(true);
    };



    const handleEditEvent = (event: ShishiEvent) => {
        setEditingEvent(event);
        setShowCreateModal(true);
    };

    if (showBulkManager && selectedEventForBulkEdit) {
        return (
            <BulkItemsManager
                event={selectedEventForBulkEdit}
                allEvents={events}
                initialShowAddItemForm={bulkEditInitialAddForm}
                onBack={() => {
                    setShowBulkManager(false);
                    setSelectedEventForBulkEdit(null);
                    setBulkEditInitialAddForm(false);
                }}
            />
        );
    }
    if (showPresetManager) {
        return (
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white shadow-sm">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                        <div className="flex items-center">
                            <button
                                onClick={() => setShowPresetManager(false)}
                                type="button"
                                className="flex items-center text-gray-600 hover:text-gray-900 ml-4"
                            >
                                <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
                                חזור לדאשבורד
                            </button>
                            <ChefHat className="h-8 w-8 text-orange-500" aria-hidden="true" />
                            <h1 className="ml-3 text-2xl font-bold text-gray-900">ניהול רשימות מוכנות</h1>
                        </div>
                    </div>
                </header>
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <PresetListsManager
                        onClose={() => setShowPresetManager(false)}
                        onSelectList={() => { }}
                    />
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 px-4 sm:px-0 space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-4 rtl:space-x-reverse">
                        <div className="flex rounded-lg bg-gray-100 p-1">
                            <button
                                onClick={() => setActiveTab('active')}
                                type="button"
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'active'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {t('dashboard.main.filters.activeEvents', { count: activeEvents.length })}
                            </button>
                            <button
                                onClick={() => setActiveTab('inactive')}
                                type="button"
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'inactive'
                                    ? 'bg-white text-gray-900 shadow'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                            >
                                {t('dashboard.main.filters.inactiveEvents', { count: inactiveEvents.length })}
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setEditingEvent(null);
                            setShowCreateModal(true);
                        }}
                        type="button"
                        className="flex items-center bg-orange-500 text-white px-4 py-2 rounded-lg shadow hover:bg-orange-600 transition-colors"
                    >
                        <Plus size={20} className="ml-2" aria-hidden="true" />
                        {t('dashboard.main.createButton')}
                    </button>
                </div>

                {isLoadingEvents ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                        <p className="ml-4 text-gray-600">{t('dashboard.main.loading')}</p>
                    </div>
                ) : displayedEvents.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayedEvents.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onDelete={handleDeleteEvent}
                                onEdit={handleEditEvent}
                                onImport={handleImportItems}
                                onBulkEdit={handleBulkEdit}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed">
                        <Home size={48} className="mx-auto text-gray-400" aria-hidden="true" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">
                            {activeTab === 'active' ? t('dashboard.main.empty.activeTitle') : t('dashboard.main.empty.inactiveTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {activeTab === 'active'
                                ? t('dashboard.main.empty.activeDesc')
                                : t('dashboard.main.empty.inactiveDesc')
                            }
                        </p>
                    </div>
                )}
            </main>

            {showCreateModal && (
                <EventForm
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingEvent(null);
                    }}
                    onSuccess={fetchEvents}
                    event={editingEvent || undefined}
                />
            )}

            {showImportModal && selectedEventForImport && (
                <ImportItemsModal
                    event={selectedEventForImport}
                    onClose={() => {
                        setShowImportModal(false);
                        setSelectedEventForImport(null);
                    }}
                    onAddSingleItem={() => {
                        const eventToBulkEdit = selectedEventForImport;
                        setShowImportModal(false);
                        setSelectedEventForImport(null);
                        handleBulkEdit(eventToBulkEdit, true);
                    }}
                />
            )}




            {showPresetManager && (
                <PresetListsManager
                    onClose={() => setShowPresetManager(false)}
                    onSelectList={() => { }}
                />
            )}
        </div>
    );
};

export default DashboardPage;