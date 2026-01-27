// src/pages/EventPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useStore, selectMenuItems, selectAssignments, selectParticipants } from '../store/useStore';
import { FirebaseService } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { ShishiEvent, MenuItem as MenuItemType, Assignment as AssignmentType } from '../types';
import { CalendarPlus, Clock, MapPin, ChefHat, User as UserIcon, AlertCircle, Edit, X, Search, ArrowRight, Trash2, MessageSquare, Plus, Shield, Minus } from 'lucide-react';
import { isEventFinished } from '../utils/dateUtils';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { UserMenuItemForm } from '../components/Events/UserMenuItemForm';
import { CategorySelector } from '../components/Events/CategorySelector';

// Category names mapping
const categoryNames: { [key: string]: string } = {
    starter: 'מנה ראשונה',
    main: 'מנה עיקרית',
    dessert: 'קינוחים',
    drink: 'משקאות',
    other: 'אחר'
};


// --- Component: CategorySelector removed, using imported component ---


// --- Component: MenuItemCard ---
const MenuItemCard: React.FC<{
    item: MenuItemType;
    assignment: AssignmentType | undefined;
    assignments: AssignmentType[];
    onAssign: () => void;
    onEdit: () => void;
    onCancel: (a?: AssignmentType) => void;
    isMyAssignment: boolean;
    isEventActive: boolean;
    currentUserId?: string;
}> = ({ item, assignment, assignments = [], onAssign, onEdit, onCancel, isMyAssignment, isEventActive, currentUserId }) => {
    const assignedByOther = assignment && !isMyAssignment;
    const isSplittable = item.isSplittable;
    const totalQuantity = item.quantity;

    // Calculate filled quantity
    const filledQuantity = isSplittable
        ? assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
        : (assignment ? item.quantity : 0);

    const isFull = filledQuantity >= totalQuantity;
    const progressPercent = Math.min(100, (filledQuantity / totalQuantity) * 100);

    // My assignments for this item
    const myAssignments = currentUserId
        ? assignments.filter(a => a.userId === currentUserId)
        : (isMyAssignment && assignment ? [assignment] : []);

    const hasMyAssignment = myAssignments.length > 0;

    const cardStyles = hasMyAssignment
        ? 'bg-blue-50 border-blue-200'
        : assignedByOther
            ? 'bg-green-50 border-green-200'
            : 'bg-white border-gray-200';

    return (
        <div className={`border-2 flex flex-col rounded-xl ${cardStyles}`}>
            <div className="p-4 flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 text-base">{item.name}</h4>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border border-current text-gray-700">{categoryNames[item.category]}</span>
                </div>
                <p className="text-sm text-gray-700 font-medium">
                    {isSplittable ? `סה"כ נדרש: ${item.quantity}` : `כמות נדרשת: ${item.quantity}`}
                </p>
                {item.creatorName && <p className="text-xs text-gray-500 mt-1">נוצר ע"י: {item.creatorName}</p>}
                {item.notes && <p className="text-xs text-gray-600 mt-2 italic bg-gray-50 p-2 rounded border border-gray-100">הערות: {item.notes}</p>}

                {/* Progress Bar for Splittable Items */}
                {isSplittable && (
                    <div className="mt-3">
                        <div className="flex justify-between text-xs mb-1 text-gray-700 font-medium">
                            <span>התקדמות: {filledQuantity}/{totalQuantity}</span>
                            <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className={`h-2 transition-all duration-300 ${isFull ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>
                        {assignments.length > 0 && (
                            <div className="mt-2 text-xs text-gray-700">
                                <p className="font-semibold mb-1 text-gray-800">משובצים:</p>
                                <ul className="list-disc list-inside space-y-1">
                                    {assignments.map(a => (
                                        <li key={a.id}>
                                            <span className="font-medium">{a.userName}</span> ({a.quantity}) {a.notes && <span className="italic text-gray-500">- {a.notes}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
                {!isSplittable && (
                    <>
                        <p className="text-sm text-neutral-500">כמות נדרשת: {item.quantity}</p>
                        {item.creatorName && <p className="text-xs text-neutral-400 mt-1">נוצר ע"י: {item.creatorName}</p>}
                        {item.notes && <p className="text-xs text-neutral-500 mt-2 italic">הערות: {item.notes}</p>}
                    </>
                )}
            </div>
            <div className="border-t border-gray-100 p-3 bg-gray-50/50 rounded-b-xl">
                {isSplittable ? (
                    <div className="space-y-3">
                        {hasMyAssignment && (
                            <div className="bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
                                <p className="text-xs font-bold text-blue-800 mb-2">התרומה שלי:</p>
                                <ul className="space-y-2">
                                    {myAssignments.map(myAss => (
                                        <li key={myAss.id} className="flex justify-between items-center text-sm group">
                                            <span>
                                                <span className="font-bold text-blue-700">{myAss.quantity} יח'</span>
                                                {myAss.notes && <span className="text-xs text-gray-600 mr-2">- {myAss.notes}</span>}
                                            </span>
                                            {isEventActive && (
                                                <button
                                                    onClick={() => onCancel(myAss)}
                                                    className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-red-500"
                                                    title="בטל שיבוץ זה"
                                                    aria-label="בטל שיבוץ"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {isEventActive && !isFull && (
                            <button
                                onClick={onAssign}
                                className="w-full bg-orange-600 text-white py-3 text-sm rounded-lg hover:bg-orange-700 font-semibold transition-colors shadow-sm focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
                                aria-label="שבץ אותי לפריט זה"
                            >
                                {hasMyAssignment ? 'הוסף עוד' : 'שבץ אותי'}
                            </button>
                        )}

                        {isFull && (
                            <p className="text-sm text-center text-green-700 font-medium">הפריט הושלם ✔️</p>
                        )}
                    </div>
                ) : (
                    <>
                        {isMyAssignment && assignment ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm bg-white p-2 rounded border border-blue-100">
                                    <span className="font-semibold text-blue-700">השיבוץ שלי</span>
                                    <span className="font-bold text-gray-900">{assignment.quantity}</span>
                                </div>
                                {assignment.notes && <p className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-100">הערה: {assignment.notes}</p>}
                                {isEventActive && (
                                    <div className="flex space-x-2 rtl:space-x-reverse pt-2">
                                        <button
                                            onClick={onEdit}
                                            className="flex-1 text-sm bg-white border border-gray-300 hover:bg-gray-50 py-2 rounded flex items-center justify-center focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                                            aria-label="ערוך שיבוץ"
                                        >
                                            <Edit size={14} className="ml-1" /> ערוך
                                        </button>
                                        <button
                                            onClick={() => onCancel(assignment)}
                                            className="flex-1 text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded flex items-center justify-center focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                            aria-label="בטל שיבוץ"
                                        >
                                            <Trash2 size={14} className="ml-1" /> {item.creatorId === assignment.userId ? 'מחק פריט' : 'בטל שיבוץ'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            assignment ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-sm bg-green-50/50 p-2 rounded border border-green-100">
                                        <span className="font-semibold text-green-700">שובץ ל: {assignment.userName}</span>
                                        <span className="font-bold text-gray-900">{assignment.quantity}</span>
                                    </div>
                                    {assignment.notes && <p className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">הערה: {assignment.notes}</p>}
                                </div>
                            ) : (
                                isEventActive ? (
                                    <button
                                        onClick={onAssign}
                                        className="w-full bg-orange-600 text-white py-3 text-sm rounded-lg hover:bg-orange-700 font-semibold transition-colors shadow-sm focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
                                        aria-label="שבץ אותי לפריט זה"
                                    >
                                        שבץ אותי
                                    </button>
                                ) : (
                                    <p className="text-sm text-center text-gray-500">האירוע אינו פעיל</p>
                                )
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// --- Component: AssignmentModal ---
const AssignmentModal: React.FC<{
    item: MenuItemType;
    eventId: string;
    user: FirebaseUser;
    onClose: () => void;
    isEdit?: boolean;
    existingAssignment?: AssignmentType;
}> = ({ item, eventId, user, onClose, isEdit = false, existingAssignment }) => {
    const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
    const [notes, setNotes] = useState(existingAssignment?.notes || '');
    const [isLoading, setIsLoading] = useState(false);
    const [participantName, setParticipantName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);
    const [currentUserName, setCurrentUserName] = useState('');
    const [useNewName, setUseNewName] = useState(false);

    const assignments = useStore(selectAssignments);
    const maxQuantity = useMemo(() => {
        if (!item.isSplittable) return 1;

        const itemAssignments = assignments.filter(a => a.menuItemId === item.id && a.eventId === eventId);
        const currentTotal = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);

        let available = item.quantity - currentTotal;

        if (isEdit && existingAssignment) {
            available += existingAssignment.quantity;
        }

        return Math.max(0, available);
    }, [item, assignments, eventId, isEdit, existingAssignment]);

    useEffect(() => {
        if (!item.isSplittable) {
            setQuantity(1);
        } else if (!existingAssignment) {
            setQuantity(Math.min(1, maxQuantity));
        }
    }, [item.isSplittable, maxQuantity, existingAssignment]);

    useEffect(() => {
        const currentEvent = useStore.getState().currentEvent;
        const existingParticipant = currentEvent?.participants?.[user.uid];

        if (existingParticipant) {
            setCurrentUserName(existingParticipant.name);
            setShowNameInput(false);
        } else if (user.isAnonymous) {
            setShowNameInput(true);
        } else {
            setCurrentUserName(user.displayName || 'משתמש');
            setShowNameInput(false);
        }
    }, [user.uid, user.isAnonymous]);

    const handleSubmit = async () => {
        if (showNameInput && !participantName.trim()) {
            toast.error("כדי להשתבץ, יש להזין שם מלא.");
            return;
        }
        if (useNewName && !participantName.trim()) {
            toast.error("יש להזין שם חדש.");
            return;
        }
        if (quantity <= 0) { toast.error("הכמות חייבת להיות גדולה מ-0."); return; }
        if (item.isSplittable && quantity > maxQuantity) {
            toast.error(`הכמות המבוקשת גדולה מהכמות הפנויה (מקסימום ${maxQuantity}).`);
            return;
        }

        setIsLoading(true);
        try {
            let finalUserName = '';

            if (useNewName && participantName.trim()) {
                finalUserName = participantName.trim();
                await FirebaseService.joinEvent(eventId, user.uid, finalUserName);
            } else if (showNameInput && participantName.trim()) {
                finalUserName = participantName.trim();
                await FirebaseService.joinEvent(eventId, user.uid, finalUserName);
            } else {
                finalUserName = currentUserName;
            }

            if (isEdit && existingAssignment) {
                await FirebaseService.updateAssignment(eventId, existingAssignment.id, { quantity, notes: notes.trim(), userName: finalUserName });
                toast.success("השיבוץ עודכן בהצלחה!");
            } else {
                await FirebaseService.createAssignment(eventId, {
                    menuItemId: item.id, userId: user.uid, userName: finalUserName,
                    quantity, notes: notes.trim(), status: 'confirmed', assignedAt: Date.now(), eventId
                });
                toast.success(`שובצת בהצלחה לפריט: ${item.name}`);
            }
            onClose();
        } catch (error: any) { toast.error(error.message || "אירעה שגיאה."); }
        finally { setIsLoading(false); }
    };

    const handleIncrement = () => setQuantity(q => {
        const max = item.isSplittable ? maxQuantity : item.quantity;
        return Math.min(q + 1, max);
    });
    const handleDecrement = () => setQuantity(q => Math.max(1, q - 1));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b"><h2 className="text-lg font-semibold text-neutral-900">{isEdit ? 'עריכת שיבוץ' : 'שיבוץ פריט'}</h2><button onClick={onClose} className="text-neutral-500 hover:text-neutral-700"><X size={24} /></button></div>
                <div className="p-6">
                    <div className="bg-accent/10 p-4 rounded-lg mb-6 text-center"><p className="font-bold text-accent">{item.name}</p><p className="text-sm text-accent/80">כמות מוצעת: {item.quantity}</p></div>
                    <div className="space-y-4">
                        {currentUserName && !showNameInput && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-blue-800">תירשם בשם:</p>
                                        <p className="text-blue-700 font-semibold">{currentUserName}</p>
                                    </div>
                                    <button
                                        onClick={() => setUseNewName(true)}
                                        className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded"
                                    >
                                        שנה שם
                                    </button>
                                </div>
                            </div>
                        )}

                        {(showNameInput || useNewName) && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    {useNewName ? 'שם חדש*' : 'שם מלא*'}
                                </label>
                                <div className="relative">
                                    <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                                    <input
                                        type="text"
                                        value={participantName}
                                        onChange={e => setParticipantName(e.target.value)}
                                        placeholder={useNewName ? "השם החדש שיוצג" : "השם שיוצג לכולם"}
                                        className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500"
                                    />
                                </div>
                                {useNewName && (
                                    <div className="flex space-x-2 rtl:space-x-reverse mt-2">
                                        <button
                                            onClick={() => {
                                                setUseNewName(false);
                                                setParticipantName('');
                                            }}
                                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded"
                                        >
                                            ביטול
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stepper UI for Quantity */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-sm font-medium text-neutral-700">כמות שאביא*</label>
                                {item.isSplittable && (
                                    <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                                        נותרו: {maxQuantity}
                                    </span>
                                )}
                            </div>
<<<<<<< HEAD
    <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-12">
        <button
            type="button"
            onClick={handleDecrement}
            disabled={quantity <= 1}
            className="w-16 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-accent transition-colors border-l border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
            <Minus size={20} />
        </button>

        <div className="flex-1 flex items-center justify-center h-full bg-white font-bold text-xl text-neutral-800">
            {quantity}
        </div>

        <button
            type="button"
            onClick={handleIncrement}
            disabled={quantity >= (item.isSplittable ? maxQuantity : item.quantity)}
            className="w-16 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-accent transition-colors border-r border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
            <Plus size={20} />
    </div>
                        </div >
            </div >
        </div >
    <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">הערות (אופציונלי)</label>
        <div className="relative">
            <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-neutral-400" />
            <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500"
                rows={3}
                placeholder="לדוגמה: ללא גלוטן, טבעוני..."
            />
        </div>
    </div>
                    </div >
                </div >
    <div className="bg-neutral-50 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 font-medium">ביטול</button>
        <button onClick={handleSubmit} disabled={isLoading} className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:bg-neutral-300 font-medium">{isLoading ? 'מעדכן...' : isEdit ? 'שמור שינויים' : 'אשר שיבוץ'}</button>
    </div>
            </div >
        </div >
    );
};

const NameModal: React.FC<{ onSave: (name: string) => void, isLoading: boolean, onClose: () => void }> = ({ onSave, isLoading, onClose }) => {
    const [name, setName] = useState('');
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
                <div className="p-6 text-center">
                    <h2 className="text-xl font-bold text-neutral-900 mb-2">ברוכים הבאים!</h2>
                    <p className="text-gray-600 mb-4">כדי להשתתף באירוע, אנא הזן את שמך.</p>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="השם שלך" className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500" />
                    <div className="flex space-x-3 rtl:space-x-reverse mt-6">
                        <button type="button" onClick={onClose} disabled={isLoading} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">
                            ביטול
                        </button>
                        <button onClick={() => onSave(name)} disabled={!name.trim() || isLoading} className="flex-1 bg-accent text-white py-2 rounded-lg hover:bg-accent/90 disabled:bg-neutral-300">
                            {isLoading ? 'שומר...' : 'הצטרף לאירוע'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const EventPage: React.FC = () => {
    const { eventId } = useParams<{ eventId: string }>();
    const [localUser, setLocalUser] = useState<FirebaseUser | null>(null);
    const [isJoining, setIsJoining] = useState(false);
    const [isEventLoading, setIsEventLoading] = useState(true);

    const { currentEvent, setCurrentEvent, clearCurrentEvent, isLoading, user: storeUser } = useStore();

    const menuItems = useStore(selectMenuItems);
    const assignments = useStore(selectAssignments);
    const participants = useStore(selectParticipants);
    const userCreatedItemsCount = useMemo(() => {
        if (!localUser || !currentEvent?.userItemCounts) return 0;
        return currentEvent.userItemCounts[localUser.uid] || 0;
    }, [currentEvent, localUser]);

    const MAX_USER_ITEMS = currentEvent?.details.userItemLimit ?? 3;

    const canAddMoreItems = (currentEvent?.details.allowUserItems ?? false) && userCreatedItemsCount < MAX_USER_ITEMS;
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

    const [modalState, setModalState] = useState<{ type: 'assign' | 'edit' | 'add-user-item'; item?: MenuItemType; assignment?: AssignmentType; category?: string } | null>(null);
    const [itemToAssignAfterJoin, setItemToAssignAfterJoin] = useState<MenuItemType | null>(null);
    const [showNameModal, setShowNameModal] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [view, setView] = useState<'categories' | 'items'>('categories');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (user) setLocalUser(user);
            else signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
        });
        if (!eventId) return;

        setIsEventLoading(true);
        const unsubEvent = FirebaseService.subscribeToEvent(eventId, (eventData) => {
            setCurrentEvent(eventData);
            setIsEventLoading(false);
        });

        return () => {
            unsubAuth();
            unsubEvent();
            clearCurrentEvent();
        };
    }, [eventId, setCurrentEvent, clearCurrentEvent]);

    const handleJoinEvent = useCallback(async (name: string) => {
        if (!eventId || !localUser || !name.trim()) return;
        setIsJoining(true);
        try {
            await FirebaseService.joinEvent(eventId, localUser.uid, name.trim());
            toast.success(`ברוך הבא, ${name.trim()}!`);
            setShowNameModal(false);
            if (itemToAssignAfterJoin) {
                setModalState({ type: 'assign', item: itemToAssignAfterJoin });
                setItemToAssignAfterJoin(null);
            }
        } catch (error) { toast.error("שגיאה בהצטרפות לאירוע."); } finally { setIsJoining(false); }
    }, [eventId, localUser, itemToAssignAfterJoin]);

    const handleAssignClick = (item: MenuItemType) => {
        if (!localUser) return;
        const isParticipant = participants.some(p => p.id === localUser.uid);
        if (localUser.isAnonymous && !isParticipant) {
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
            toast.error("הפריט לא נמצא");
            return;
        }

        const isCreator = item.creatorId === localUser.uid;

        if (isCreator) {
            if (window.confirm("פעולה זו תמחק גם את הפריט וגם את השיבוץ")) {
                try {
                    await FirebaseService.deleteMenuItem(eventId, item.id);
                    toast.success("הפריט והשיבוץ נמחקו");
                } catch (error) {
                    toast.error("שגיאה במחיקת הפריט");
                }
            }
        } else {
            if (window.confirm("האם לבטל את השיבוץ?")) {
                try {
                    await FirebaseService.cancelAssignment(eventId, assignment.id, assignment.menuItemId);
                    toast.success("השיבוץ בוטל");
                } catch (error) {
                    toast.error("שגיאה בביטול השיבוץ");
                }
            }
        }
    };

    const handleEditClick = (item: MenuItemType, assignment: AssignmentType) => setModalState({ type: 'edit', item, assignment });
    const handleBackToCategories = () => { setView('categories'); setSelectedCategory(null); setSearchTerm(''); };
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

    const itemsToDisplay = useMemo(() => {
        let baseItems = menuItems;
        if (searchTerm) {
            baseItems = baseItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (selectedCategory === 'my-assignments' && localUser) {
            baseItems = baseItems.filter(item => assignments.some(a => a.menuItemId === item.id && a.userId === localUser.uid));
        } else if (selectedCategory) {
            baseItems = baseItems.filter(item => item.category === selectedCategory);
        }
        const assignedItems = baseItems.filter(item => assignments.some(a => a.menuItemId === item.id));
        const availableItems = baseItems.filter(item => !assignments.some(a => a.menuItemId === item.id));
        return [...availableItems, ...assignedItems];
    }, [searchTerm, selectedCategory, localUser, menuItems, assignments]);

    if (isLoading || isEventLoading) {
        return <LoadingSpinner />;
    }

    if (!currentEvent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center p-4">
                <AlertCircle size={64} className="text-error" />
                <h1 className="mt-6 text-4xl font-bold text-neutral-800">אופס!</h1>
                <p className="mt-2 text-lg text-neutral-600">נראה שהאירוע שחיפשת לא קיים.</p>
                <Link
                    to="/"
                    className="mt-8 inline-block bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                    חזור לדף הראשי
                </Link>
            </div>
        );
    }

    const participantName = participants.find(p => p.id === localUser?.uid)?.name || 'אורח';
    const isEventActive = currentEvent.details.isActive && !isEventFinished(currentEvent.details.date, currentEvent.details.time);

    const showAdminButton = storeUser?.isAdmin || (localUser && currentEvent.organizerId === localUser.uid);

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
                <h1 className="mt-6 text-4xl font-bold text-neutral-800">האירוע אינו פעיל</h1>
                <p className="mt-2 text-lg text-neutral-600">לא ניתן לשבץ פריטים חדשים.</p>
                <Link
                    to="/"
                    className="mt-8 inline-block bg-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-accent/90 transition-colors"
                >
                    חזור לדף הראשי
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="bg-white shadow-sm p-3 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto flex justify-between items-center">

                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div>
                            <h1 className="font-bold text-lg text-accent">שישי שיתופי</h1>
                            <p className="text-xs text-neutral-500">ניהול ארוחות משותפות</p>
                        </div>
                    </Link>

                    <div className="text-left flex items-center gap-3">
                        {showAdminButton && (
                            <Link
                                to="/"
                                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 transition-colors text-sm font-medium"
                                title="מעבר לפאנל ניהול"
                            >
                                <Shield size={16} />
                                <span className="hidden sm:inline">פאנל ניהול</span>
                            </Link>
                        )}

                        <div className="flex items-center justify-end space-x-2 rtl:space-x-reverse">
                            {localUser && !localUser.isAnonymous ? (
                                <Link to="/dashboard" className="text-sm font-medium text-accent hover:underline">
                                    {participantName}
                                </Link>
                            ) : (
                                <a href="/login" className="text-sm font-medium text-accent hover:underline">
                                    {participantName}
                                </a>
                            )}
                            <UserIcon size={16} className="text-neutral-500" />
                        </div>

                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto py-4 px-4">
                <div className="bg-white rounded-xl shadow-md p-4 mb-4">
                    <div className="flex justify-between items-start mb-3">
                        <h1 className="text-xl font-bold text-neutral-900">{currentEvent.details.title}</h1>
                        <div className="flex flex-col items-end gap-y-2">
                            {assignmentStats.requiredTotal > 0 && (
                                <div className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-full whitespace-nowrap" title="פריטי חובה">
                                    <span>חובה: {assignmentStats.requiredAssigned}/{assignmentStats.requiredTotal} שובצו</span>
                                </div>
                            )}
                            {assignmentStats.optionalTotal > 0 && (
                                <div className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded-full whitespace-nowrap" title="פריטי רשות">
                                    <span>רשות: {assignmentStats.optionalAssigned}/{assignmentStats.optionalTotal} שובצו</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-600">
                        {/* Interactive Date -> Add to Calendar */}
                        <button
                            onClick={handleAddToCalendar}
                            className="flex items-center hover:text-accent hover:font-medium transition-colors group"
                            title="הוסף ליומן גוגל"
                        >
                            <CalendarPlus size={14} className="ml-1.5 flex-shrink-0 group-hover:text-accent" />
                            {new Date(currentEvent.details.date).toLocaleDateString('he-IL')}
                        </button>

                        {/* Time (Static) */}
                        <p className="flex items-center"><Clock size={14} className="ml-1.5 flex-shrink-0" /> {currentEvent.details.time}</p>

                        {/* Interactive Location -> Google Maps */}
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentEvent.details.location)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center hover:text-blue-600 hover:underline transition-colors group"
                            title="נווט עם Google Maps / Waze"
                        >
                            <MapPin size={14} className="ml-1.5 flex-shrink-0 group-hover:text-blue-500" />
                            {currentEvent.details.location}
                        </a>

                        {/* Organizer (Static) */}
                        <p className="flex items-center"><UserIcon size={14} className="ml-1.5 flex-shrink-0" /> מארגן: {currentEvent.organizerName}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-3 mb-6">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <div className="flex-grow relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setView('items'); setSelectedCategory(null); }}
                                placeholder="חפש פריט..."
                                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 shadow-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    aria-label="נקה חיפוש"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <button onClick={handleMyAssignmentsClick} className={`px-3 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap ${selectedCategory === 'my-assignments' ? 'bg-accent text-white' : 'bg-primary text-white hover:bg-primary/90'}`}>
                            השיבוצים שלי
                        </button>
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
                                    setModalState({ type: 'add-user-item' });
                                } else {
                                    toast.error(`הגעת למכסת ${MAX_USER_ITEMS} הפריטים שניתן להוסיף.`);
                                }
                            }}
                            canAddMoreItems={canAddMoreItems}
                            userCreatedItemsCount={userCreatedItemsCount}
                            MAX_USER_ITEMS={MAX_USER_ITEMS}
                        />
                        <div className="max-w-4xl mx-auto px-4 mt-8">
                            {/* Button removed as it is now inside CategorySelector */}
                        </div>
                            </div>
                        </>
                        ) : (
                        <div>
                            <button onClick={handleBackToCategories} className="flex items-center text-sm font-semibold text-accent hover:underline mb-4"><ArrowRight size={16} className="ml-1" />חזור לקטגוריות</button>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-neutral-800">
                                        {searchTerm ? 'תוצאות חיפוש' : selectedCategory === 'my-assignments' ? 'השיבוצים שלי' : categoryNames[selectedCategory!]}
                                    </h2>

                                </div>
                                {selectedCategory && selectedCategory !== 'my-assignments' && currentEvent?.details.allowUserItems && (
                                    <button
                                        onClick={() => {
                                            if (canAddMoreItems) {
                                                setModalState({ type: 'add-user-item', item: undefined, assignment: undefined, category: selectedCategory as any });
                                            } else {
                                                toast.error(`הגעת למכסת ${MAX_USER_ITEMS} הפריטים שניתן להוסיף.`);
                                            }
                                        }}
                                        title={canAddMoreItems ? "הוסף פריט חדש לקטגוריה זו" : `הגעת למכסת ${MAX_USER_ITEMS} הפריטים`}
                                        className="bg-success text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-success/90 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm flex items-center"
                                        disabled={!canAddMoreItems}
                                    >
                                        <Plus size={16} className="inline-block ml-1" />
                                        הוסף פריט ({userCreatedItemsCount}/{MAX_USER_ITEMS})
                                    </button>
                                )}
                            </div>
                            {itemsToDisplay.length > 0 ? (
                                <div className="space-y-6">
                                    {(() => {
                                        const isItemCompleted = (item: MenuItemType) => {
                                            const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
                                            if (itemAssignments.length === 0) return false;

                                            if (item.isSplittable) {
                                                const totalAssigned = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
                                                return totalAssigned >= item.quantity;
                                            }

                                            return true;
                                        };

                                        const availableItems = itemsToDisplay.filter(item => !isItemCompleted(item));
                                        const assignedItems = itemsToDisplay.filter(item => isItemCompleted(item));

                                        return (
                                            <>
                                                {availableItems.length > 0 && (
                                                    <div>
                                                        <h3 className="text-md font-semibold text-neutral-700 mb-3">פריטים פנויים</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {availableItems.map(item => {
                                                                const assignment = assignments.find(a => a.menuItemId === item.id);
                                                                return <MenuItemCard
                                                                    key={item.id}
                                                                    item={item}
                                                                    assignment={assignment}
                                                                    assignments={assignments.filter(a => a.menuItemId === item.id)}
                                                                    onAssign={() => handleAssignClick(item)}
                                                                    onEdit={() => handleEditClick(item, assignment!)}
                                                                    onCancel={(a) => handleCancelClick(a || assignment!)}
                                                                    isMyAssignment={localUser?.uid === assignment?.userId}
                                                                    isEventActive={isEventActive}
                                                                    currentUserId={localUser?.uid}
                                                                />
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {assignedItems.length > 0 && (
                                                    <div className={availableItems.length > 0 ? 'pt-6 border-t' : ''}>
                                                        <h3 className="text-md font-semibold text-neutral-700 mb-3">פריטים שהושלמו</h3>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {assignedItems.map(item => {
                                                                const assignment = assignments.find(a => a.menuItemId === item.id);
                                                                return <MenuItemCard
                                                                    key={item.id}
                                                                    item={item}
                                                                    assignment={assignment}
                                                                    assignments={assignments.filter(a => a.menuItemId === item.id)}
                                                                    onAssign={() => handleAssignClick(item)}
                                                                    onEdit={() => handleEditClick(item, assignment!)}
                                                                    onCancel={(a) => handleCancelClick(a || assignment!)}
                                                                    isMyAssignment={localUser?.uid === assignment?.userId}
                                                                    isEventActive={isEventActive}
                                                                    currentUserId={localUser?.uid}
                                                                />
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : <p className="text-center text-neutral-500 py-8">לא נמצאו פריטים.</p>}
                        </div>
                )}
                    </main>

                <div className="max-w-4xl mx-auto px-4 mt-8 mb-8">
                    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 text-center">
                        <div className="flex justify-center mb-3">
                            <div className="bg-orange-100 rounded-full p-3">
                                <ChefHat className="h-6 w-6 text-orange-500" />
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 mb-1">רוצה ליצור אירוע משלך?</h2>
                        <p className="text-gray-600 text-sm mb-4">זה לוקח דקה להירשם, וזה לגמרי בחינם.</p>
                        <Link
                            to="/"
                            className="inline-block bg-orange-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-orange-600 transition-colors shadow hover:shadow-md text-sm"
                        >
                            הירשם עכשיו
                        </Link>
                    </div>
                </div>

                { showNameModal && (<NameModal isLoading={isJoining} onSave={handleJoinEvent} onClose={() => setShowNameModal(false)} />) }

    { localUser && modalState?.type === 'assign' && modalState.item && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} />) }
    { localUser && modalState?.type === 'edit' && modalState.item && modalState.assignment && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} isEdit={true} existingAssignment={modalState.assignment} />) }
    {
        modalState?.type === 'add-user-item' && currentEvent && (
            <UserMenuItemForm
                event={currentEvent}
                onClose={() => setModalState(null)}
                category={modalState.category}
            />
        )
    }
        </div >
    );
};

export default EventPage;