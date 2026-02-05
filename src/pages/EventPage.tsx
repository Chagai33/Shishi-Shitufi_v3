// src/pages/EventPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { useStore, selectMenuItems, selectAssignments, selectParticipants, selectAssignmentsByItemId } from '../store/useStore';
import { FirebaseService } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { MenuItem as MenuItemType, Assignment as AssignmentType } from '../types';
import { CalendarPlus, Clock, User as UserIcon, AlertCircle, X, Search, ArrowRight, ChefHat, Plus } from 'lucide-react';
import { isEventFinished } from '../utils/dateUtils';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import NavigationMenu from '../components/Common/NavigationMenu';
import { UserMenuItemForm } from '../components/Events/UserMenuItemForm';
import { EditItemModal } from '../components/Events/EditItemModal';
import { CategorySelector } from '../components/Events/CategorySelector';
import { ParticipantsListModal } from '../components/Events/ParticipantsListModal';
import { getEventCategories } from '../constants/templates';
import { resolveCategoryDisplayName, isCarpoolLogic } from '../utils/eventUtils';
import { useDebounce } from '../hooks/useDebounce';




// --- Component: CategorySelector removed, using imported component ---


import { ItemCard } from '../components/Events/Cards/ItemCard';
import { RideCard } from '../components/Events/Cards/RideCard';
import { UnifiedRideCard } from '../components/Events/Cards/UnifiedRideCard';
import { groupItemsByDriver, DisplayItem } from '../utils/rideGroupingUtils';

import AssignmentModal from '../components/Events/AssignmentModal';

