// src/pages/EventPage.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import { useStore, selectMenuItems, selectAssignments, selectParticipants } from '../store/useStore';
import { FirebaseService } from '../services/firebaseService';
import { auth } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { MenuItem as MenuItemType, Assignment as AssignmentType } from '../types';
import { CalendarPlus, Clock, ChefHat, User as UserIcon, AlertCircle, Edit, X, Search, ArrowRight, Trash2, MessageSquare, Plus, Shield, Minus, Settings } from 'lucide-react';
import { isEventFinished } from '../utils/dateUtils';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import NavigationMenu from '../components/Common/NavigationMenu';
import { UserMenuItemForm } from '../components/Events/UserMenuItemForm';
import { EditItemModal } from '../components/Events/EditItemModal';
import { CategorySelector } from '../components/Events/CategorySelector';
import LanguageSwitcher from '../components/Common/LanguageSwitcher';
import { ParticipantsListModal } from '../components/Events/ParticipantsListModal';

/* const categoryNames: { [key: string]: string } = {
    starter: 'מנה ראשונה',
    main: 'מנה עיקרית',
    dessert: 'קינוחים',
    drink: 'משקאות',
    other: 'אחר'
}; */


// --- Component: CategorySelector removed, using imported component ---


// --- Component: MenuItemCard ---
const MenuItemCard: React.FC<{
    item: MenuItemType;
    assignment: AssignmentType | undefined;
    assignments?: AssignmentType[]; // Restored optional assignments array
    onAssign: () => void;
    onEdit: () => void;
    onCancel: (a?: AssignmentType) => void;
    onDeleteItem?: () => void; // New prop for deleting the entire item
    onEditAssignment?: (a: AssignmentType) => void; // New prop for editing specific assignment
    onEditItem?: () => void; // New prop for editing the item itself (for creators)
    isMyAssignment: boolean;
    isEventActive: boolean;
    currentUserId?: string;
    isOrganizer?: boolean; // New prop for organizer status
}> = ({ item, assignment, assignments = [], onAssign, onEdit, onEditAssignment, onCancel, onDeleteItem, onEditItem, isMyAssignment, isEventActive, currentUserId, isOrganizer }) => {
    const { t } = useTranslation();
    const assignedByOther = assignment && !isMyAssignment;
    const isSplittable = item.isSplittable || item.quantity > 1; // Enforce splittable if quantity > 1
    const totalQuantity = item.quantity;

    // Calculate filled quantity for splittable items
    const filledQuantity = isSplittable
        ? assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
        : (assignment ? item.quantity : 0);

    const isFull = filledQuantity >= totalQuantity;
    const progressPercent = Math.min(100, (filledQuantity / totalQuantity) * 100);

    // My assignments for this item (for splittable view)
    const myAssignments = currentUserId
        ? assignments.filter(a => a.userId === currentUserId)
        : (isMyAssignment && assignment ? [assignment] : []);

    const hasMyAssignment = myAssignments.length > 0;

    // Visual style based on status
    const cardStyles = isMyAssignment || hasMyAssignment
        ? 'bg-blue-50 border-blue-200 shadow-sm'
        : (assignedByOther || (isFull && !hasMyAssignment))
            ? 'bg-gray-50 border-gray-200 opacity-90'
            : 'bg-white border-gray-200 hover:border-orange-300 shadow-sm';

    return (
        <div className={`border-2 flex flex-col rounded-xl transition-all ${cardStyles}`}>
            {/* Upper Part: Item Details */}
            <div className="p-4 flex-grow">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-800 text-lg leading-tight">{item.name}</h4>
                            {/* Delete Item Button (Organizer Only) */}
                            {/* Logic: Show ONLY if I am the organizer (admin). Creators cannot force-delete via header. */}
                            {isOrganizer && isEventActive && onDeleteItem && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteItem();
                                    }}
                                    className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                                    title={t('common.delete')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        {/* Edit button for creators */}
                        {(isOrganizer || (currentUserId && item.creatorId === currentUserId)) && isEventActive && onEditItem && (
                            <button
                                onClick={onEditItem}
                                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mt-1"
                                title={t('eventPage.item.editItem')}
                            >
                                <Edit size={12} />
                                {t('eventPage.item.editItem')}
                            </button>
                        )}
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 whitespace-nowrap">
                        {t(`categories.${item.category}`)}
                    </span>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                    <p>{t('eventPage.item.quantityRequired')}: <span className="font-semibold">{item.quantity}</span></p>
                    {item.creatorName && (
                        <p className="text-xs text-gray-400">{t('eventPage.item.createdBy')}: {item.creatorName}</p>
                    )}
                    {item.notes && (
                        <p className="text-xs bg-yellow-50 text-yellow-800 p-2 rounded mt-2 border border-yellow-100">
                            📝 {item.notes}
                        </p>
                    )}
                </div>

                {/* Progress Bar for Splittable Items */}
                {isSplittable && (
                    <div className="mt-4">
                        <div className="flex justify-between text-xs mb-1 text-gray-700 font-medium">
                            <span>{t('eventPage.item.progress')}: {filledQuantity}/{totalQuantity}</span>
                            <span>{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className={`h-2 transition-all duration-300 ${isFull ? 'bg-green-500' : 'bg-blue-500'}`}
                                style={{ width: `${progressPercent}%` }}
                            ></div>
                        </div>
                        {/* List of OTHER contributors */}
                        {assignments.length > 0 && (
                            <div className="mt-3 text-xs text-gray-600">
                                <ul className="space-y-1">
                                    {assignments.map(a => (
                                        <li key={a.id} className="flex items-center justify-between gap-1 group/row">
                                            <div className="flex items-center gap-1">
                                                <UserIcon size={10} />
                                                <span className="font-medium">{a.userName}</span>: {a.quantity}
                                            </div>
                                            {/* Organizer can delete ANY assignment */}
                                            {isOrganizer && isEventActive && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCancel(a);
                                                    }}
                                                    className="text-red-400 hover:text-red-600 p-0.5 transition-opacity"
                                                    title={t('eventPage.item.cancel')}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Lower Part: Action / Status */}
            <div className="border-t border-gray-100 p-3 bg-white/50 rounded-b-xl">
                {isSplittable ? (
                    // --- SPLITTABLE LOGIC ---
                    <div className="space-y-3">
                        {hasMyAssignment && (
                            <div className="bg-white p-2 rounded-lg border border-blue-200 shadow-sm">
                                <p className="text-xs font-bold text-blue-800 mb-2">{t('eventPage.item.iBring')}</p>
                                <ul className="space-y-2">
                                    {myAssignments.map(myAss => (
                                        <li key={myAss.id} className="flex justify-between items-center text-sm group">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-blue-700">{myAss.quantity} יח'</span>
                                                {isEventActive && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onEditAssignment && onEditAssignment(myAss);
                                                        }}
                                                        className="text-gray-400 hover:text-blue-600 p-1 rounded-full hover:bg-blue-50 transition-colors"
                                                        title={t('eventPage.item.editQuantity')}
                                                    >
                                                        <Edit size={12} />
                                                    </button>
                                                )}
                                            </div>
                                            {isEventActive && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onCancel(myAss);
                                                    }}
                                                    className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                    title={t('eventPage.item.cancel')}
                                                >
                                                    <Trash2 size={14} />
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
                                className="w-full bg-orange-600 text-white py-2 text-sm rounded-lg hover:bg-orange-700 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                {hasMyAssignment ? t('eventPage.item.addMore') : t('eventPage.item.iWillParticipate')}
                            </button>
                        )}

                        {isFull && (
                            <p className="text-sm text-center text-green-700 font-medium">{t('eventPage.item.completed')} ✔️</p>
                        )}
                    </div>
                ) : (
                    // --- NON-SPLITTABLE LOGIC (Original Clean Logic) ---
                    assignment ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className={`font-semibold ${isMyAssignment ? 'text-blue-700' : 'text-green-700'}`}>
                                    {isMyAssignment ? t('eventPage.item.iBring') : `${t('eventPage.item.takenBy')} ${assignment.userName}:`}
                                </span>
                                <span className="font-bold text-lg">{assignment.quantity}</span>
                            </div>

                            {assignment.notes && (
                                <p className="text-xs text-gray-500 italic">"{assignment.notes}"</p>
                            )}

                            {isEventActive && (
                                <div className="flex gap-2 pt-1">
                                    {isMyAssignment && (
                                        <button
                                            onClick={onEdit}
                                            className="flex-1 text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 rounded flex items-center justify-center transition-colors"
                                        >
                                            <Edit size={12} className="ml-1" /> {t('common.edit')}
                                        </button>
                                    )}
                                    {/* Show delete/cancel if it's my assignment OR if I am the organizer */}
                                    {(isMyAssignment || isOrganizer) && (
                                        <button
                                            onClick={() => onCancel(assignment)}
                                            className="flex-1 text-xs bg-white border border-red-200 text-red-600 hover:bg-red-50 py-1.5 rounded flex items-center justify-center transition-colors"
                                        >
                                            <Trash2 size={12} className="ml-1" /> {t('eventPage.item.cancelAssignment')}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        isEventActive ? (
                            <button
                                onClick={onAssign}
                                className="w-full bg-orange-600 text-white py-2 text-sm rounded-lg hover:bg-orange-700 font-semibold transition-colors shadow-sm flex items-center justify-center gap-2"
                            >
                                <Plus size={16} />
                                {t('eventPage.item.iWillBringIt')}
                            </button>
                        ) : (
                            <p className="text-sm text-center text-gray-400">{t('eventPage.status.ended')}</p>
                        )
                    )
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
    isAddMore?: boolean;
    existingAssignment?: AssignmentType;
}> = ({ item, eventId, user, onClose, isEdit = false, isAddMore = false, existingAssignment }) => {
    const { t } = useTranslation();
    const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
    const [notes, setNotes] = useState(existingAssignment?.notes || '');
    const [isLoading, setIsLoading] = useState(false);
    const [participantName, setParticipantName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);
    const [currentUserName, setCurrentUserName] = useState('');
    const [useNewName, setUseNewName] = useState(false);
    const [tempUserName, setTempUserName] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);

    const assignments = useStore(selectAssignments);
    const maxQuantity = useMemo(() => {
        const effectivelySplittable = item.isSplittable || item.quantity > 1;
        if (!effectivelySplittable) return 1;

        const itemAssignments = assignments.filter(a => a.menuItemId === item.id && a.eventId === eventId);
        const currentTotal = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);

        let available = item.quantity - currentTotal;

        if (isEdit && existingAssignment && !isAddMore) {
            available += existingAssignment.quantity;
        }

        return Math.max(0, available);
    }, [item, assignments, eventId, isEdit, existingAssignment, isAddMore]);

    useEffect(() => {
        // Fix: Treat as splittable if quantity > 1, even if isSplittable is undefined/false
        const effectivelySplittable = item.quantity > 1 || item.isSplittable;

        if (!effectivelySplittable) {
            setQuantity(1);
        } else if (isAddMore) {
            // For Add More, start at 1 (representing +1)
            setQuantity(Math.min(1, maxQuantity));
        } else if (!existingAssignment) {
            setQuantity(Math.min(1, maxQuantity));
        }
        // For Edit, we prefer existingAssignment.quantity (already set in useState initializer), 
        // but if maxQuantity dropped below it (race condition), we might need to clamp? 
        // For now, respect user's original input or current state.
    }, [item.isSplittable, item.quantity, maxQuantity, existingAssignment, isAddMore]);

    useEffect(() => {
        const currentEvent = useStore.getState().currentEvent;
        const existingParticipant = currentEvent?.participants?.[user.uid];

        if (existingParticipant) {
            setCurrentUserName(existingParticipant.name);
            setTempUserName(existingParticipant.name);
            setShowNameInput(false);
        } else if (user.isAnonymous) {
            setShowNameInput(true);
            setIsEditingName(true); // Force name input for anonymous users
        } else {
            setCurrentUserName(user.displayName || t('common.user'));
            setTempUserName(user.displayName || t('common.user'));
            setShowNameInput(false);
        }
    }, [user.uid, user.isAnonymous, t]);

    const handleSubmit = async () => {
        let finalUserName = tempUserName.trim();

        if (isEditingName && !finalUserName) {
            toast.error(t('eventPage.assignment.nameRequired'));
            return;
        }
        if (quantity <= 0) { toast.error(t('eventPage.assignment.quantityPositive')); return; }
        if ((item.isSplittable || item.quantity > 1) && quantity > maxQuantity) {
            toast.error(t('eventPage.assignment.quantityExceedsAvailable', { maxQuantity }));
            return;
        }

        setIsLoading(true);
        try {
            if (isEditingName || showNameInput) {
                await FirebaseService.joinEvent(eventId, user.uid, finalUserName);
            }

            if (isEdit && existingAssignment) {
                let finalQuantity = quantity;
                let finalNotes = notes.trim();

                if (isAddMore) {
                    finalQuantity = existingAssignment.quantity + quantity;
                    // Optional: concatenate notes? For now keep existing or replace if edited.
                    // Logic: If user typed new notes, maybe append or replace?
                    // Let's assume user sees "Notes" field and edits it for the *merge*.
                }

                await FirebaseService.updateAssignment(eventId, existingAssignment.id, { quantity: finalQuantity, notes: finalNotes, userName: finalUserName });
                toast.success(isAddMore ? t('eventPage.assignment.addMoreSuccess') : t('eventPage.assignment.updateSuccess'));
            } else {
                await FirebaseService.createAssignment(eventId, {
                    menuItemId: item.id, userId: user.uid, userName: finalUserName,
                    quantity, notes: notes.trim(), status: 'confirmed', assignedAt: Date.now(), eventId
                });
                toast.success(t('eventPage.assignment.assignSuccess', { itemName: item.name }));
            }
            onClose();
        } catch (error: any) { toast.error(error.message || t('common.errorOccurred')); }
        finally { setIsLoading(false); }
    };

    const handleIncrement = () => setQuantity(q => {
        const max = (item.isSplittable || item.quantity > 1) ? maxQuantity : item.quantity;
        return Math.min(q + 1, max);
    });
    const handleDecrement = () => setQuantity(q => Math.max(1, q - 1));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b"><h2 className="text-lg font-semibold text-neutral-900">{isAddMore ? t('eventPage.assignment.addMoreTitle') : isEdit ? t('eventPage.assignment.editTitle') : t('eventPage.assignment.addTitle')}</h2><button onClick={onClose} className="text-neutral-500 hover:text-neutral-700"><X size={24} /></button></div>
                <div className="p-6">
                    <div className="bg-accent/10 p-4 rounded-lg mb-6 text-center"><p className="font-bold text-accent">{item.name}</p><p className="text-sm text-accent/80">{t('eventPage.assignment.suggestedQuantity')}: {item.quantity}</p></div>
                    <div className="space-y-4">
                        {currentUserName && !showNameInput && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        {t('eventPage.assignment.registerAs')} <span className="text-blue-600 font-bold">{tempUserName}</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setIsEditingName(!isEditingName)}
                                        className="text-xs text-orange-600 hover:text-orange-700 underline flex items-center"
                                    >
                                        <Edit size={12} className="ml-1" />
                                        {t('eventPage.assignment.changeName')}
                                    </button>
                                </div>

                                {isEditingName && (
                                    <div className="mb-3 animate-fadeIn">
                                        <label className="block text-xs font-medium text-gray-600 mb-1">{user.uid.startsWith('guest_') ? t('eventPage.assignment.fullName') : t('eventPage.assignment.newName')}</label>
                                        <input
                                            type="text"
                                            value={tempUserName}
                                            onChange={(e) => setTempUserName(e.target.value)}
                                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                            placeholder={t('eventPage.assignment.namePlaceholder')}
                                            autoFocus
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {(showNameInput || useNewName) && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    {useNewName ? t('eventPage.assignment.newName') : t('eventPage.assignment.fullName')}
                                </label>
                                <div className="relative">
                                    <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                                    <input
                                        type="text"
                                        value={participantName}
                                        onChange={e => setParticipantName(e.target.value)}
                                        placeholder={useNewName ? t('eventPage.assignment.newNamePlaceholder') : t('eventPage.assignment.namePlaceholder')}
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
                                            {t('common.cancel')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stepper UI for Quantity */}
                        <div>
                            <div className="flex justify-between mb-2 items-center">
                                <label className="block text-sm font-medium text-neutral-700">
                                    {isAddMore ? t('eventPage.assignment.quantityToAdd') : t('eventPage.assignment.quantityToBring')}
                                </label>
                                <div className="flex gap-2 items-center">
                                    {(item.isSplittable || item.quantity > 1) && quantity < maxQuantity && (
                                        <button
                                            type="button"
                                            onClick={() => setQuantity(maxQuantity)}
                                            className="text-xs text-orange-600 hover:text-orange-700 font-medium underline"
                                        >
                                            {t('eventPage.assignment.bringAll')}
                                        </button>
                                    )}
                                    {(item.isSplittable || item.quantity > 1) && (
                                        <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                                            {t('eventPage.assignment.remaining')}: {maxQuantity}
                                        </span>
                                    )}
                                </div>
                            </div>
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
                                    disabled={quantity >= ((item.isSplittable || item.quantity > 1) ? maxQuantity : item.quantity)}
                                    className="w-16 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-accent transition-colors border-r border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus size={20} />
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">{t('eventPage.assignment.notesOptional')}</label>
                            <div className="relative">
                                <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-neutral-400" />
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500"
                                    rows={3}
                                    placeholder={t('eventPage.assignment.notesPlaceholder')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-50 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 font-medium">{t('common.cancel')}</button>
                    <button onClick={handleSubmit} disabled={isLoading} className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:bg-neutral-300">{isLoading ? t('common.saving') : isAddMore ? t('eventPage.assignment.add') : isEdit ? t('common.saveChanges') : t('eventPage.assignment.confirmAssignment')}</button>
                </div>
            </div >
        </div >
    );
};

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

    const { currentEvent, setCurrentEvent, clearCurrentEvent, isLoading, user: storeUser } = useStore();

    const menuItems = useStore(selectMenuItems);
    const assignments = useStore(selectAssignments);
    const participants = useStore(selectParticipants);
    const userCreatedItemsCount = useMemo(() => {
        if (!localUser || !currentEvent?.userItemCounts) return 0;
        return currentEvent.userItemCounts[localUser.uid] || 0;
    }, [currentEvent, localUser]);

    const MAX_USER_ITEMS = currentEvent?.details.userItemLimit ?? 3;
    const showAdminButton = storeUser?.isAdmin || (localUser && currentEvent?.organizerId === localUser.uid);

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

    const [modalState, setModalState] = useState<{ type: 'assign' | 'edit' | 'add-user-item' | 'add-more' | 'edit-item'; item?: MenuItemType; assignment?: AssignmentType; category?: string } | null>(null);
    const [itemToAssignAfterJoin, setItemToAssignAfterJoin] = useState<MenuItemType | null>(null);
    const [showNameModal, setShowNameModal] = useState(false);
    const [showParticipantsList, setShowParticipantsList] = useState(false);

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
            // Regular user unassigning -> Standard confirm
            if (window.confirm(t('eventPage.messages.cancelAssignmentConfirm'))) {
                try {
                    await FirebaseService.cancelAssignment(eventId, assignment.id, assignment.menuItemId);
                    toast.success(t('eventPage.messages.assignmentCancelled'));
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

    const participantName = participants.find(p => p.id === localUser?.uid)?.name || 'אורח';
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
            <header className="bg-white shadow-sm p-3 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto flex justify-between items-center">

                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div>
                            <h1 className="font-bold text-lg text-accent">{t('header.title')}</h1>
                            <p className="text-xs text-neutral-500">{t('header.subtitle')}</p>
                        </div>
                    </Link>

                    <div className="text-left flex items-center gap-3">
                        <LanguageSwitcher />
                        {showAdminButton && (
                            <Link
                                to="/"
                                className="flex items-center justify-center p-2 sm:px-3 sm:py-1.5 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 transition-colors text-sm font-medium"
                                title={t('eventPage.adminPanelTooltip')}
                            >
                                <Settings size={20} className="block sm:hidden" />
                                <span className="hidden sm:block">{t('eventPage.adminPanel')}</span>
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
                            className="flex items-center hover:text-accent hover:font-medium transition-colors group"
                            title={t('eventPage.details.addToCalendar')}
                        >
                            <CalendarPlus size={14} className="ml-1.5 flex-shrink-0 group-hover:text-accent" />
                            {new Date(currentEvent.details.date).toLocaleDateString(i18n.language === 'he' ? 'he-IL' : 'en-US')}
                        </button>

                        {/* Time (Static) */}
                        <p className="flex items-center"><Clock size={14} className="ml-1.5 flex-shrink-0" /> {currentEvent.details.time}</p>

                        {/* Interactive Location -> Navigation Menu */}
                        <NavigationMenu location={currentEvent.details.location} />


                        {/* Organizer (Static) */}
                        <p className="flex items-center"><UserIcon size={14} className="ml-1.5 flex-shrink-0" /> {t('eventPage.details.organizer')}: {currentEvent.organizerName}</p>

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
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
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
                                className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-500 shadow-sm"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setView('categories');
                                        setSelectedCategory(null);
                                    }}
                                    className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 ${i18n.language === 'he' ? 'left-2' : 'right-10'}`}
                                    aria-label={t('common.clearSearch')}
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <button onClick={handleMyAssignmentsClick} className={`px-3 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors whitespace-nowrap ${selectedCategory === 'my-assignments' ? 'bg-accent text-white' : 'bg-primary text-white hover:bg-primary/90'}`}>
                            {t('eventPage.filter.myAssignments')}
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
                                    toast.error(t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS }));
                                }
                            }}
                            canAddMoreItems={canAddMoreItems}
                            userCreatedItemsCount={userCreatedItemsCount}
                            MAX_USER_ITEMS={MAX_USER_ITEMS}
                            showLimit={!showAdminButton}
                        />
                        <div className="max-w-4xl mx-auto px-4 mt-8">
                            {/* Button removed as it is now inside CategorySelector */}
                        </div>
                    </>
                ) : (
                    <div>
                        <button onClick={handleBackToCategories} className="flex items-center text-sm font-semibold text-accent hover:underline mb-4"><ArrowRight size={16} className="ml-1" />{t('eventPage.backToCategories')}</button>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-neutral-800">
                                    {searchTerm ? t('eventPage.list.searchResults') : selectedCategory === 'my-assignments' ? t('eventPage.filter.myAssignments') : t(`categories.${selectedCategory!}`)}
                                </h2>

                            </div>
                            {selectedCategory && selectedCategory !== 'my-assignments' && currentEvent?.details.allowUserItems && (
                                <button
                                    onClick={() => {
                                        if (canAddMoreItems) {
                                            setModalState({ type: 'add-user-item', item: undefined, assignment: undefined, category: selectedCategory as any });
                                        } else {
                                            toast.error(t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS }));
                                        }
                                    }}
                                    title={canAddMoreItems ? t('eventPage.category.addItemTooltip') : t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS })}
                                    className="bg-success text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-success/90 disabled:bg-neutral-400 disabled:cursor-not-allowed transition-colors font-semibold text-sm flex items-center"
                                    disabled={!canAddMoreItems}
                                >
                                    <Plus size={16} className="inline-block ml-1" />
                                    {t('eventPage.category.addItem')} {!showAdminButton && `(${userCreatedItemsCount}/${MAX_USER_ITEMS})`}
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
                                                    <h3 className="text-md font-semibold text-neutral-700 mb-3">{t('eventPage.list.available')}</h3>
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
                                                                onEditItem={() => handleEditItemClick(item)}
                                                                onCancel={(a) => handleCancelClick(a || assignment!)}
                                                                onDeleteItem={() => handleDeleteItem(item)}
                                                                isMyAssignment={localUser?.uid === assignment?.userId}
                                                                isEventActive={isEventActive}
                                                                isOrganizer={!!showAdminButton}
                                                                currentUserId={localUser?.uid}
                                                            />
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {assignedItems.length > 0 && (
                                                <div className={availableItems.length > 0 ? 'pt-6 border-t' : ''}>
                                                    <h3 className="text-md font-semibold text-neutral-700 mb-3">{t('eventPage.list.completed')}</h3>
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
                                                                onEditItem={() => handleEditItemClick(item)}
                                                                onEditAssignment={(a) => handleEditClick(item, a)} // Fix: Pass this prop here too
                                                                onCancel={(a) => handleCancelClick(a || assignment!)}
                                                                onDeleteItem={() => handleDeleteItem(item)}
                                                                isMyAssignment={localUser?.uid === assignment?.userId}
                                                                isEventActive={isEventActive}
                                                                isOrganizer={!!showAdminButton}
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
                        ) : <p className="text-center text-neutral-500 py-8">{t('eventPage.list.noItems')}</p>}
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

            {localUser && modalState?.type === 'assign' && modalState.item && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} />)}
            {localUser && modalState?.type === 'edit' && modalState.item && modalState.assignment && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} isEdit={true} existingAssignment={modalState.assignment} />)}
            {localUser && modalState?.type === 'add-more' && modalState.item && modalState.assignment && (<AssignmentModal item={modalState.item} eventId={eventId!} user={localUser} onClose={() => setModalState(null)} isEdit={true} isAddMore={true} existingAssignment={modalState.assignment} />)}
            {
                modalState?.type === 'add-user-item' && currentEvent && (
                    <UserMenuItemForm
                        event={currentEvent}
                        onClose={() => setModalState(null)}
                        category={modalState.category}
                        isOrganizer={!!showAdminButton}
                    />
                )
            }
            {
                modalState?.type === 'edit-item' && modalState.item && (
                    <EditItemModal
                        item={modalState.item}
                        eventId={eventId!}
                        assignments={assignments}
                        onClose={() => setModalState(null)}
                    />
                )
            }

            {showParticipantsList && (
                <ParticipantsListModal
                    assignments={assignments}
                    menuItems={menuItems}
                    onClose={() => setShowParticipantsList(false)}
                    onDeleteAssignment={async (assignmentId, menuItemId, userName, itemName) => {
                        if (!eventId) return;
                        await FirebaseService.cancelAssignment(eventId, assignmentId, menuItemId);
                    }}
                    isOrganizer={!!showAdminButton}
                />
            )}
        </div >
    );
};

export default EventPage;