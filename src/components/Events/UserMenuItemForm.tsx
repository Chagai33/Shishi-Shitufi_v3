// src/components/Events/UserMenuItemForm.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import { X, ChefHat, MessageSquare, User as UserIcon, AlertCircle, Plus, Minus } from 'lucide-react';
import { useStore, selectMenuItems } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory, CategoryConfig } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';
import { isCarpoolLogic } from '../../utils/eventUtils';



interface UserMenuItemFormProps {
  event: ShishiEvent;
  onClose: () => void;
  category?: MenuCategory;
  availableCategories?: string[]; // Kept for compat
  isOrganizer?: boolean;
  onSuccess?: (category: MenuCategory) => void;
  initialCategory?: string;
  initialRowType?: 'needs' | 'offers';
}

interface FormErrors {
  name?: string;
  quantity?: string;
  phoneNumber?: string;
}

export function UserMenuItemForm({
  event,
  onClose,
  category,
  isOrganizer,
  onSuccess,
  initialCategory,
  initialRowType
}: UserMenuItemFormProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Decide initial category: prop > explicit category > 'main'
  const isLocked = !!(initialCategory || category);
  const defaultCat = initialCategory || category || 'main';


  // Default to 1 for regular users, 0 for organizers (so they can just add items)
  const isRideOffer = defaultCat === 'ride_offers' || defaultCat === 'trempim';
  const [myQuantity, setMyQuantity] = useState(isOrganizer ? 0 : (isRideOffer ? 0 : 1));

  // Accessibility: IDs and refs
  const titleId = useId();
  const nameErrorId = useId();
  const participantNameId = useId();
  const itemNameId = useId();
  const categoryId = useId();
  const notesId = useId();
  const isRequiredId = useId();
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ESC handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  // Focus return
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  // Helper Stepper Component - Updated to accept min prop + accessibility
  const Stepper = ({ value, onChange, max, min = 1, label }: { value: number, onChange: (val: number) => void, max?: number, min?: number, label?: string }) => (
    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden h-10 w-full dir-ltr">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={`${t('userItemForm.stepper.decrease')} ${label || ''}`}
        className={`w-10 h-full flex items-center justify-center border-r border-gray-200 ${value <= min ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 hover:bg-gray-100'}`}
        disabled={value <= min}
      >
        <Minus size={16} aria-hidden="true" />
      </button>
      <div className="flex-1 flex items-center justify-center bg-white font-semibold text-gray-800" role="status" aria-live="polite">{value}</div>
      <button
        type="button"
        onClick={() => onChange(max ? Math.min(max, value + 1) : value + 1)}
        aria-label={`${t('userItemForm.stepper.increase')} ${label || ''}`}
        className="w-10 h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 border-l border-gray-200"
      >
        <Plus size={16} aria-hidden="true" />
      </button>
    </div>
  );

  const [formData, setFormData] = useState({
    name: '',
    category: defaultCat as MenuCategory,
    quantity: (isRideOffer ? (initialRowType === 'needs' ? 1 : 4) : 1),
    notes: '',
    isSplittable: (isRideOffer || defaultCat === 'ride_requests'),
    isRequired: false,
    phoneNumber: '',
    rowType: initialRowType || (defaultCat === 'ride_offers' || defaultCat === 'trempim' ? 'offers' : (defaultCat === 'ride_requests' ? 'needs' : undefined))
  });


  const isRequest = formData.rowType === 'needs';


  // Get dynamic categories from the event
  const eventCategories = React.useMemo(() => {
    // Helper to get categories (can import getEventCategories but let's replicate or import)
    if (event.details.categories && event.details.categories.length > 0) {
      return event.details.categories.sort((a, b) => a.order - b.order);
    }
    // Fallback import would be better, but let's define it here or assume imports
    return [
      { id: 'starter', name: t('categories.starter'), order: 1 },
      { id: 'main', name: t('categories.main'), order: 2 },
      { id: 'dessert', name: t('categories.dessert'), order: 3 },
      { id: 'drink', name: t('categories.drink'), order: 4 },
      { id: 'equipment', name: t('categories.equipment'), order: 5 },
      { id: 'other', name: t('categories.other'), order: 6 },
    ] as CategoryConfig[];
  }, [event.details.categories, t]);

  // Ensure "trempim" is in the options even if not yet in event (visual only if we are in that mode)
  const categoryOptions = React.useMemo(() => {
    const opts = eventCategories.map(cat => ({
      value: cat.id,
      label: cat.name
    }));

    // For backwards compatibility or explicit locking
    if (formData.category === 'trempim' && !opts.some(o => o.value === 'trempim')) {
      opts.push({ value: 'trempim', label: 'טרמפים' });
    }
    if (formData.category === 'ride_offers' && !opts.some(o => o.value === 'ride_offers')) {
      opts.push({ value: 'ride_offers', label: 'הצעות טרמפ' });
    }
    if (formData.category === 'ride_requests' && !opts.some(o => o.value === 'ride_requests')) {
      opts.push({ value: 'ride_requests', label: 'בקשות טרמפ' });
    }
    return opts;
  }, [eventCategories, formData.category]);



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

    if ((formData.category === 'ride_offers' || formData.category === 'ride_requests' || formData.category === 'trempim') && !formData.phoneNumber?.trim()) {
      newErrors.phoneNumber = 'חובה להזין מספר טלפון ליצירת קשר';
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    return isValid;
  };

  // Helper: Check if user can add more items
  // const canAdd = isOrganizer || userItemCount < limit... (Handled in backend now too, but good for UI feedback)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allMenuItems = selectMenuItems(useStore.getState());

    if (!authUser) {
      toast.error(t('userItemForm.errors.mustLogin'));
      return;
    }

    if (!validateForm()) {
      if (errors.phoneNumber) {
        toast.error(errors.phoneNumber);
      } else {
        toast.error(t('userItemForm.errors.fixErrors'));
      }
      return;
    }

    const eventMenuItems = allMenuItems.filter(item => item.eventId === event.id);
    const isDuplicate = eventMenuItems.some(
      item => item.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
    );

    if (isDuplicate) {
      if (!window.confirm(t('userItemForm.errors.duplicateItem', { name: formData.name.trim() }))) {
        setIsSubmitting(false);
        return;
      }
    }

    // Bypass 'User Name' checks if only creating item without assigning self (e.g. Admin creating generic item)
    // However, logic below assumes we might join.
    if (showNameInput && !participantName.trim()) {
      toast.error(t('userItemForm.errors.missingName'));
      return;
    }

    setIsSubmitting(true);

    try {
      let finalUserName = participantName.trim();

      // If needed, join event
      if (showNameInput && finalUserName) {
        await FirebaseService.joinEvent(event.id, authUser.uid, finalUserName);
      } else {
        const existingParticipant = event.participants?.[authUser.uid];
        finalUserName = existingParticipant?.name || authUser.displayName || t('header.guest');
      }

      // Dynamic Category Creation (New System)
      const rideCatIds = ['ride_offers', 'ride_requests'];
      if (rideCatIds.includes(formData.category)) {
        const existingCat = event.details.categories?.find(c => c.id === formData.category);
        if (!existingCat) {
          const currentCats = event.details.categories || [];
          const catToAdd = formData.category === 'ride_offers'
            ? { id: 'ride_offers', name: 'הצעות טרמפ', icon: 'car.gif', color: '#34495e', order: 90, rowType: 'offers' }
            : { id: 'ride_requests', name: 'בקשות טרמפ', icon: 'car.gif', color: '#8e44ad', order: 91, rowType: 'needs' };

          const newCats = [...currentCats, catToAdd as any];
          await FirebaseService.updateEvent(event.id, {
            details: { ...event.details, categories: newCats }
          });
        }
      }


      const newItemData: Omit<MenuItem, 'id'> = {
        name: formData.name.trim(),
        category: formData.category,
        quantity: formData.quantity,
        notes: formData.notes.trim() || '',
        phoneNumber: formData.phoneNumber?.trim() || '',
        isSplittable: formData.quantity > 1,
        isRequired: formData.isRequired,
        rowType: formData.rowType,
        createdAt: Date.now(),
        creatorId: authUser.uid,
        creatorName: finalUserName,
        eventId: event.id
      };

      if (formData.phoneNumber?.trim()) {
        (newItemData as any).phoneNumber = formData.phoneNumber.trim();
      }

      if (!newItemData.notes) delete (newItemData as any).notes;

      // 1. Create Item (Total Quantity)
      // Pass bypassLimit: isOrganizer OR ride category to skip checks
      const shouldBypassLimit = isOrganizer || ['ride_offers', 'ride_requests', 'trempim', 'rides'].includes(formData.category);


      const itemId = await FirebaseService.addMenuItem(event.id, {
        ...newItemData,
        quantity: formData.quantity,
      }, { bypassLimit: shouldBypassLimit });

      // 2. Create Assignment (My Contribution) - only if > 0
      if (itemId && myQuantity > 0) {
        await FirebaseService.createAssignment(event.id, {
          eventId: event.id,
          menuItemId: itemId,
          userId: authUser.uid,
          userName: finalUserName,
          quantity: myQuantity,
          status: 'confirmed' as const,
          assignedAt: Date.now(),
          notes: formData.notes
        });
      }

      if (itemId) {
        toast.success(t('userItemForm.errors.success'));
        onSuccess?.(formData.category);
      } else {
        throw new Error(t('userItemForm.errors.generalError'));
      }

      onClose();
    } catch (error: any) {
      console.error('❌ Error in form submission:', error);
      let errorMessage = t('userItemForm.errors.generalError');
      if (error.code === 'PERMISSION_DENIED') {
        errorMessage = t('userItemForm.errors.permissionDenied');
      } else if (error.message) {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const updates: any = { [field]: value };

      // If switching category, reset ride-specific fields if new category is NOT a ride
      if (field === 'category') {
        const isNewRide = ['ride_offers', 'ride_requests', 'trempim', 'rides'].includes(value);
        if (!isNewRide) {
          updates.rowType = undefined;
          updates.phoneNumber = '';
          // Reset quantity to 1 for regular items if it was set to something high like 4 for rides
          if (prev.quantity === 4 || prev.quantity === 0) {
            updates.quantity = 1;
          }
        } else {
          // If switching TO a ride, set appropriate rowType if not set
          if (!prev.rowType || (prev.category !== value)) {
            updates.rowType = (value === 'ride_offers' || value === 'trempim') ? 'offers' : 'needs';
          }
        }
      }

      if (field === 'quantity' && (typeof value === 'number' && value <= 1)) {
        Object.assign(updates, { isSplittable: false });
      }
      return { ...prev, ...updates };
    });

    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Determine if current category is 'offers' type (Carpool)
  const currentCategoryObj = eventCategories.find(c => c.id === formData.category);
  const isOffersType = isCarpoolLogic(formData.name, formData.category, currentCategoryObj?.rowType);

  return (
    <div role="presentation" onClick={onClose}>
      <FocusTrap>
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                {isRequest ? 'בקשת טרמפ חדשה' : (isOffersType ? 'הצעת טרמפ חדשה' : t('userItemForm.title'))}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label={t('common.close')}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {showNameInput && (
                <div className="mb-4">
                  <label htmlFor={participantNameId} className="block text-sm font-medium text-gray-700 mb-2">
                    {isRequest ? 'שם הנוסע/ת' : (isOffersType ? 'שם הנהג' : t('userItemForm.fields.fullName'))}
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <input
                      id={participantNameId}
                      type="text"
                      value={participantName}
                      onChange={(e) => setParticipantName(e.target.value)}
                      placeholder={t('userItemForm.fields.nameDisplayPlaceholder')}
                      autoComplete="name"
                      className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                      required
                      aria-required="true"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1" id={`${participantNameId}-help`}>{t('userItemForm.fields.nameHelp')}</p>
                </div>
              )}
              <div className="mb-4">
                <label htmlFor={itemNameId} className="block text-sm font-medium text-gray-700 mb-2">
                  {isRequest ? 'מאיפה ומתי?' : (isOffersType ? 'פרטי הנסיעה (מאיפה ומתי?)' : t('userItemForm.fields.name'))}
                </label>
                <div className="relative">
                  <ChefHat className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={itemNameId}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={isRequest ? 'לדוגמה: מחפש טרמפ מירושלים ב-15:00' : (isOffersType ? 'לדוגמה: יציאה מחולון ב-16:00' : t('userItemForm.fields.namePlaceholder'))}
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? nameErrorId : undefined}
                  />
                </div>
                {errors.name && (
                  <p id={nameErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                    {errors.name}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {!isLocked && (
                  <div>
                    <label htmlFor={categoryId} className="block text-sm font-medium text-gray-700 mb-2">
                      {t('userItemForm.fields.category')}
                    </label>
                    <select
                      id={categoryId}
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value as MenuCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      disabled={isSubmitting}
                      required
                      aria-required="true"
                    >
                      {categoryOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={`${isLocked ? 'col-span-2' : ''} grid grid-cols-2 gap-4`}>

                  {/* Total Needed */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {isRequest ? 'כמה מקומות אתם?' : (isOffersType ? 'מספר מקומות פנויים' : t('userItemForm.fields.quantityTotal'))}
                    </label>
                    <Stepper
                      value={formData.quantity}
                      onChange={(val) => {
                        handleInputChange('quantity', val);
                        if (!isRequest) {
                          const newMyQty = myQuantity > val ? val : myQuantity;
                          if (myQuantity > val) setMyQuantity(val);
                          if (val > newMyQty) handleInputChange('isSplittable', true);
                        }
                      }}
                      label={isRequest ? 'מספר מקומות' : t('userItemForm.fields.quantityTotal')}
                    />
                  </div>

                  {/* My Contribution */}
                  {!isRequest && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {isOffersType ? 'שריין לעצמך/חברים' : t('userItemForm.fields.myContribution')}
                        </label>
                        {myQuantity < formData.quantity && (
                          <button
                            type="button"
                            onClick={() => setMyQuantity(formData.quantity)}
                            aria-label={t('userItemForm.fields.bringAll')}
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium underline focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                          >
                            {isOffersType ? 'מלא את הכל' : t('userItemForm.fields.bringAll')}
                          </button>
                        )}
                      </div>
                      <Stepper
                        value={myQuantity}
                        onChange={setMyQuantity}
                        max={formData.quantity}
                        min={0} // Allow 0 for rides specifically
                        label={t('userItemForm.fields.myContribution')}
                      />
                    </div>
                  )}
                  {!isRequest && (
                    <div className="col-span-2 text-xs text-gray-500 text-center -mt-2">
                      {myQuantity < formData.quantity ?
                        (myQuantity === 0 ? (isOffersType ? "כל המקומות פנויים לאחרים" : "אתה לא מביא כלום (מנהל)") : t('userItemForm.fields.remainingMsg', { count: formData.quantity - myQuantity })) :
                        (isOffersType ? "הרכב מלא (שריינת הכל)" : t('userItemForm.fields.youBringAllMsg'))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-6">
                <label htmlFor={notesId} className="block text-sm font-medium text-gray-700 mb-2">
                  {isRequest ? 'הערות (מסלול, נקודות איסוף...)' : (isOffersType ? 'הערות (מסלול, נקודות איסוף...)' : t('userItemForm.fields.notes'))}
                </label>
                <div className="relative">
                  <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <textarea
                    id={notesId}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder={isRequest ? 'לדוגמה: מחכה ליד בית הכנסת הגדול' : (isOffersType ? 'לדוגמה: יוצאים מרכבת ארלוזורוב, אין מקום למזוודות גדולות' : t('userItemForm.fields.notesPlaceholder'))}
                    rows={3}
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Phone Number - Only for Rides */}
              {(isOffersType || isRequest) && (
                <div className="mb-4">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
                    מספר טלפון (חובה ליצירת קשר) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="phoneNumber"
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.phoneNumber || ''}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      placeholder="050-0000000"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-right sm:text-left dir-ltr ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="mt-1 text-xs text-red-600 flex items-center" role="alert">
                      <AlertCircle className="h-3 w-3 ml-1" aria-hidden="true" />
                      {errors.phoneNumber}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">יוצג רק למי שלוקח/מצטרף לנסיעה</p>
                </div>
              )}

              {/* Admin: Is Required Checkbox */}
              {isOrganizer && !isOffersType && !isRequest && (
                <div className="mb-6 flex items-center bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <input
                    id={isRequiredId}
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) => handleInputChange('isRequired', e.target.checked)}
                    className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor={isRequiredId} className="mr-3 block text-sm font-semibold text-gray-800">
                    {t('userItemForm.fields.isRequired')}
                  </label>
                </div>
              )}

              {/* Actions */}
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" aria-hidden="true"></div>
                      {t('userItemForm.submitting')}
                    </>
                  ) : (
                    isRequest ? 'בקש טרמפ' : (isOffersType ? 'הצע טרמפ' : t('userItemForm.submit'))
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  {t('userItemForm.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