const NameModal: React.FC<{ isLoading: boolean, onSave: (name: string) => void, onClose: () => void }> = ({ isLoading, onSave, onClose }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
                <div className="p-6 text-center">
                    <h2 className="text-xl font-bold text-neutral-900 mb-2">{t('eventPage.welcome.title')}</h2>
                    <p className="text-gray-600 mb-4">{t('eventPage.welcome.subtitle')}</p>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (e.target.value.trim()) setError('');
                        }}
                        placeholder={t('eventPage.welcome.namePlaceholder')}
                        className={`w-full p-3 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500`}
                    />
                    {error && <p className="text-red-500 text-xs mt-1 text-right">{error}</p>}
                    <div className="flex space-x-3 rtl:space-x-reverse mt-6">
                        <button type="button" onClick={onClose} disabled={isLoading} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={() => {
                                if (!name.trim()) {
                                    setError(t('eventPage.messages.missingName'));
                                    return;
                                }
                                onSave(name);
                            }}
                            disabled={isLoading}
                            className="flex-1 bg-accent text-white py-2 rounded-lg hover:bg-accent/90 disabled:bg-neutral-300"
                        >
                            {isLoading ? t('common.saving') : t('eventPage.welcome.join')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const EventPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { eventId } = useParams<{ eventId: string }>();
    const [localUser, setLocalUser] = useState<FirebaseUser | null>(null);
    const [isJoining, setIsJoining] = useState(false);

    const [isEventLoading, setIsEventLoading] = useState(true);
    const [isTitleExpanded, setIsTitleExpanded] = useState(false);

    const { currentEvent, setCurrentEvent, updateCurrentEventPartial, clearCurrentEvent, isLoading, user: storeUser } = useStore();

    const menuItems = useStore(selectMenuItems);
    const assignments = useStore(selectAssignments);
    const participants = useStore(selectParticipants);
    const assignmentsByItemId = useStore(selectAssignmentsByItemId); // 🚀 OPTIMIZATION: O(1) lookups
    const userCreatedItemsCount = useMemo(() => {
        if (!localUser || !currentEvent?.userItemCounts) return 0;
        return currentEvent.userItemCounts[localUser.uid] || 0;
    }, [currentEvent, localUser]);

    const MAX_USER_ITEMS = currentEvent?.details.userItemLimit ?? 3;
    const showAdminButton = storeUser?.isAdmin || (localUser && currentEvent?.organizerId === localUser.uid);
    const isOrganizer = !!showAdminButton;

    const canAddMoreItems = showAdminButton || ((currentEvent?.details.allowUserItems ?? false) && userCreatedItemsCount < MAX_USER_ITEMS);
    const assignmentStats = useMemo(() => {
        const requiredItems = menuItems.filter(item => item.isRequired);
        const optionalItems = menuItems.filter(item => !item.isRequired);

        const assignedRequiredItems = requiredItems.filter(item =>
            assignments.some(a => a.menuItemId === item.id)
        );
        const assignedOptionalItems = optionalItems.filter(item =>
            assignments.some(a => a.menuItemId === item.id)
        );

        return {
            requiredTotal: requiredItems.length,
            requiredAssigned: assignedRequiredItems.length,
            optionalTotal: optionalItems.length,
            optionalAssigned: assignedOptionalItems.length,
        };
    }, [menuItems, assignments]);

    const [modalState, setModalState] = useState<{ type: 'assign' | 'edit' | 'add-user-item' | 'add-more' | 'edit-item'; item?: MenuItemType; assignment?: AssignmentType; category?: string; rowType?: 'needs' | 'offers' } | null>(null);
    const [itemToAssignAfterJoin, setItemToAssignAfterJoin] = useState<MenuItemType | null>(null);
    const [showNameModal, setShowNameModal] = useState(false);
    const [showParticipantsList, setShowParticipantsList] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300); // 🚀 OPTIMIZATION: Debounced search
    const [view, setView] = useState<'categories' | 'items'>('categories');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [lastManualCategory, setLastManualCategory] = useState<string>('main');

    const eventCategories = useMemo(() => getEventCategories(currentEvent || undefined), [currentEvent]);
    const getCategoryName = useCallback((id: string) => {
        return resolveCategoryDisplayName(id, currentEvent || undefined, eventCategories, t);
    }, [eventCategories, t, currentEvent]);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) setLocalUser(user);
            else signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
        });
        if (!eventId) return;

        setIsEventLoading(true);

        // 🚀 OPTIMIZATION: Granular subscriptions instead of full event fetch
        // Each subscription updates only its relevant part, reducing bandwidth by ~90%

        const unsubDetails = FirebaseService.subscribeToEventDetails(eventId, (baseData) => {
            if (baseData) {
                // Always include eventId in the update
                updateCurrentEventPartial({
                    id: eventId,
                    ...baseData
                });
                setIsEventLoading(false);
            } else {
                setCurrentEvent(null);
                setIsEventLoading(false);
            }
        });

        const unsubMenuItems = FirebaseService.subscribeToMenuItems(eventId, (menuItems) => {
            updateCurrentEventPartial({
                id: eventId,
                menuItems: menuItems || {}
            });
        });

        const unsubAssignments = FirebaseService.subscribeToAssignments(eventId, (assignments) => {
            updateCurrentEventPartial({
                id: eventId,
                assignments: assignments || {}
            });
        });

        const unsubParticipants = FirebaseService.subscribeToParticipants(eventId, (participants) => {
            updateCurrentEventPartial({
                id: eventId,
                participants: participants || {}
            });
        });

        return () => {
            unsubAuth();
            unsubDetails();
            unsubMenuItems();
            unsubAssignments();
            unsubParticipants();
            clearCurrentEvent();
        };
    }, [eventId, setCurrentEvent, updateCurrentEventPartial, clearCurrentEvent]);

    const handleJoinEvent = useCallback(async (name: string) => {
        if (!eventId || !localUser || !name.trim()) return;
        setIsJoining(true);
        try {
            await FirebaseService.joinEvent(eventId, localUser.uid, name.trim());
            toast.success(t('eventPage.messages.welcomeUser', { name: name.trim() }));
            setShowNameModal(false);
            if (itemToAssignAfterJoin) {
                setModalState({ type: 'assign', item: itemToAssignAfterJoin });
                setItemToAssignAfterJoin(null);
            }
        } catch (error) {
            toast.error(t('eventPage.messages.joinError'));
        } finally {
            setIsJoining(false);
        }
    }, [eventId, localUser, itemToAssignAfterJoin]);

    const handleAssignClick = (item: MenuItemType) => {
        if (!localUser) return;
        const isParticipant = participants.some(p => p.id === localUser.uid);

        // CHECK: Does the user already have an assignment for this item?
        const existingAssignment = assignments.find(a => a.menuItemId === item.id && a.userId === localUser.uid);

        if (existingAssignment) {
            // Use existing logic for editing an assignment
            setModalState({ type: 'add-more', item, assignment: existingAssignment });
        } else if (localUser.isAnonymous && !isParticipant) {
            setItemToAssignAfterJoin(item);
            setShowNameModal(true);
        } else {
            setModalState({ type: 'assign', item });
        }
    };

    const handleCancelClick = async (assignment: AssignmentType) => {
        if (!eventId || !localUser) return;

        const item = menuItems.find(i => i.id === assignment.menuItemId);
        if (!item) {
            toast.error(t('eventPage.messages.itemNotFound'));
            return;
        }

        const isCreator = item.creatorId === localUser.uid;
        const isSelfAssignment = assignment.userId === localUser.uid;

        // Logic split:
        // 1. If deleting SOMEONE ELSE (Manager/Admin action) -> Just Unassign.
        // 2. If deleting SELF (Creator/User action) -> Unassign, but check if item should be deleted.

        if (!isSelfAssignment) {
            // Manager deleting someone else
            if (window.confirm(t('eventPage.messages.cancelAssignmentConfirmWithName', { name: assignment.userName }))) {
                try {
                    await FirebaseService.cancelAssignment(eventId, assignment.id, assignment.menuItemId);
                    toast.success(t('eventPage.messages.assignmentCancelled'));
                } catch (error) {
                    toast.error(t('eventPage.messages.cancelAssignmentError'));
                }
            }
            return;
        }

        // Deleting SELF
        // Check if there are OTHER active assignments
        const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
        const hasOthers = itemAssignments.some(a => a.userId !== localUser.uid);

        if (isCreator && !hasOthers) {
            // I am Creator + Last One -> Ask to delete ITEM
            if (window.confirm(t('eventPage.messages.confirmDeleteEmptyItem'))) {
                try {
                    await FirebaseService.deleteMenuItem(eventId, item.id);
                    toast.success(t('eventPage.messages.itemDeleted'));
                } catch (error) {
                    toast.error(t('eventPage.messages.deleteItemError'));
                }
            }
        } else if (isCreator && hasOthers) {
            // I am Creator + Others Exist -> Warn item stays -> Unassign me
            if (window.confirm(t('eventPage.messages.confirmUnassignCreatorKeepItem'))) {
                try {
                    await FirebaseService.cancelAssignment(eventId, assignment.id, assignment.menuItemId);
                    toast.success(t('eventPage.messages.assignmentCancelled'));
                } catch (error) {
                    toast.error(t('eventPage.messages.cancelAssignmentError'));
                }
            }
        } else {
            // Regular user unassigning

            // SMART CANCEL: Check for Twin Assignment
            const isRide = item.category === 'ride_offers' || item.category === 'ride_requests' || item.category === 'trempim';
            let twinAssignmentCancelled = false;

            if (isRide && item.direction && (item.direction as string) !== 'both') {
                const oppositeDir = item.direction === 'to_event' ? 'from_event' : 'to_event';

                // Find Twin Item
                const twinItem = menuItems.find(i =>
                    i.id !== item.id &&
                    i.creatorId === item.creatorId &&
                    i.direction === oppositeDir &&
                    (i.category === 'ride_offers' || i.category === 'ride_requests' || i.category === 'trempim')
                );

                if (twinItem) {
                    // Find My Assignment on Twin
                    const myTwinAssignment = assignments.find(a =>
                        a.menuItemId === twinItem.id &&
                        a.userId === localUser.uid
                    );

                    if (myTwinAssignment) {
                        const dirText = oppositeDir === 'to_event' ? 'בהלוך' : 'בחזור';
                        // Custom Confirm for Round Trip
                        if (window.confirm(`שמנו לב שאתה רשום גם לנסיעה ${dirText}. האם תרצה לבטל גם אותה?\n\nאישור = בטל את שתי הנסיעות\nביטול = בטל רק את הנוכחית`)) {
                            try {
                                await FirebaseService.cancelAssignment(eventId, myTwinAssignment.id, myTwinAssignment.menuItemId);
                                toast.success('הנסיעה המקבילה בוטלה בהצלחה');
                                twinAssignmentCancelled = true;
                            } catch (error) {
                                console.error('Failed to cancel twin', error);
                                toast.error('שגיאה בביטול הנסיעה המקבילה');
                            }
                        }
                    }
                }
            }

            // Continue with Current Cancellation
            if (window.confirm(t('eventPage.messages.cancelAssignmentConfirm'))) {
                try {
                    await FirebaseService.cancelAssignment(eventId, assignment.id, assignment.menuItemId);
                    toast.success(twinAssignmentCancelled ? 'שתי הנסיעות בוטלו בהצלחה' : t('eventPage.messages.assignmentCancelled'));
                } catch (error) {
                    toast.error(t('eventPage.messages.cancelAssignmentError'));
                }
            }
        }
    };

    const handleDeleteItem = async (item: MenuItemType) => {
        if (!eventId || !localUser) return;

        const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
        const count = itemAssignments.length;

        const confirmMsg = count > 0
            ? t('eventPage.messages.confirmDeleteItemWithParticipants', { count })
            : t('eventPage.messages.confirmDeleteEmptyItem');

        if (window.confirm(confirmMsg)) {
            try {
                await FirebaseService.deleteMenuItem(eventId, item.id);
                toast.success(t('eventPage.messages.itemDeleted'));
            } catch (error) {
                toast.error(t('eventPage.messages.deleteItemError'));
            }
        }
    }

    const handleEditClick = (item: MenuItemType, assignment: AssignmentType) => setModalState({ type: 'edit', item, assignment });
    const handleEditItemClick = (item: MenuItemType) => setModalState({ type: 'edit-item', item });
    const handleBackToCategories = () => { setView('categories'); setSelectedCategory(null); setSearchTerm(''); };
    const handleAllCategoriesClick = () => { setView('categories'); setSelectedCategory(null); setSearchTerm(''); };
    const handleCategoryClick = (category: string) => { setSelectedCategory(category); setView('items'); };

    const handleMyAssignmentsClick = () => {
        if (view === 'items' && selectedCategory === 'my-assignments') {
            setView('categories');
            setSelectedCategory(null);
            setSearchTerm('');
        } else {
            setSelectedCategory('my-assignments');
            setView('items');
        }
    };
    const handleAssignedClick = () => {
        if (view === 'items' && selectedCategory === 'assigned') {
            setView('categories');
            setSelectedCategory(null);
            setSearchTerm('');
        } else {
            setSelectedCategory('assigned');
            setView('items');
        }
    };
    const handleUnassignedClick = () => {
        if (view === 'items' && selectedCategory === 'unassigned') {
            setView('categories');
            setSelectedCategory(null);
            setSearchTerm('');
        } else {
            setSelectedCategory('unassigned');
            setView('items');
        }
    };

    // 🚀 OPTIMIZATION: Use debounced search term to reduce filtering operations
    const itemsToDisplay = useMemo(() => {
        let baseItems = menuItems;
        if (debouncedSearchTerm) {
            baseItems = baseItems.filter(item => item.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
        }
        if (selectedCategory === 'my-assignments' && localUser) {
            baseItems = baseItems.filter(item => assignments.some(a => a.menuItemId === item.id && a.userId === localUser.uid));
        } else if (selectedCategory === 'assigned') {
            baseItems = baseItems.filter(item => assignments.some(a => a.menuItemId === item.id));
        } else if (selectedCategory === 'unassigned') {
            baseItems = baseItems.filter(item => {
                const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
                const totalAssigned = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
                return totalAssigned < item.quantity;
            });
        } else if (selectedCategory) {
            baseItems = baseItems.filter(item => item.category === selectedCategory);
        }
        const assignedItems = baseItems.filter(item => assignments.some(a => a.menuItemId === item.id));
        const availableItems = baseItems.filter(item => !assignments.some(a => a.menuItemId === item.id));
        return [...availableItems, ...assignedItems];
    }, [debouncedSearchTerm, selectedCategory, localUser, menuItems, assignments]);

    if (isLoading || isEventLoading) {
        return <LoadingSpinner />;
    }

    if (!currentEvent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
                <AlertCircle size={64} className="text-error" />
                <h1 className="mt-6 text-4xl font-bold text-neutral-800">{t('eventPage.error.oops')}</h1>
                <p className="mt-2 text-lg text-neutral-600">{t('eventPage.error.eventNotFound')}</p>
                <Link
                    to="/"
                    className="mt-8 inline-block bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                    {t('common.backToHome')}
                </Link>
            </div>
        );
    }

    const isEventActive = currentEvent.details.isActive && !isEventFinished(currentEvent.details.date, currentEvent.details.time);



    const handleAddToCalendar = () => {
        if (!currentEvent) return;
        const { title, date, time, location } = currentEvent.details;

        const startDateTime = new Date(`${date}T${time}`);
        const endDateTime = new Date(startDateTime.getTime() + (2 * 60 * 60 * 1000));

        const formatTime = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

        const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatTime(startDateTime)}/${formatTime(endDateTime)}&details=${encodeURIComponent("נוצר באמצעות שישי שיתופי")}&location=${encodeURIComponent(location)}`;

        window.open(gCalUrl, '_blank');
    };

    if (!isEventActive) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
                <AlertCircle size={64} className="text-info" />
                <h1 className="mt-6 text-4xl font-bold text-neutral-800">{t('eventPage.status.inactive')}</h1>
                <p className="mt-2 text-lg text-neutral-600">{t('eventPage.status.inactiveSubtitle')}</p>
                <Link
                    to="/"
                    className="mt-8 inline-block bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                    {t('common.backToHome')}
                </Link>
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-background">
            {/* Skip Link for Accessibility */}
            <a
                href="#main-content"
                className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-accent focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg"
            >
                {t('common.skipToContent') || 'דלג לתוכן הראשי'}
            </a>



            <main id="main-content" className="max-w-4xl mx-auto py-4 px-4">
                <div className="bg-white rounded-xl shadow-md p-4 mb-4">
                    <div className="flex justify-between items-start mb-3 gap-4">
                        <h1
                            className="text-xl font-bold text-neutral-900 break-words cursor-pointer active:opacity-70 transition-opacity"
                            title={isTitleExpanded ? t('common.showLess') : currentEvent.details.title}
                            onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                        >
                            {(!isTitleExpanded && currentEvent.details.title.length > 32)
                                ? `${currentEvent.details.title.slice(0, 32)}...`
                                : currentEvent.details.title}
                        </h1>

                        {showAdminButton && (
                            <button
                                onClick={() => setShowParticipantsList(true)}
                                className="flex items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors flex-shrink-0"
                                title={t('eventPage.participantsList.tooltip')}
                                aria-label={t('eventPage.participantsList.button')}
                            >
                                <img src="/Icons/audience.png" alt="participants" className="w-6 h-6" />
                            </button>
                        )}

                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
                        {/* Interactive Date -> Add to Calendar */}
                        <button
                            onClick={handleAddToCalendar}
                            type="button"
                            className="flex items-center hover:text-accent hover:font-medium transition-colors group"
                            title={t('eventPage.details.addToCalendar')}
                            aria-label={`${t('eventPage.details.addToCalendar')}: ${new Date(currentEvent.details.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}`}
                        >
                            <CalendarPlus size={14} className="ml-1.5 flex-shrink-0 group-hover:text-accent" aria-hidden="true" />
                            {new Date(currentEvent.details.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}
                        </button>

                        {/* Time (Static) */}
                        <p className="flex items-center"><Clock size={14} className="ml-1.5 flex-shrink-0" aria-hidden="true" /> {currentEvent.details.time}</p>

                        {/* Interactive Location -> Navigation Menu */}
                        <NavigationMenu location={currentEvent.details.location} />


                        {/* Organizer (Static) */}
                        <p className="flex items-center"><UserIcon size={14} className="ml-1.5 flex-shrink-0" aria-hidden="true" /> {t('eventPage.details.organizer')}: {currentEvent.organizerName}</p>

                        {/* Stats Badges (Moved here) */}
                        <div className="flex items-center gap-2 mr-auto sm:mr-0 border-r pr-4 border-gray-300 sm:border-0 sm:pr-0">
                            {/* Added border/padding for visual separation if needed, but flex-wrap handles flow */}
                            {assignmentStats.requiredTotal > 0 && (
                                <div className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full whitespace-nowrap">
                                    {t('eventPage.stats.required.text', { count: assignmentStats.requiredAssigned, total: assignmentStats.requiredTotal })}
                                </div>
                            )}
                            {assignmentStats.optionalTotal > 0 && (
                                <div className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full whitespace-nowrap">
                                    {t('eventPage.stats.optional.text', { count: assignmentStats.optionalAssigned, total: assignmentStats.optionalTotal })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-3 mb-6">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <div className="flex-grow relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSearchTerm(value);
                                    if (value.trim()) {
                                        setView('items');
                                        setSelectedCategory(null);
                                    } else {
                                        setView('categories');
                                        setSelectedCategory(null);
                                    }
                                }}
                                placeholder={t('eventPage.searchPlaceholder')}
                                aria-label={t('eventPage.searchPlaceholder')}
                                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 shadow-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setView('categories');
                                        setSelectedCategory(null);
                                    }}
                                    type="button"
                                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    aria-label={t('common.clearSearch')}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex overflow-x-auto pb-2 gap-2 mt-4 no-scrollbar">
                        <button
                            onClick={handleAllCategoriesClick}
                            type="button"
                            className={`px-3 py-1.5 text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap border ${!selectedCategory && view === 'categories'
                                ? 'bg-accent text-white border-accent'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {t('eventPage.filter.all')}
                        </button>
                        <button
                            onClick={handleMyAssignmentsClick}
                            type="button"
                            className={`px-3 py-1.5 text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap border ${selectedCategory === 'my-assignments'
                                ? 'bg-accent text-white border-accent'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                        >
                            {t('eventPage.filter.my-assignments')}
                        </button>
                        {isOrganizer && (
                            <>
                                <button
                                    onClick={handleAssignedClick}
                                    type="button"
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap border ${selectedCategory === 'assigned'
                                        ? 'bg-accent text-white border-accent'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {t('eventPage.filter.assigned')}
                                </button>
                                <button
                                    onClick={handleUnassignedClick}
                                    type="button"
                                    className={`px-3 py-1.5 text-sm font-semibold rounded-lg shadow-sm transition-all whitespace-nowrap border ${selectedCategory === 'unassigned'
                                        ? 'bg-accent text-white border-accent'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    {t('eventPage.filter.unassigned')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {view === 'categories' ? (
                    <>
                        <CategorySelector
                            menuItems={menuItems}
                            assignments={assignments}
                            onSelectCategory={handleCategoryClick}
                            onAddItem={() => {
                                if (canAddMoreItems) {
                                    setModalState({ type: 'add-user-item', rowType: 'offers' });
                                } else {
                                    toast.error(t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS }));
                                }
                            }}
                            canAddMoreItems={canAddMoreItems}
                            userCreatedItemsCount={userCreatedItemsCount}
                            MAX_USER_ITEMS={MAX_USER_ITEMS}
                            showLimit={!showAdminButton}
                            categories={getEventCategories(currentEvent || undefined)}
                            onOfferRide={currentEvent?.details.allowRideOffers !== false ? () => {
                                // Check if user already has a ride offer
                                if (localUser) {
                                    const userHasRide = menuItems.some(item =>
                                        (item.category === 'ride_offers' || item.category === 'trempim' || item.category === 'rides') &&
                                        item.creatorId === localUser.uid &&
                                        item.rowType === 'offers'
                                    );

                                    if (userHasRide) {
                                        toast.error("כבר פרסמת נסיעה. ניתן לערוך את הנסיעה הקיימת.");
                                        return;
                                    }
                                }

                                setModalState({ type: 'add-user-item', category: 'ride_offers', rowType: 'offers' });
                            } : undefined}
                            onRideRequest={currentEvent?.details.allowRideRequests !== false ? () => {
                                if (localUser) {
                                    const userHasRequest = menuItems.some(item =>
                                        (item.category === 'ride_requests' || item.category === 'trempim' || item.category === 'rides') &&
                                        item.creatorId === localUser.uid &&
                                        item.rowType === 'needs'
                                    );

                                    if (userHasRequest) {
                                        toast.error("כבר פרסמת בקשת נסיעה. ניתן לערוך את הבקשה הקיימת.");
                                        return;
                                    }
                                }
                                setModalState({ type: 'add-user-item', category: 'ride_requests', rowType: 'needs' });
                            } : undefined}
                        />
                        <div className="max-w-4xl mx-auto px-4 mt-8">
                            {/* Button removed as it is now inside CategorySelector */}
                        </div>
                    </>
                ) : (
                    <div>
                        <button
                            onClick={handleBackToCategories}
                            type="button"
                            className="flex items-center text-sm font-semibold text-accent hover:underline mb-4"
                        >
                            <ArrowRight size={16} className="ml-1" aria-hidden="true" />
                            {t('eventPage.backToCategories')}
                        </button>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-neutral-800">
                                {searchTerm
                                    ? t('eventPage.list.searchResults')
                                    : (selectedCategory === 'my-assignments' || selectedCategory === 'assigned' || selectedCategory === 'unassigned')
                                        ? t(`eventPage.filter.${selectedCategory}`)
                                        : getCategoryName(selectedCategory!)}
                            </h2>
                            {selectedCategory && selectedCategory !== 'my-assignments' && currentEvent?.details.allowUserItems && (
                                <button
                                    onClick={() => {
                                        if (localUser && (selectedCategory === 'ride_offers' || selectedCategory === 'ride_requests')) {
                                            const isRideOffer = selectedCategory === 'ride_offers';
                                            const alreadyHasOne = menuItems.some(item =>
                                                item.creatorId === localUser.uid &&
                                                (isRideOffer
                                                    ? (item.category === 'ride_offers' || item.category === 'trempim' || item.category === 'rides')
                                                    : (item.category === 'ride_requests')
                                                )
                                            );

                                            if (alreadyHasOne && !showAdminButton) {
                                                toast.error(isRideOffer
                                                    ? "כבר פרסמת נסיעה. ניתן לערוך את הנסיעה הקיימת."
                                                    : "כבר פרסמת בקשת טרמפ. ניתן לערוך את הבקשה הקיימת."
                                                );
                                                return;
                                            }
                                        }

                                        if (canAddMoreItems) {
                                            setModalState({ type: 'add-user-item', item: undefined, assignment: undefined, category: selectedCategory as any });
                                        } else {
                                            toast.error(t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS }));
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-lg shadow-sm hover:opacity-90 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm flex items-center text-white ${selectedCategory === 'ride_offers' || selectedCategory === 'ride_requests' ? 'bg-rides-primary' : 'bg-accent'
                                        }`}
                                    disabled={!canAddMoreItems}
                                    aria-label={`${t('eventPage.category.addItem')} ${(!showAdminButton && selectedCategory !== 'ride_offers' && selectedCategory !== 'ride_requests') ? `(${userCreatedItemsCount}/${MAX_USER_ITEMS})` : ''}`}
                                >
                                    <Plus size={16} className="inline-block ml-1" aria-hidden="true" />
                                    {selectedCategory === 'ride_offers' ? 'הצע טרמפ' : selectedCategory === 'ride_requests' ? 'בקש טרמפ' : t('eventPage.category.addItem')} {(!showAdminButton && selectedCategory !== 'ride_offers' && selectedCategory !== 'ride_requests') && `(${userCreatedItemsCount}/${MAX_USER_ITEMS})`}
                                </button>
                            )}

                        </div>
                        {itemsToDisplay.length > 0 ? (
                            <div className="space-y-6">
                                {(() => {
                                    const itemsInList = itemsToDisplay;
                                    const isAnyRide = itemsInList.some(item => isCarpoolLogic(item.name, item.category, item.rowType));

                                    const isRideContext = selectedCategory === 'ride_offers' || selectedCategory === 'ride_requests' || selectedCategory === 'trempim' || selectedCategory === 'rides' || (itemsInList.length > 0 && isAnyRide && searchTerm);

                                    // Helper to check if item is completed
                                    const isItemCompleted = (item: MenuItemType) => {
                                        const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
                                        if (itemAssignments.length === 0) return false;

                                        if (item.isSplittable) {
                                            const totalAssigned = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
                                            return totalAssigned >= item.quantity;
                                        }

                                        return true;
                                    };

                                    // Group Items
                                    const displayItems = groupItemsByDriver(itemsInList);

                                    // Filter Groups based on Completion
                                    const isGroupCompleted = (d: DisplayItem) => {
                                        if (d.type === 'single') return isItemCompleted(d.item);

                                        // For group, considered completed only if BOTH are completed (or non-existent)
                                        const outDone = d.group.outbound ? isItemCompleted(d.group.outbound) : true;
                                        const retDone = d.group.returnRide ? isItemCompleted(d.group.returnRide) : true;
                                        return outDone && retDone;
                                    };

                                    const availableDisplay = displayItems.filter(d => !isGroupCompleted(d));
                                    const assignedDisplay = displayItems.filter(d => isGroupCompleted(d));

                                    const renderDisplayItem = (d: DisplayItem) => {
                                        if (d.type === 'group') {
                                            return (
                                                <UnifiedRideCard
                                                    key={d.group.id}
                                                    group={d.group}
                                                    assignments={assignments}
                                                    isEventActive={isEventActive}
                                                    isOrganizer={!!showAdminButton}
                                                    currentUserId={localUser?.uid}
                                                    onAssign={handleAssignClick}
                                                    onCancel={handleCancelClick}
                                                    onEditItem={handleEditItemClick}
                                                    onDeleteItem={handleDeleteItem}
                                                    onEditAssignment={(_, a) => handleEditClick(_, a)}
                                                />
                                            );
                                        }

                                        const item = d.item;
                                        // 🚀 OPTIMIZATION: Use indexed map instead of filtering entire array
                                        const itemAssignments = assignmentsByItemId.get(item.id) || [];
                                        const assignment = itemAssignments.find(a => a.userId === localUser?.uid);
                                        const commonProps = {
                                            key: item.id,
                                            item,
                                            assignment,
                                            assignments: itemAssignments,
                                            onAssign: () => handleAssignClick(item),
                                            onEdit: () => handleEditClick(item, assignment!),
                                            onEditItem: () => handleEditItemClick(item),
                                            onCancel: (a: AssignmentType) => handleCancelClick(a || assignment!),
                                            onDeleteItem: () => handleDeleteItem(item),
                                            isMyAssignment: localUser?.uid === assignment?.userId,
                                            isEventActive,
                                            isOrganizer: !!showAdminButton,
                                            currentUserId: localUser?.uid,
                                            categoryDisplayName: getCategoryName(item.category),
                                            eventName: currentEvent.details.title,
                                            onEditAssignment: (a: AssignmentType) => handleEditClick(item, a)
                                        };

                                        const isRide = isCarpoolLogic(item.name, item.category, item.rowType);
                                        return isRide ? <RideCard {...commonProps} /> : <ItemCard {...commonProps} />;
                                    };

                                    return (
                                        <>
                                            {availableDisplay.length > 0 && (
                                                <div>
                                                    <h3 className={`text-md font-semibold mb-3 ${isRideContext ? 'text-rides-primary' : 'text-neutral-700'}`}>
                                                        {isRideContext
                                                            ? (selectedCategory === 'ride_requests' ? 'בקשות פתוחות' : 'נסיעות פנויות')
                                                            : t('eventPage.list.available')}
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {availableDisplay.map(renderDisplayItem)}
                                                    </div>
                                                </div>
                                            )}

                                            {assignedDisplay.length > 0 && (
                                                <div className={availableDisplay.length > 0 ? 'pt-6 border-t' : ''}>
                                                    <h3 className={`text-md font-semibold mb-3 ${isRideContext ? 'text-rides-primary' : 'text-neutral-700'}`}>
                                                        {isRideContext
                                                            ? (selectedCategory === 'ride_requests' ? 'בקשות שטופלו' : 'רכבים מלאים')
                                                            : t('eventPage.list.completed')}
                                                    </h3>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {assignedDisplay.map(renderDisplayItem)}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        ) : (
                            <p className="text-center text-neutral-500 py-8">{t('eventPage.list.noItems')}</p>
                        )}
                    </div>
                )}
            </main>

            <div className="max-w-4xl mx-auto px-4 mt-8 mb-8">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center">
                    <div className="flex justify-center mb-3">
                        <div className="bg-orange-100 rounded-full p-3">
                            <ChefHat className="h-6 w-6 text-orange-500" aria-hidden="true" />
                        </div>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mb-1">{t('eventPage.promo.title')}</h2>
                    <p className="text-gray-600 text-sm mb-4">{t('eventPage.promo.subtitle')}</p>
                    <Link
                        to="/"
                        className="inline-block bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 transition-colors shadow hover:shadow-md text-sm"
                    >
                        {t('eventPage.promo.register')}
                    </Link>
                </div>
            </div>

            {showNameModal && (<NameModal isLoading={isJoining} onSave={handleJoinEvent} onClose={() => setShowNameModal(false)} />)}

            {localUser && modalState?.type === 'assign' && modalState.item && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} itemRowType={modalState.item.rowType} />)}
            {localUser && modalState?.type === 'edit' && modalState.item && modalState.assignment && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} isEdit={true} existingAssignment={modalState.assignment} itemRowType={modalState.item.rowType} />)}
            {localUser && modalState?.type === 'add-more' && modalState.item && modalState.assignment && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} isEdit={true} isAddMore={true} existingAssignment={modalState.assignment} itemRowType={modalState.item.rowType} />)}

            {modalState?.type === 'add-user-item' && currentEvent && (
                <UserMenuItemForm
                    event={currentEvent}
                    onClose={() => setModalState(null)}
                    category={modalState.category as any}
                    isOrganizer={isOrganizer}
                    onSuccess={(cat) => setLastManualCategory(cat)}
                    initialCategory={modalState.category}
                    initialRowType={modalState.rowType}
                />
            )}

            {modalState?.type === 'edit-item' && modalState.item && (
                <EditItemModal
                    item={modalState.item}
                    eventId={eventId!}
                    assignments={assignments}
                    onClose={() => setModalState(null)}
                />
            )}

            {showParticipantsList && (
                <ParticipantsListModal
                    assignments={assignments}
                    menuItems={menuItems}
                    onClose={() => setShowParticipantsList(false)}
                    onDeleteAssignment={async (assignmentId, menuItemId) => {
                        if (!eventId) return;
                        await FirebaseService.cancelAssignment(eventId, assignmentId, menuItemId);
                    }}
                    isOrganizer={!!showAdminButton}
                />
            )}
        </div>
    );
};

export default EventPage;