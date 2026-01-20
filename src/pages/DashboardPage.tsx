// src/pages/DashboardPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { FirebaseService } from '../services/firebaseService';
import { ShishiEvent, EventDetails } from '../types';
import { toast } from 'react-hot-toast';
import { Plus, LogOut, Calendar, MapPin, Clock, Share2, Eye, Trash2, ChefHat, Home, Settings, Users, ChevronDown, ListChecks, List, ArrowRight, AlertTriangle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ImportItemsModal } from '../components/Admin/ImportItemsModal';
import { BulkItemsManager } from '../components/Admin/BulkItemsManager';
import { PresetListsManager } from '../components/Admin/PresetListsManager';
import { ConfirmationModal } from '../components/Admin/ConfirmationModal';

// --- Event card component ---
const EventCard: React.FC<{
    event: ShishiEvent,
    onDelete: (eventId: string, title: string) => void,
    onEdit: (event: ShishiEvent) => void,
    onImport: (event: ShishiEvent) => void,
    onManageParticipants: (event: ShishiEvent) => void,
    onBulkEdit: (event: ShishiEvent) => void;
}> = ({ event, onDelete, onEdit, onImport, onManageParticipants, onBulkEdit }) => {
    const navigate = useNavigate();
    const [showAdminActions, setShowAdminActions] = useState(false);
    const eventUrl = `${window.location.origin}/event/${event.id}`;
    const isPast = new Date(event.details.date) < new Date();

    const copyToClipboard = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(eventUrl);
        toast.success('הקישור הועתק!');
    };

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    const handleCardClick = () => {
        // Instead of going to event page, go directly to centralized management
        onBulkEdit(event);
    };
    const menuItemsCount = event.menuItems ? Object.keys(event.menuItems).length : 0;
    const assignmentsCount = event.assignments ? Object.keys(event.assignments).length : 0;
    const participantsWithAssignmentsCount = event.assignments
        ? new Set(Object.values(event.assignments).map(a => a.userId)).size
        : 0;
    const assignmentPercentage = menuItemsCount > 0 ? (assignmentsCount / menuItemsCount) * 100 : 0;

    return (
        <div
            onClick={handleCardClick}
            className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 flex flex-col cursor-pointer border-r-4 ${
                isPast
                    ? 'border-neutral-400 opacity-75'
                    : event.details.isActive
                        ? 'border-accent hover:scale-[1.02]'
                        : 'border-neutral-300'
            }`}>
            <div className="p-6 flex-grow">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-neutral-900">{event.details.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        isPast
                            ? 'bg-neutral-100 text-neutral-600'
                            : event.details.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                    }`}>
                        {isPast ? 'הסתיים' : event.details.isActive ? 'פעיל' : 'לא פעיל'}
                    </span>
                </div>
                <div className="space-y-2 text-sm text-neutral-600 mb-4">
                    <p className="flex items-center"><Calendar size={14} className="ml-2 text-accent" /> {new Date(event.details.date).toLocaleDateString('he-IL')}</p>
                    <p className="flex items-center"><Clock size={14} className="ml-2 text-accent" /> {event.details.time}</p>
                    <p className="flex items-center"><MapPin size={14} className="ml-2 text-accent" /> {event.details.location}</p>
                </div>

                {menuItemsCount > 0 && (
                    <div className="mt-4 pt-4 border-t border-neutral-200">
                        <p className="text-xs text-neutral-500 mb-2">
                            <span className="font-medium text-neutral-700">{assignmentsCount}</span> מתוך <span className="font-medium text-neutral-700">{menuItemsCount}</span> פריטים שובצו
                            <span className="mx-2">|</span>
                            <span className="font-medium text-neutral-700">{participantsWithAssignmentsCount}</span> משתתפים
                        </p>
                        <div className="w-full bg-neutral-200 rounded-full h-1.5">
                            <div
                                className="bg-accent h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${assignmentPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
            <div className="bg-neutral-50 p-4 border-t rounded-b-xl">
                <div className="flex justify-between items-center">
                    <button onClick={copyToClipboard} className="flex items-center text-sm text-info hover:text-info/80 font-semibold">
                        <Share2 size={16} className="ml-1" /> שתף
                    </button>
                    <button
                        onClick={(e) => handleActionClick(e, () => navigate(`/event/${event.id}`))}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                        title="תצוגת משתתפים"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={(e) => handleActionClick(e, () => setShowAdminActions(!showAdminActions))}
                        className="flex items-center text-sm font-semibold bg-blue-100 text-blue-700 px-3 py-1 rounded-md hover:bg-blue-200"
                    >
                        ניהול
                        <ChevronDown size={16} className={`mr-1 transition-transform ${showAdminActions ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                {showAdminActions && (
                    <div className="mt-4 pt-4 border-t space-y-2">
                        <button onClick={(e) => handleActionClick(e, () => onBulkEdit(event))} className="w-full flex items-center text-left text-sm p-2 rounded-md hover:bg-neutral-200">
                            <ListChecks size={14} className="ml-2" /> עריכה מרוכזת
                        </button>
                        <button onClick={(e) => handleActionClick(e, () => onImport(event))} className="w-full text-left text-sm p-2 rounded-md hover:bg-neutral-200">ייבא פריטים</button>
                        <button onClick={(e) => handleActionClick(e, () => onManageParticipants(event))} className="w-full text-left text-sm p-2 rounded-md hover:bg-neutral-200">נהל משתתפים</button>
                        <button onClick={(e) => handleActionClick(e, () => onEdit(event))} className="w-full text-left text-sm p-2 rounded-md hover:bg-neutral-200">ערוך פרטי אירוע</button>
                        <button onClick={(e) => handleActionClick(e, () => onDelete(event.id, event.details.title))} className="w-full text-left text-sm p-2 rounded-md hover:bg-red-100 text-error">מחק אירוע</button>
                    </div>
                )}
            </div>
        </div>
    );
};


// --- Event creation form component ---
const EventFormModal: React.FC<{ onClose: () => void, onEventCreated: () => void, editingEvent?: ShishiEvent }> = ({ onClose, onEventCreated, editingEvent }) => {
    const user = useStore(state => state.user);
    const [details, setDetails] = useState<Omit<EventDetails, 'stats'>>({
        title: editingEvent?.details.title || '',
        date: editingEvent?.details.date || '',
        time: editingEvent?.details.time || '19:00',
        location: editingEvent?.details.location || '',
        description: editingEvent?.details.description || '',
        isActive: editingEvent?.details.isActive ?? true,
        allowUserItems: editingEvent?.details.allowUserItems ?? true,
        userItemLimit: editingEvent?.details.userItemLimit ?? 3,
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("שגיאה: משתמש לא מחובר.");
            return;
        }
        if (!details.title || !details.date || !details.time || !details.location) {
            toast.error("יש למלא את כל שדות החובה.");
            return;
        }

        setIsLoading(true);
        try {
            if (editingEvent) {
                await FirebaseService.updateEventDetails(editingEvent.id, {
                    ...details,
                    allowUserItems: details.allowUserItems,
                    userItemLimit: details.allowUserItems ? details.userItemLimit : 0,
                });
                toast.success("האירוע עודכן בהצלחה!");
            } else {
                await FirebaseService.createEvent(user.id, {
                    ...details,
                    allowUserItems: details.allowUserItems,
                    userItemLimit: details.allowUserItems ? details.userItemLimit : 0,
                });
                toast.success("האירוע נוצר בהצלחה!");
            }
            onEventCreated();
            onClose();
        } catch (error) {
            console.error("Error saving event:", error);
            toast.error(editingEvent ? "שגיאה בעדכון האירוע." : "שגיאה ביצירת האירוע.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <h2 className="text-xl font-bold mb-4">{editingEvent ? 'עריכת אירוע' : 'יצירת אירוע חדש'}</h2>
                        <div className="space-y-4">
                            <input type="text" placeholder="שם האירוע" value={details.title} onChange={e => setDetails({...details, title: e.target.value})} className="w-full p-2 border rounded-lg" required />
                            <div className="flex space-x-4">
                                <input type="date" value={details.date} onChange={e => setDetails({...details, date: e.target.value})} className="w-full p-2 border rounded-lg" required />
                                <input type="time" value={details.time} onChange={e => setDetails({...details, time: e.target.value})} className="w-full p-2 border rounded-lg" required />
                            </div>
                            <input type="text" placeholder="מיקום" value={details.location} onChange={e => setDetails({...details, location: e.target.value})} className="w-full p-2 border rounded-lg" required />
                            <textarea placeholder="תיאור (אופציונלי)" value={details.description} onChange={e => setDetails({...details, description: e.target.value})} className="w-full p-2 border rounded-lg" rows={3}></textarea>
                             <label className="flex items-center">
                                <input type="checkbox" checked={details.isActive} onChange={(e) => setDetails({...details, isActive: e.target.checked})} className="rounded" />
                                <span className="mr-2 text-sm text-gray-700">הפוך לאירוע פעיל</span>
                            </label>
                            
                            <div className="border-t pt-4 mt-4">
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={details.allowUserItems}
                                        onChange={(e) => setDetails({ ...details, allowUserItems: e.target.checked })}
                                        className="rounded"
                                    />
                                    <span className="mr-2 text-sm text-gray-700">אפשר למשתתפים להוסיף פריטים</span>
                                </label>
                                {details.allowUserItems && (
                                    <div className="mt-2 mr-6">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            מגבלת פריטים למשתמש
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={details.userItemLimit}
                                            onChange={(e) => setDetails({ ...details, userItemLimit: parseInt(e.target.value) || 1 })}
                                            className="w-24 p-2 border rounded-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 rounded-b-xl">
                        <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300">ביטול</button>
                        <button type="submit" disabled={isLoading} className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:bg-orange-300">
                            {isLoading ? (editingEvent ? 'מעדכן...' : 'יוצר...') : (editingEvent ? 'עדכן אירוע' : 'צור אירוע')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Main dashboard component ---
const DashboardPage: React.FC = () => {
    const { user, isDeleteAccountModalOpen, toggleDeleteAccountModal } = useStore();
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
    
    // Perform deletion of local state
    // const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);


    const logout = async () => {
        try {
            await signOut(auth);
            toast.success('התנתקת בהצלחה');
        } catch (error) {
            toast.error('שגיאה בעת ההתנתקות');
        }
    };

    const fetchEvents = useCallback(async () => {
        if (!user) return;
        setIsLoadingEvents(true);
        try {
            const fetchedEvents = await FirebaseService.getEventsByOrganizer(user.id);
            setEvents(fetchedEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
            toast.error("שגיאה בטעינת האירועים.");
        } finally {
            setIsLoadingEvents(false);
        }
    }, [user]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);
    
    


    const activeEvents = events.filter(event => event.details.isActive);
    const inactiveEvents = events.filter(event => !event.details.isActive);
    const displayedEvents = activeTab === 'active' ? activeEvents : inactiveEvents;
    const handleDeleteEvent = async (eventId: string, title: string) => {
        if (!user) return;
        if (window.confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${title}"? הפעולה אינה הפיכה.`)) {
            try {
                await FirebaseService.deleteEvent(eventId);
                toast.success("האירוע נמחק בהצלחה");
                fetchEvents();
            } catch (error) {
                toast.error("שגיאה במחיקת האירוע");
            }
        }
    };

    const handleImportItems = (event: ShishiEvent) => {
        setSelectedEventForImport(event);
        setShowImportModal(true);
    };
    
    const handleBulkEdit = (event: ShishiEvent) => {
        setSelectedEventForBulkEdit(event);
        setShowBulkManager(true);
    };

    const handleManageParticipants = (event: ShishiEvent) => {
        toast(`ניהול משתתפים עבור ${event.details.title} - בקרוב!`);
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
                onBack={() => {
                    setShowBulkManager(false);
                    setSelectedEventForBulkEdit(null);
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
                                className="flex items-center text-gray-600 hover:text-gray-900 ml-4"
                            >
                                <ArrowRight className="h-4 w-4 ml-1" />
                                חזור לדאשבורד
                            </button>
                            <ChefHat className="h-8 w-8 text-orange-500" />
                            <h1 className="ml-3 text-2xl font-bold text-gray-900">ניהול רשימות מוכנות</h1>
                        </div>
                    </div>
                </header>
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <PresetListsManager
                        onClose={() => setShowPresetManager(false)}
                        onSelectList={() => {}}
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
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div className="flex items-center">
                        <ChefHat className="h-8 w-8 text-orange-500" />
                        <h1 className="ml-3 text-2xl font-bold text-gray-900">{user?.name} - מנהל</h1>
                    </div>
                    <div className="flex items-center space-x-4 rtl:space-x-reverse">
                        <a 
                            href="https://www.linkedin.com/in/chagai-yechiel/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            פותח ע"י חגי יחיאל
                        </a>
                        <button
                            onClick={() => setShowPresetManager(true)}
                            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
                        >
                            <List className="h-4 w-4 ml-1" />
                            רשימות מוכנות
                        </button>
                        <button onClick={logout} className="text-sm font-medium text-gray-600 hover:text-red-500 flex items-center">
                            <LogOut size={16} className="ml-1" />
                            התנתק
                        </button>
                    </div>
                </div>
            </header>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 px-4 sm:px-0 space-y-4 sm:space-y-0">
                    <div className="flex items-center space-x-4 rtl:space-x-reverse">
                        <div className="flex rounded-lg bg-gray-100 p-1">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === 'active' 
                                        ? 'bg-white text-gray-900 shadow' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                אירועים פעילים ({activeEvents.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('inactive')}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === 'inactive' 
                                        ? 'bg-white text-gray-900 shadow' 
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                אירועים ישנים ({inactiveEvents.length})
                            </button>
                        </div>
                    </div>
                    <button onClick={() => {
                        setEditingEvent(null);
                        setShowCreateModal(true);
                    }} className="flex items-center bg-orange-500 text-white px-4 py-2 rounded-lg shadow hover:bg-orange-600 transition-colors">
                        <Plus size={20} className="ml-2" />
                        צור אירוע חדש
                    </button>
                </div>

                {isLoadingEvents ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                        <p className="ml-4 text-gray-600">טוען נתונים...</p>
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
                                onManageParticipants={handleManageParticipants}
                                onBulkEdit={handleBulkEdit}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed">
                        <Home size={48} className="mx-auto text-gray-400" />
                        <h3 className="mt-2 text-lg font-medium text-gray-900">
                            {activeTab === 'active' ? 'אין אירועים פעילים' : 'אין אירועים ישנים'}
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {activeTab === 'active' 
                                ? 'לחץ על "צור אירוע חדש" כדי להתחיל.' 
                                : 'אירועים שהושבתו או הסתיימו יופיעו כאן.'
                            }
                        </p>
                    </div>
                )}
            </main>

            {showCreateModal && (
                <EventFormModal
                    onClose={() => {
                        setShowCreateModal(false);
                        setEditingEvent(null);
                    }}
                    onEventCreated={fetchEvents}
                    editingEvent={editingEvent || undefined}
                />
            )}

            {showImportModal && selectedEventForImport && (
                <ImportItemsModal
                    event={selectedEventForImport}
                    onClose={() => {
                        setShowImportModal(false);
                        setSelectedEventForImport(null);
                    }}
                />
            )}
            
        


            {showPresetManager && (
                <PresetListsManager
                    onClose={() => setShowPresetManager(false)}
                    onSelectList={() => {}}
                />
            )}
        </div>
    );
};

export default DashboardPage;