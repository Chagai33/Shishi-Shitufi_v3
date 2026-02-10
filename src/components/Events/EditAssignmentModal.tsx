import { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, Hash, MessageSquare, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, ShishiEvent, Assignment } from '../../types';
import toast from 'react-hot-toast';
import { isCarpoolLogic } from '../../utils/eventUtils';

interface EditAssignmentModalProps {
  menuItem: MenuItem;
  event: ShishiEvent;
  assignment: Assignment;
  onClose: () => void;
  itemRowType?: 'needs' | 'offers';
}

interface FormErrors {
  quantity?: string;
}

export function EditAssignmentModal({ menuItem, event, assignment, onClose, itemRowType }: EditAssignmentModalProps) {
  const { t } = useTranslation();
  const { updateAssignment } = useStore();
  const [quantity, setQuantity] = useState(assignment.quantity);
  const [notes, setNotes] = useState(assignment.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const isOffers = isCarpoolLogic(menuItem.name, menuItem.category, itemRowType);

  // Accessibility: Unique IDs for ARIA labeling
  const titleId = useId();
  const quantityErrorId = useId();

  // Accessibility: Store reference to the element that opened the modal
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (quantity <= 0) {
      newErrors.quantity = t('editAssignmentModal.errors.quantityMin');
    } else if (quantity > 100) {
      newErrors.quantity = t('editAssignmentModal.errors.quantityMax');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      toast.error(t('editItemModal.errors.fixErrors'));
      return;
    }

    setIsSubmitting(true);

    try {
      const updates = {
        quantity,
        notes: notes.trim() || undefined,
        updatedAt: Date.now()
      };

      await FirebaseService.updateAssignment(event.id, assignment.id, updates);

      // Update local store immediately
      updateAssignment(assignment.id, updates);
      toast.success(isOffers ? t('editAssignmentModal.rideSuccess') : t('editAssignmentModal.success'));
      onClose();

    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('שגיאה בעדכון השיבוץ. אנא נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    switch (field) {
      case 'quantity':
        setQuantity(value);
        break;
      case 'notes':
        setNotes(value);
        break;
    }

    // Clear error when user starts typing
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
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">{isOffers ? t('editAssignmentModal.rideTitle') : t('editAssignmentModal.title')}</h2>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              type="button"
              aria-label="סגור חלון"
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Item Details */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-2">{menuItem.name}</h3>
              <p className="text-sm text-gray-600">עבור: {event.details.title}</p>
              <p className="text-sm text-gray-600">{isOffers ? t('editAssignmentModal.reservedFor', { name: assignment.userName }) : t('editAssignmentModal.assignedTo', { name: assignment.userName })}</p>
              {menuItem.isRequired && (
                <div className="flex items-center mt-2">
                  <AlertCircle className="h-4 w-4 text-red-500 ml-1" aria-hidden="true" />
                  <span className="text-sm text-red-600 font-medium">{t('editAssignmentModal.requiredItem')}</span>
                </div>
              )}
            </div>

            {/* Quantity Input */}
            <div className="mb-6">
              <label htmlFor="quantity-input" className="block text-sm font-medium text-gray-700 mb-2">
                {isOffers ? t('editAssignmentModal.seatsLabel') : t('editAssignmentModal.quantityLabel')} <span className="text-red-500" aria-label="שדה חובה">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="quantity-input"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                  inputMode="numeric"
                  className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.quantity ? 'border-red-500' : 'border-gray-300'
                    }`}
                  disabled={isSubmitting}
                  required
                  aria-required="true"
                  aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? quantityErrorId : undefined}
                />
              </div>
              {errors.quantity && (
                <p id={quantityErrorId} className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                  <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                  {errors.quantity}
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label htmlFor="notes-input" className="block text-sm font-medium text-gray-700 mb-2">
                {t('editAssignmentModal.notesLabel')}
              </label>
              <div className="relative">
                <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                <textarea
                  id="notes-input"
                  value={notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder={t('editAssignmentModal.notesPlaceholder')}
                  rows={3}
                  autoComplete="off"
                  className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3 rtl:space-x-reverse">
              <button
                onClick={handleUpdate}
                disabled={isSubmitting}
                type="button"
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    {t('editAssignmentModal.updating')}
                  </>
                ) : (
                  isOffers ? t('editAssignmentModal.updateRideBtn') : t('editAssignmentModal.updateBtn')
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                type="button"
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('editAssignmentModal.cancelBtn')}
              </button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}