// src/components/Events/EditItemModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, ChevronDown, ChevronUp, AlertCircle, Plus, Minus, Phone } from 'lucide-react';
import { FirebaseService } from '../../services/firebaseService';
import { useStore, selectMenuItems, selectAssignments } from '../../store/useStore';
import { MenuItem, Assignment } from '../../types';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface EditItemModalProps {
    item: MenuItem;
    eventId: string;
    assignments: Assignment[];
    onClose: () => void;
}

interface FormErrors {
    name?: string;
    quantity?: string;
    phoneNumber?: string;
}

// ============================================================================
// HELPER COMPONENTS - Card View Style (Copied from UserMenuItemForm for consistency)
// ============================================================================

// TimeSelect: Dropdown with 15-minute intervals
interface TimeSelectProps {
    label: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    disabled?: boolean;
    required?: boolean;
    referenceTime?: string;
    type?: 'to' | 'from';
}

const TimeSelect: React.FC<TimeSelectProps> = ({
    label, value, onChange, disabled = false, required = false,
    referenceTime, type = 'to'
}) => {
    const times: string[] = [];
    let startHour = 0;
    if (referenceTime) {
        const [h] = referenceTime.split(':').map(Number);
        if (!isNaN(h)) {
            startHour = type === 'to' ? (h - 5 + 24) % 24 : h;
        }
    }

    for (let i = 0; i < 24; i++) {
        const h = (startHour + i) % 24;
        for (let m = 0; m < 60; m += 15) {
            times.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
    }

    return (
        <div className="mb-4">
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    required={required}
                    className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rides focus:border-rides outline-none transition-all bg-white appearance-none text-gray-700"
                >
                    <option value="" disabled>בחר שעה...</option>
                    {times.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>
        </div>
    );
};

// FlexibilitySelector
interface FlexibilitySelectorProps {
    label?: string;
    selected: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const FlexibilitySelector: React.FC<FlexibilitySelectorProps> = ({ label, selected, onChange, disabled = false }) => {
    const options = [
        { id: 'exact', label: 'בדיוק' },
        { id: '15min', label: '±15 דקות' },
        { id: '30min', label: '±30 דקות' },
        { id: '1hour', label: '±שעה' },
        { id: 'flexible', label: 'גמיש' },
    ];

    return (
        <div>
            {label && <span className="text-xs text-gray-500 mb-1 block">{label}</span>}
            <select
                value={selected}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rides focus:border-rides outline-none transition-all bg-white text-gray-700"
            >
                {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
};

// CollapsibleNotes
interface CollapsibleNotesProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    disabled?: boolean;
    placeholder?: string;
}

const CollapsibleNotes: React.FC<CollapsibleNotesProps> = ({ value, onChange, disabled = false, placeholder = 'פרטים נוספים...' }) => {
    const [isOpen, setIsOpen] = useState(!!value);
    return (
        <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 transition-all">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
                <div className="flex items-center gap-2">
                    <span>הערות (אופציונלי)</span>
                    {value && !isOpen && <span className="text-xs text-teal-600">נוספו הערות</span>}
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {isOpen && (
                <div className="p-3 bg-white border-t border-gray-100">
                    <textarea
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-rides outline-none resize-none"
                        rows={3}
                        placeholder={placeholder}
                    />
                </div>
            )}
        </div>
    );
};

export function EditItemModal({ item, eventId, assignments, onClose }: EditItemModalProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const isOffer = item.category === 'ride_offers';
    const isRequest = item.category === 'ride_requests';
    const isRide = isOffer || isRequest || item.category === 'trempim' || item.category === 'rides';

    // Access Global State for Helper Logic
    const allMenuItems = useStore((state) => selectMenuItems(state));
    const allAssignments = useStore((state) => selectAssignments(state));

    // 1. Detect Twin Item (Round Trip Part)
    // Same creator, same event, opposite direction, same core category type
    const twinItem = React.useMemo(() => {
        if (!isRide || !item.direction || (item.direction as string) === 'both') return null;

        const oppositeDir = item.direction === 'to_event' ? 'from_event' : 'to_event';
        return allMenuItems.find(i =>
            i.id !== item.id &&
            i.creatorId === item.creatorId &&
            i.eventId === eventId &&
            i.direction === oppositeDir &&
            (i.category === 'ride_offers' || i.category === 'ride_requests' || i.category === 'trempim')
        );
    }, [item, allMenuItems, isRide, eventId]);

    // Calculate total assigned for Primary Item
    const totalAssignedPrimary = assignments
        .filter(a => a.menuItemId === item.id)
        .reduce((sum, a) => sum + (a.quantity || 0), 0);

    // Calculate total assigned for Twin Item (if exists)
    const totalAssignedTwin = twinItem ? allAssignments
        .filter(a => a.menuItemId === twinItem.id)
        .reduce((sum, a) => sum + (a.quantity || 0), 0) : 0;

    // Use the maximum of both for validation if managing a unified "Round Trip" entity
    const totalAssigned = Math.max(totalAssignedPrimary, totalAssignedTwin);


    // 2. Initialize State with NORMALIZED Logic
    // formData.departureTime -> ALWAYS Outbound
    // formData.departureTimeFrom -> ALWAYS Return
    const [formData, setFormData] = useState(() => {
        let timeTo = '';
        let timeFrom = '';
        let flexTo = '30min';
        let flexFrom = '30min';

        if (item.direction === 'to_event') {
            timeTo = item.departureTime || '';
            flexTo = (item.timeFlexibility as string) || '30min';
            if (twinItem) {
                timeFrom = twinItem.departureTime || '';
                flexFrom = (twinItem.timeFlexibility as string) || '30min';
            }
        } else if (item.direction === 'from_event') {
            timeFrom = item.departureTime || '';
            flexFrom = (item.timeFlexibility as string) || '30min';
            if (twinItem) {
                timeTo = twinItem.departureTime || '';
                flexTo = (twinItem.timeFlexibility as string) || '30min';
            }
        } else {
            // Fallback for 'both' legacy or generic
            timeTo = item.departureTime || '';
            flexTo = (item.timeFlexibility as string) || '30min';
            timeFrom = (item as any).departureTimeFrom || '';
            flexFrom = (item as any).timeFlexibilityFrom || '30min';
        }

        return {
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            notes: item.notes || '',
            phoneNumber: item.phoneNumber || '',
            direction: item.direction || 'to_event', // Keeping this but we use rideDirection state mainly
            departureTime: timeTo,         // NORMALIZED: Outbound
            timeFlexibility: flexTo,
            departureTimeFrom: timeFrom,   // NORMALIZED: Return
            timeFlexibilityFrom: flexFrom,
            pickupLocation: item.pickupLocation || '',
        };
    });

    const [rideDirection, setRideDirection] = useState<'to_event' | 'from_event' | 'both'>(() => {
        if (twinItem) return 'both'; // If twin exists, we represent this as Round Trip
        if ((item.direction as string) === 'both') return 'both';
        return (item.direction as any) || 'to_event';
    });

    // Sync local rideDirection with formData and auto-update name if it follows the pattern
    useEffect(() => {
        handleInputChange('direction', rideDirection);

        // Auto-update name suffix if it matches standard pattern
        setFormData(prev => {
            let newName = prev.name;
            const suffixRegex = /\s\((הלוך|חזור|הלוך וחזור)\)$/;

            if (suffixRegex.test(newName)) {
                const baseName = newName.replace(suffixRegex, '');
                let newSuffix = '';
                if (rideDirection === 'to_event') newSuffix = ' (הלוך)';
                else if (rideDirection === 'from_event') newSuffix = ' (חזור)';
                else if (rideDirection === 'both') newSuffix = ' (הלוך וחזור)';

                newName = baseName + newSuffix;
            } else {
                // If no suffix exists, maybe add one? 
                // Better to only modify if it already had one to avoid messing with custom names too much.
                // But for "Example (Outbound)" case, it matches.
            }

            if (newName !== prev.name) {
                return { ...prev, name: newName };
            }
            return prev;
        });
    }, [rideDirection]);

    // Accessibility: Unique IDs for ARIA labeling
    const titleId = useId();

    // Accessibility: Store reference to the element that opened the modal
    const returnFocusRef = useRef<HTMLElement | null>(null);

    // Helper Stepper Component
    const Stepper = ({ value, onChange, min, label }: { value: number, onChange: (val: number) => void, min: number, label?: string }) => (
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-10 w-full dir-ltr">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
                aria-label={t('editItemModal.fields.decrease') + (label ? ` ${label}` : '')}
                className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-r border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Minus size={16} aria-hidden="true" />
            </button>
            <div className="flex-1 flex items-center justify-center bg-white font-semibold text-gray-800" aria-live="polite">{value}</div>
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                aria-label={t('editItemModal.fields.increase') + (label ? ` ${label}` : '')}
                className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-l border-gray-200"
            >
                <Plus size={16} aria-hidden="true" />
            </button>
        </div>
    );



    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = t('editItemModal.errors.nameRequired');
        } else if (formData.name.trim().length < 2) {
            newErrors.name = t('editItemModal.errors.nameLength');
        }

        if (formData.quantity < 1) {
            newErrors.quantity = t('editItemModal.errors.quantityMin');
        } else if (formData.quantity < totalAssigned) {
            newErrors.quantity = t('editItemModal.errors.quantityBelowAssigned', { assigned: totalAssigned });
        } else if (formData.quantity > 100) {
            newErrors.quantity = t('editItemModal.errors.quantityMax');
        }

        if (isRide) {
            const raw = formData.phoneNumber?.toString().trim() || '';
            const clean = raw.replace(/\D/g, '').replace(/^972/, '0');
            if (!raw) {
                newErrors.phoneNumber = 'חובה להזין מספר טלפון';
            } else if (!/^05\d{8}$/.test(clean)) {
                newErrors.phoneNumber = 'מספר טלפון לא תקין (10 ספרות, קידומת 05)';
            }
        } else if (isRide && !formData.phoneNumber?.trim()) {
            newErrors.phoneNumber = 'חובה להזין מספר טלפון ליצירת קשר';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            if (errors.phoneNumber) {
                toast.error(errors.phoneNumber);
            } else {
                toast.error(t('editItemModal.errors.fixErrors'));
            }
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Prepare Base Updates (Shared fields)
            const baseUpdates: Partial<MenuItem> = {
                category: formData.category,
                quantity: formData.quantity,
                notes: formData.notes.trim() || undefined,
                isSplittable: formData.quantity > 1,
            };

            if (formData.phoneNumber?.trim()) {
                baseUpdates.phoneNumber = formData.phoneNumber.trim();
            } else if (item.phoneNumber) {
                baseUpdates.phoneNumber = null as any;
            }

            // Name handling: 
            // If the name has the specific direction suffix, we might want to strip it for the storage/twin?
            // Actually, we construct names dynamically on Create. On Update we should probably keep consistency.
            // Our auto-rename effect ensures 'formData.name' has the correct suffix for the CURRENTLY selected direction key.
            // But if we have TWO items, they need different names.
            const suffixRegex = /\s\((הלוך|חזור|הלוך וחזור)\)$/;
            const baseName = formData.name.replace(suffixRegex, '').trim();

            // 2. Logic Execution based on rideDirection

            // === CASE A: BOTH (Round Trip) ===
            if (rideDirection === 'both') {
                // Update/Ensure Primary Item
                const primaryDirection = item.direction === 'from_event' ? 'from_event' : 'to_event';
                // If Item is TO, we update it with TO data.
                // If Item is FROM, we update it with FROM data.

                const updatesPrimary = { ...baseUpdates, direction: primaryDirection as any };
                if (primaryDirection === 'to_event') {
                    updatesPrimary.departureTime = formData.departureTime; // Normalized Outbound
                    updatesPrimary.timeFlexibility = formData.timeFlexibility as any;
                    updatesPrimary.name = `${baseName} (הלוך)`;
                } else {
                    updatesPrimary.departureTime = formData.departureTimeFrom; // Normalized Return
                    updatesPrimary.timeFlexibility = formData.timeFlexibilityFrom as any;
                    updatesPrimary.name = `${baseName} (חזור)`;
                }

                await FirebaseService.updateMenuItem(eventId, item.id, updatesPrimary);

                // Update/Create Twin Item
                const twinDirection = primaryDirection === 'to_event' ? 'from_event' : 'to_event';
                const updatesTwin: any = {
                    ...baseUpdates,
                    direction: twinDirection,
                    // If Twin is FROM (because primary was TO), use Return data
                    departureTime: twinDirection === 'from_event' ? formData.departureTimeFrom : formData.departureTime,
                    timeFlexibility: twinDirection === 'from_event' ? formData.timeFlexibilityFrom : formData.timeFlexibility,
                    name: `${baseName} (${twinDirection === 'to_event' ? 'הלוך' : 'חזור'})`
                };

                if (twinItem) {
                    await FirebaseService.updateMenuItem(eventId, twinItem.id, updatesTwin);
                } else {
                    // Create Twin
                    const newItem = {
                        ...updatesTwin,
                        creatorId: item.creatorId,
                        creatorName: item.creatorName || '', // Should ideally fetch from item
                        createdAt: Date.now(),
                        eventId: eventId,
                        isRequired: false, // Default
                        rowType: (item as any).rowType || 'offers'
                    };
                    await FirebaseService.addMenuItem(eventId, newItem, { bypassLimit: true });
                }

                toast.success('עודכן בהצלחה (הלוך וחזור)');
            }

            // === CASE B: SINGLE DIRECTION (To OR From) ===
            else {
                // 1. Update Primary Item
                const targetDirection = rideDirection;
                const updatesPrimary = { ...baseUpdates, direction: targetDirection as any };

                if (targetDirection === 'to_event') {
                    updatesPrimary.departureTime = formData.departureTime;
                    updatesPrimary.timeFlexibility = formData.timeFlexibility as any;
                    updatesPrimary.name = `${baseName} (הלוך)`;
                } else {
                    updatesPrimary.departureTime = formData.departureTimeFrom;
                    updatesPrimary.timeFlexibility = formData.timeFlexibilityFrom as any;
                    updatesPrimary.name = `${baseName} (חזור)`;
                }

                await FirebaseService.updateMenuItem(eventId, item.id, updatesPrimary);

                // 2. Handle Twin Deletion (if exists and incompatible)
                // If I am now 'to_event', and I have a twin that is 'from_event', I must delete it (because user didn't select 'both').
                // If I was 'to' and twin was 'from', and I stay 'to', wait... 
                // If I started as 'Both' (UI state) -> Twin exists. now I select 'To'. Twin (From) should be deleted.

                if (twinItem) {
                    // Check assignments on Twin before deleting!
                    if (totalAssignedTwin > 0) {
                        // We CANNOT delete it.
                        // We updated the Primary, but we can't delete the Twin. 
                        // Should we revert Primary update? Or just warn?
                        // Ideally we should have validated before. 
                        // But we can just NOT delete it and warn the user.
                        toast.error('לא ניתן לבטל את הנסיעה השנייה כי רשומים אליה נוסעים.', { duration: 5000 });
                        // We essentially leave it as 'both' in the backend (two items exist), 
                        // even though user wanted one. 
                        // This is better than deleting data.
                    } else {
                        // Safe to delete
                        await FirebaseService.deleteMenuItem(eventId, twinItem.id);
                        toast.success(t('editItemModal.success'));
                    }
                } else {
                    toast.success(t('editItemModal.success'));
                }
            }

            onClose();
        } catch (error: any) {
            console.error('❌ Error updating item:', error);
            let errorMessage = t('editItemModal.errors.generalError');
            if (error.message) errorMessage = error.message;
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInputChange = (field: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        if (errors[field as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    // Accessibility: Handle ESC key to close modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, isSubmitting]);

    // Accessibility: Store active element on mount, restore on unmount
    useEffect(() => {
        returnFocusRef.current = document.activeElement as HTMLElement;

        return () => {
            // Return focus when modal closes
            if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
                returnFocusRef.current.focus();
            }
        };
    }, []);

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            role="presentation"
        >
            <FocusTrap>
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={titleId}
                    className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] flex flex-col"
                >
                    <div className={`flex items-center justify-between p-6 border-b rounded-t-xl text-white flex-none ${isRide ? 'bg-rides-dark' : 'bg-accent-dark'}`}>
                        <h2 id={titleId} className="text-lg font-bold">
                            {isOffer ? 'עריכת הצעת טרמפ' : isRequest ? 'עריכת בקשת טרמפ' : t('editItemModal.title')}
                        </h2>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            type="button"
                            aria-label={t('common.close')}
                            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors disabled:opacity-50"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* SECTION 1: Origin & Direction (Cards) */}
                            {isRide && (
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <div>
                                        <label htmlFor="item-name" className="block text-base font-bold text-gray-800 mb-3">
                                            מאיפה אתה יוצא?
                                        </label>
                                        <input
                                            id="item-name"
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => handleInputChange('name', e.target.value)}
                                            placeholder="לדוגמה: תל אביב - רכבת ארלוזורוב"
                                            className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-rides focus:border-rides transition-all ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                                            disabled={isSubmitting}
                                            required
                                        />
                                        {errors.name && (
                                            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="h-4 w-4" />
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Direction Buttons */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setRideDirection('to_event')}
                                            disabled={isSubmitting}
                                            className={`py-3 px-3 text-sm font-semibold rounded-xl border-2 transition-all ${rideDirection === 'to_event'
                                                ? 'bg-rides-dark text-white border-rides-primary shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            הלוך
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRideDirection('from_event')}
                                            disabled={isSubmitting}
                                            className={`py-3 px-3 text-sm font-semibold rounded-xl border-2 transition-all ${rideDirection === 'from_event'
                                                ? 'bg-rides-dark text-white border-rides-primary shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            חזור
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRideDirection('both')}
                                            disabled={isSubmitting}
                                            className={`py-3 px-3 text-sm font-semibold rounded-xl border-2 transition-all ${rideDirection === 'both'
                                                ? 'bg-rides-dark text-white border-rides-primary shadow-md'
                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                }`}
                                        >
                                            הלוך וחזור
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* SECTION 2: Times */}
                            {isRide && (
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                                    {(rideDirection === 'to_event' || rideDirection === 'both') && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <TimeSelect
                                                label="שעת יציאה (הלוך)"
                                                value={formData.departureTime || ''} // Normalized Outbound
                                                onChange={(e) => handleInputChange('departureTime', e.target.value)}
                                                disabled={isSubmitting}
                                                required={rideDirection === 'to_event' || rideDirection === 'both'}
                                                type="to"
                                            />
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">גמישות (הלוך)</label>
                                                <FlexibilitySelector
                                                    selected={formData.timeFlexibility as string}
                                                    onChange={(val) => handleInputChange('timeFlexibility', val)}
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(rideDirection === 'from_event' || rideDirection === 'both') && (
                                        <div className={`grid grid-cols-2 gap-3 ${(rideDirection === 'both') ? 'border-t pt-3' : ''}`}>
                                            <TimeSelect
                                                label={rideDirection === 'both' ? "שעת חזור" : "שעת יציאה (חזור)"}
                                                // Normalized: departureTimeFrom is ALWAYS Return time
                                                value={formData.departureTimeFrom || ''}
                                                onChange={(e) => handleInputChange('departureTimeFrom', e.target.value)}
                                                disabled={isSubmitting}
                                                required={rideDirection === 'from_event' || rideDirection === 'both'}
                                                type="from"
                                            />
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">גמישות {rideDirection === 'both' ? '(חזור)' : ''}</label>
                                                <FlexibilitySelector
                                                    selected={formData.timeFlexibilityFrom as string}
                                                    onChange={(val) => handleInputChange('timeFlexibilityFrom', val)}
                                                    disabled={isSubmitting}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SECTION 3: Contact & Details */}
                            {isRide && (
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">

                                    {/* Phone */}
                                    <div>
                                        <label htmlFor="phoneNumber" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                            <Phone className="h-4 w-4 text-teal-600" />
                                            מספר טלפון
                                            <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                id="phoneNumber"
                                                name="phoneNumber"
                                                type="tel"
                                                value={formData.phoneNumber || ''}
                                                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                                placeholder="050-0000000"
                                                className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-rides focus:border-rides transition-all ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                                                    } ltr text-right`}
                                                disabled={isSubmitting}
                                                required
                                            />
                                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        </div>
                                        {errors.phoneNumber && (
                                            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="h-4 w-4" />
                                                {errors.phoneNumber}
                                            </p>
                                        )}
                                    </div>

                                    {/* Seats */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            {isOffer ? 'מספר מקומות פנויים' : 'כמה מקומות צריכים?'}
                                        </label>
                                        <Stepper
                                            value={formData.quantity}
                                            onChange={(val) => handleInputChange('quantity', val)}
                                            min={Math.max(1, totalAssigned)}
                                            label=""
                                        />
                                        {totalAssigned > 0 && (
                                            <p className="mt-1 text-xs text-gray-500">
                                                {isOffer
                                                    ? `שוריינו ${totalAssigned} מקומות`
                                                    : `יש נהג`}
                                            </p>
                                        )}
                                    </div>

                                    {/* Notes */}
                                    <CollapsibleNotes
                                        value={formData.notes || ''}
                                        onChange={(e) => handleInputChange('notes', e.target.value)}
                                        disabled={isSubmitting}
                                        placeholder={isRequest ? 'לדוגמה: מחכה ליד...' : 'לדוגמה: אין מקום למזוודות...'}
                                    />
                                </div>
                            )}

                            {/* Non-Ride Items Logic (Generic) */}
                            {!isRide && (
                                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
                                    <label className="block text-sm font-semibold text-gray-800 mb-1">{t('editItemModal.fields.name')}</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleInputChange('name', e.target.value)}
                                        className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                                    />
                                    {errors.name && <p className="text-red-500 text-xs">{errors.name}</p>}

                                    <label className="block text-sm font-semibold text-gray-800 mb-1">{t('editItemModal.fields.quantity')}</label>
                                    <Stepper value={formData.quantity} onChange={(val) => handleInputChange('quantity', val)} min={1} />

                                    <CollapsibleNotes value={formData.notes || ''} onChange={(e) => handleInputChange('notes', e.target.value)} />
                                </div>
                            )}
                        </div>

                        {/* Buttons (Fixed Footer) */}
                        <div className="flex space-x-3 rtl:space-x-reverse p-6 border-t bg-gray-50 flex-none rounded-b-xl">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`flex-1 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${isRide
                                    ? 'bg-rides-primary hover:bg-rides-hover'
                                    : 'bg-accent-dark hover:bg-accent-dark/90'
                                    } disabled:bg-gray-300`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                                        {t('editItemModal.submitting')}
                                    </>
                                ) : (
                                    t('editItemModal.submit')
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {t('editItemModal.cancel')}
                            </button>
                        </div>
                    </form>
                </div>
            </FocusTrap>
        </div>
    );
}

