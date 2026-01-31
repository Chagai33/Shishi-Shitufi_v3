// src/components/Events/UserMenuItemForm.tsx

import React, { useState, useEffect } from 'react';
import { X, ChefHat, MessageSquare, User as UserIcon, AlertCircle, Plus, Minus } from 'lucide-react';
import { useStore, selectMenuItems } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface UserMenuItemFormProps {
  event: ShishiEvent;
  onClose: () => void;
  category?: MenuCategory;
  availableCategories?: string[];
  isOrganizer?: boolean; // New prop
}

interface FormErrors {
  name?: string;
  quantity?: string;
}

export function UserMenuItemForm({ event, onClose, category, availableCategories, isOrganizer }: UserMenuItemFormProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  // Default to 1 for regular users, 0 for organizers (so they can just add items)
  const [myQuantity, setMyQuantity] = useState(isOrganizer ? 0 : 1);

  // Helper Stepper Component - Updated to accept min prop
  const Stepper = ({ value, onChange, max, min = 1 }: { value: number, onChange: (val: number) => void, max?: number, min?: number }) => (
    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-10 w-full dir-ltr">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className={`w-10 h-full flex items-center justify-center border-r border-gray-200 ${value <= min ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100'}`} disabled={value <= min}><Minus size={16} /></button>
      <div className="flex-1 flex items-center justify-center bg-white font-semibold text-gray-800">{value}</div>
      <button type="button" onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)} className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-l border-gray-200"><Plus size={16} /></button>
    </div>
  );

  const [formData, setFormData] = useState({
    name: '',
    category: category || ('main' as MenuCategory),
    quantity: 1,
    notes: '',
    isSplittable: false,
  });

  const categoryOptions = [
    { value: 'starter', label: t('categories.starter') },
    { value: 'main', label: t('categories.main') },
    { value: 'dessert', label: t('categories.dessert') },
    { value: 'drink', label: t('categories.drink') },
    { value: 'equipment', label: t('categories.equipment') },
    { value: 'other', label: t('categories.other') }
  ];

  useEffect(() => {
    if (authUser?.isAnonymous) {
      const participants = event.participants || {};
      const isParticipant = !!participants[authUser.uid];
      if (!isParticipant) {
        setShowNameInput(true);
      }
    }
  }, [authUser, event.participants]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = t('userItemForm.errors.nameRequired');
    } else if (formData.name.trim().length < 2) {
      newErrors.name = t('userItemForm.errors.nameLength');
    }

    if (formData.quantity < 1) {
      newErrors.quantity = t('userItemForm.errors.quantityMin');
    } else if (formData.quantity > 100) {
      newErrors.quantity = t('userItemForm.errors.quantityMax');
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allMenuItems = selectMenuItems(useStore.getState());

    if (!authUser) {
      console.error('❌ No authenticated user');
      toast.error(t('userItemForm.errors.mustLogin'));
      console.groupEnd();
      return;
    }

    if (!validateForm()) {
      console.error('❌ Form validation failed');
      toast.error(t('userItemForm.errors.fixErrors'));
      return;
    }

    const eventMenuItems = allMenuItems.filter(item => item.eventId === event.id);
    const isDuplicate = eventMenuItems.some(
      item => item.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
    );

    if (isDuplicate) {
      if (!window.confirm(t('userItemForm.errors.duplicateItem', { name: formData.name.trim() }))) {
        setIsSubmitting(false);
        return; // Stop the function if user clicked "Cancel"
      }
    }

    if (showNameInput && !participantName.trim()) {
      console.error('❌ Name required but not provided');
      toast.error(t('userItemForm.errors.missingName'));
      return;
    }

    setIsSubmitting(true);

    try {
      let finalUserName = participantName.trim();

      if (showNameInput && finalUserName) {
        await FirebaseService.joinEvent(event.id, authUser.uid, finalUserName);
      } else {
        const existingParticipant = event.participants?.[authUser.uid];
        finalUserName = existingParticipant?.name || authUser.displayName || t('header.guest');
      }
      const newItemData: Omit<MenuItem, 'id'> = {
        name: formData.name.trim(),
        category: formData.category,
        quantity: formData.quantity,
        notes: formData.notes.trim() || '',
        isSplittable: formData.quantity > 1, // Auto-split if more than 1 item needed
        isRequired: false,
        createdAt: Date.now(),
        creatorId: authUser.uid,
        creatorName: finalUserName,
        eventId: event.id
      };

      if (!newItemData.notes) {
        delete (newItemData as any).notes;
      }

      // 1. Create Item (Total Quantity)
      const itemId = await FirebaseService.addMenuItem(event.id, {
        ...newItemData,
        quantity: formData.quantity, // Total needed
      });

      // 2. Create Assignment (My Contribution) - only if > 0
      if (itemId && myQuantity > 0) {
        await FirebaseService.createAssignment(event.id, {
          eventId: event.id,
          menuItemId: itemId,
          userId: authUser.uid,
          userName: finalUserName,
          quantity: myQuantity, // What I bring
          status: 'confirmed' as const,
          assignedAt: Date.now(),
          notes: formData.notes
        });
      }

      if (itemId) {
        // We can't immediately add to store without fetching, but we assume subscription handles it or we do optimistic update
        // For now, simpler to just close
        toast.success(t('userItemForm.errors.success'));
      } else {
        console.error('❌ Failed to get item ID');
        throw new Error(t('userItemForm.errors.generalError'));
      }

      onClose();
    } catch (error: any) {
      console.error('❌ Error in form submission:', error);
      console.error('📊 Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });

      let errorMessage = t('userItemForm.errors.generalError');
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = t('userItemForm.errors.permissionDenied');
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
      console.groupEnd();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const updates = { [field]: value };
      // Reset isSplittable if quantity becomes 1
      if (field === 'quantity' && (typeof value === 'number' && value <= 1)) {
        Object.assign(updates, { isSplittable: false });
      }
      return { ...prev, ...updates };
    });

    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{t('userItemForm.title')}</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {showNameInput && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('userItemForm.fields.fullName')}
              </label>
              <div className="relative">
                <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  placeholder={t('userItemForm.fields.nameDisplayPlaceholder')}
                  className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">{t('userItemForm.fields.nameHelp')}</p>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('userItemForm.fields.name')}
            </label>
            <div className="relative">
              <ChefHat className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder={t('userItemForm.fields.namePlaceholder')}
                className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
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
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('userItemForm.fields.category')}
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value as MenuCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            <div className="col-span-2 grid grid-cols-2 gap-4">
              {/* Total Needed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('userItemForm.fields.quantityTotal')}</label>
                <Stepper
                  value={formData.quantity}
                  onChange={(val) => {
                    handleInputChange('quantity', val);
                    const newMyQty = myQuantity > val ? val : myQuantity;
                    if (myQuantity > val) setMyQuantity(val);

                    // UX Auto-Logic: If Total > My Contribution, enable splitting automatically
                    if (val > newMyQty) {
                      handleInputChange('isSplittable', true);
                    }
                  }}
                />
              </div>

              {/* My Contribution */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">{t('userItemForm.fields.myContribution')}</label>
                  {myQuantity < formData.quantity && (
                    <button
                      type="button"
                      onClick={() => setMyQuantity(formData.quantity)}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium underline"
                    >
                      {t('userItemForm.fields.bringAll')}
                    </button>
                  )}
                </div>
                <Stepper
                  value={myQuantity}
                  onChange={setMyQuantity}
                  max={formData.quantity}
                  min={isOrganizer ? 0 : 1} // Organizer can set 0
                />
              </div>
              <div className="col-span-2 text-xs text-gray-500 text-center -mt-2">
                {myQuantity < formData.quantity ?
                  (myQuantity === 0 ? "אתה לא מביא כלום (מנהל)" : t('userItemForm.fields.remainingMsg', { count: formData.quantity - myQuantity })) :
                  t('userItemForm.fields.youBringAllMsg')}
              </div>
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('userItemForm.fields.notes')}
            </label>
            <div className="relative">
              <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder={t('userItemForm.fields.notesPlaceholder')}
                rows={3}
                className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Auto-split logic applied implicitly for quantity > 1 */}
          <div className="flex space-x-3 rtl:space-x-reverse">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  {t('userItemForm.submitting')}
                </>
              ) : (
                t('userItemForm.submit')
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {t('userItemForm.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
