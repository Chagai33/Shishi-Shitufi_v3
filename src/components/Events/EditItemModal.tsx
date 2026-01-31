// src/components/Events/EditItemModal.tsx

import React, { useState } from 'react';
import { X, ChefHat, MessageSquare, AlertCircle, Plus, Minus } from 'lucide-react';
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
}

export function EditItemModal({ item, eventId, assignments, onClose }: EditItemModalProps) {
    const { t } = useTranslation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<FormErrors>({});

    // Calculate total assigned quantity for this item
    const totalAssigned = assignments
        .filter(a => a.menuItemId === item.id)
        .reduce((sum, a) => sum + a.quantity, 0);

    const [formData, setFormData] = useState({
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        notes: item.notes || '',
    });

    // Helper Stepper Component
    const Stepper = ({ value, onChange, min }: { value: number, onChange: (val: number) => void, min: number }) => (
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-10 w-full dir-ltr">
            <button
                type="button"
                onClick={() => onChange(Math.max(min, value - 1))}
                disabled={value <= min}
                className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-r border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            >
                <Minus size={16} />
            </button>
            <div className="flex-1 flex items-center justify-center bg-white font-semibold text-gray-800">{value}</div>
            <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-l border-gray-200"
            >
                <Plus size={16} />
            </button>
        </div>
    );

    const categoryOptions = [
        { value: 'starter', label: t('categories.starter') },
        { value: 'main', label: t('categories.main') },
        { value: 'dessert', label: t('categories.dessert') },
        { value: 'drink', label: t('categories.drink') },
        { value: 'equipment', label: t('categories.equipment') },
        { value: 'other', label: t('categories.other') }
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

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            toast.error(t('editItemModal.errors.fixErrors'));
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">{t('editItemModal.title')}</h2>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Item Name */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('editItemModal.fields.name')}
                        </label>
                        <div className="relative">
                            <ChefHat className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                disabled={isSubmitting}
                                required
                            />
                        </div>
                        {errors.name && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                                <AlertCircle className="h-4 w-4 ml-1" />
                                {errors.name}
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('editItemModal.fields.category')}
                        </label>
                        <select
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

                    {/* Quantity */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('editItemModal.fields.quantity')}
                        </label>
                        <Stepper
                            value={formData.quantity}
                            onChange={(val) => handleInputChange('quantity', val)}
                            min={totalAssigned}
                        />
                        {totalAssigned > 0 && (
                            <p className="mt-1 text-xs text-gray-500">
                                {t('editItemModal.fields.assignedInfo', { assigned: totalAssigned })}
                            </p>
                        )}
                        {errors.quantity && (
                            <p className="mt-1 text-sm text-red-600 flex items-center">
                                <AlertCircle className="h-4 w-4 ml-1" />
                                {errors.quantity}
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {t('editItemModal.fields.notes')}
                        </label>
                        <div className="relative">
                            <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                            <textarea
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                placeholder={t('editItemModal.fields.notesPlaceholder')}
                                rows={3}
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
        </div>
    );
}
