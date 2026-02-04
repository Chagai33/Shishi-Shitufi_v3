// src/components/Events/EditItemModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, ChefHat, MessageSquare, AlertCircle, Plus, Minus, Car } from 'lucide-react';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, MenuCategory, Assignment } from '../../types';
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

export function EditItemModal({ item, eventId, assignments, onClose }: EditItemModalProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    const isOffer = item.category === 'ride_offers';
    const isRequest = item.category === 'ride_requests';
    const isRide = isOffer || isRequest || item.category === 'trempim' || item.category === 'rides';

    // Calculate total assigned quantity for this item
    const totalAssigned = assignments
        .filter(a => a.menuItemId === item.id)
        .reduce((sum, a) => sum + (a.quantity || 0), 0);


    const [formData, setFormData] = useState({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes || '',
        phoneNumber: item.phoneNumber || '',
        direction: item.direction || 'to_event',
        departureTime: item.departureTime || '',
        timeFlexibility: item.timeFlexibility || '30min',
        pickupLocation: item.pickupLocation || '',
    });

    // Accessibility: Unique IDs for ARIA labeling
    const titleId = useId();
    const nameErrorId = useId();
    const quantityErrorId = useId();

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

    const categoryOptions = [
        { value: 'starter', label: t('categories.starter') },
        { value: 'main', label: t('categories.main') },
        { value: 'dessert', label: t('categories.dessert') },
        { value: 'drink', label: t('categories.drink') },
        { value: 'equipment', label: t('categories.equipment') },
        { value: 'other', label: t('categories.other') },
        // Add Trempim if editing a ride
        ...(isRide ? [{ value: 'trempim', label: 'טרמפים' }] : [])
    ];

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

        if (isRide && !formData.phoneNumber?.trim()) {
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
            const updates: Partial<MenuItem> = {
                name: formData.name.trim(),
                category: formData.category,
                quantity: formData.quantity,
                notes: formData.notes.trim() || undefined,
                isSplittable: formData.quantity > 1, // Preserve splittable status based on quantity
            };

            if (formData.phoneNumber?.trim()) {
                updates.phoneNumber = formData.phoneNumber.trim();
            } else if (item.phoneNumber) {
                // If it had a phone number but now it's empty, we should explicitly set it to null to delete it in Firebase
                updates.phoneNumber = null as any;
            }

            // Add ride-specific fields if it's a ride
            if (isRide) {
                updates.direction = formData.direction as any;
                updates.departureTime = formData.departureTime || undefined;
                updates.timeFlexibility = formData.timeFlexibility as any;
                updates.pickupLocation = formData.pickupLocation?.trim() || undefined;
            }

            await FirebaseService.updateMenuItem(eventId, item.id, updates);
            toast.success(t('editItemModal.success'));
            onClose();
        } catch (error: any) {
            console.error('❌ Error updating item:', error);

            let errorMessage = t('editItemModal.errors.generalError');
            if (error.message) {
                errorMessage = error.message;
            }

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
                    className="bg-white rounded-xl shadow-xl max-w-md w-full"
                >
                    <div className="flex items-center justify-between p-6 border-b">
                        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                            {isOffer ? 'עריכת הצעת טרמפ' : isRequest ? 'עריכת בקשת טרמפ' : t('editItemModal.title')}
                        </h2>
                        <button
                            onClick={onClose}
                            disabled={isSubmitting}
                            type="button"
                            aria-label={t('common.close')}
                            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                        >
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        {/* Item Name */}
                        <div className="mb-4">
                            <label htmlFor="item-name" className="block text-sm font-medium text-gray-700 mb-2">
                                {isRide ? 'פרטי הנסיעה (מאיפה ומתי?)' : t('editItemModal.fields.name')}
                            </label>
                            <div className="relative">
                                {isRide ? (
                                    <Car className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                                ) : (
                                    <ChefHat className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                                )}
                                <input
                                    id="item-name"
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder={isRide ? 'לדוגמה: יציאה מרכבת מרכז ב-17:00' : ''}
                                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
                                        }`}
                                    disabled={isSubmitting}
                                    required
                                    aria-required="true"
                                    aria-invalid={!!errors.name}
                                    aria-describedby={errors.name ? nameErrorId : undefined}
                                />
                            </div>
                            {errors.name && (
                                <p id={nameErrorId} className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                                    {errors.name}
                                </p>
                            )}
                        </div>

                        {/* Category - Locked for rides */}
                        {isRide ? (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    קטגוריה
                                </label>
                                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium flex items-center gap-2">
                                    <Car size={16} className="text-blue-500" />
                                    {isOffer ? 'הצעת טרמפ' : isRequest ? 'בקשת טרמפ' : 'טרמפים'}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <label htmlFor="category-select" className="block text-sm font-medium text-gray-700 mb-2">
                                    {t('editItemModal.fields.category')}
                                </label>
                                <select
                                    id="category-select"
                                    value={formData.category}
                                    onChange={(e) => handleInputChange('category', e.target.value as MenuCategory)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    disabled={isSubmitting}
                                    required
                                >
                                    {categoryOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Quantity */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {isOffer ? 'סה"כ מקומות ברכב' : isRequest ? 'מספר נוסעים' : t('editItemModal.fields.quantity')}
                            </label>
                            <Stepper
                                value={formData.quantity}
                                onChange={(val) => handleInputChange('quantity', val)}
                                min={Math.max(1, totalAssigned)} // Can't go below what's assigned
                                label={isRide ? 'מספר מקומות' : undefined}
                            />
                            {totalAssigned > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                    {isOffer
                                        ? (totalAssigned > 0 ? `שוריינו ${totalAssigned} מקומות ע"י נוסעים` : 'אין נוסעים רשומים עדיין')
                                        : isRequest
                                            ? (totalAssigned > 0 ? 'יש נהג/ת רשום/ה' : 'אין נהג/ת עדיין')
                                            : t('editItemModal.fields.assignedInfo', { assigned: totalAssigned })}
                                </p>
                            )}
                            {errors.quantity && (
                                <p id={quantityErrorId} className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                                    {errors.quantity}
                                </p>
                            )}
                        </div>

                        {/* Phone Number - Only for Rides */}
                        {isRide && (
                            <div className="mb-4">
                                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                                    מספר טלפון (חובה ליצירת קשר) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="phoneNumber"
                                    type="tel"
                                    value={formData.phoneNumber || ''}
                                    onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                                    placeholder="050-0000000"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dir-ltr text-right ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                                    disabled={isSubmitting}
                                />
                                {errors.phoneNumber && (
                                    <p className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                                        <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                                        {errors.phoneNumber}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Ride Direction and Time - Only for Rides */}
                        {isRide && (
                            <div className="mb-4 space-y-4 border-t pt-4">
                                {/* Direction */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        כיוון הנסיעה
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleInputChange('direction', 'to_event')}
                                            disabled={isSubmitting}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                formData.direction === 'to_event'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            → הלוך
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleInputChange('direction', 'from_event')}
                                            disabled={isSubmitting}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                                formData.direction === 'from_event'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            ← חזור
                                        </button>
                                    </div>
                                </div>

                                {/* Departure Time */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        שעת יציאה
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.departureTime || ''}
                                        onChange={(e) => handleInputChange('departureTime', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        disabled={isSubmitting}
                                    />
                                </div>

                                {/* Time Flexibility */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        גמישות בזמן
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {[
                                            { value: 'exact', label: 'מדויק' },
                                            { value: '15min', label: '±15\'' },
                                            { value: '30min', label: '±30\'' },
                                            { value: '1hour', label: '±1שעה' },
                                            { value: 'flexible', label: 'גמיש מאוד' }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleInputChange('timeFlexibility', opt.value)}
                                                disabled={isSubmitting}
                                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                                    formData.timeFlexibility === opt.value
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Pickup Location */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        נקודת איסוף (אופציונלי)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.pickupLocation || ''}
                                        onChange={(e) => handleInputChange('pickupLocation', e.target.value)}
                                        placeholder="לדוגמה: תל אביב - תחנה מרכזית"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <div className="mb-6">
                            <label htmlFor="notes-input" className="block text-sm font-medium text-gray-700 mb-2">
                                {isRide ? 'הערות נוספות' : t('editItemModal.fields.notes')}
                            </label>
                            <div className="relative">
                                <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                                <textarea
                                    id="notes-input"
                                    value={formData.notes}
                                    onChange={(e) => handleInputChange('notes', e.target.value)}
                                    placeholder={isRide ? 'לדוגמה: אין מקום למזוודות' : t('editItemModal.fields.notesPlaceholder')}
                                    rows={3}
                                    autoComplete="off"
                                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex space-x-3 rtl:space-x-reverse">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
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

