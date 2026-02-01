import React, { useState, useEffect, useRef, useId } from 'react';
import { X, ChefHat, Hash, FileText, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuItem, MenuCategory } from '../../types';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth'; // 1. Import
import FocusTrap from 'focus-trap-react';

interface MenuItemFormProps {
  event: ShishiEvent;
  item?: MenuItem;
  onClose: () => void;
}

interface FormErrors {
  name?: string;
  quantity?: string;
}

export function MenuItemForm({ event, item, onClose }: MenuItemFormProps) {
  const { menuItems, updateMenuItem } = useStore();
  const { user: authUser } = useAuth(); // 2. Getting the authenticated user
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Accessibility: IDs and refs
  const titleId = useId();
  const nameId = useId();
  const categoryId = useId();
  const quantityId = useId();
  const notesId = useId();
  const isRequiredId = useId();
  const nameErrorId = useId();
  const quantityErrorId = useId();
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

  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || 'main' as MenuCategory,
    quantity: item?.quantity || 1,
    notes: item?.notes || '',
    isRequired: item?.isRequired || false,
    isSplittable: item?.isSplittable || false
  });

  const categoryOptions = [
    { value: 'starter', label: 'מנה ראשונה' },
    { value: 'main', label: 'מנה עיקרית' },
    { value: 'dessert', label: 'קינוח' },
    { value: 'drink', label: 'שתייה' },
    { value: 'other', label: 'אחר' }
  ];

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'שם הפריט הוא שדה חובה';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'שם הפריט חייב להכיל לפחות 2 תווים';
    }

    if (formData.quantity < 1) {
      newErrors.quantity = 'הכמות חייבת להיות לפחות 1';
    } else if (formData.quantity > 100) {
      newErrors.quantity = 'הכמות לא יכולה להיות יותר מ-100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!item) {
        const eventMenuItems = menuItems.filter(mi => mi.eventId === event.id);
        const isDuplicate = eventMenuItems.some(
          mi => mi.name.trim().toLowerCase() === formData.name.trim().toLowerCase()
        );

        if (isDuplicate) {
          if (!confirm(`פריט בשם "${formData.name.trim()}" כבר קיים באירוע. האם להוסיף אותו בכל זאת?`)) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      const itemData = {
        ...formData,
        name: formData.name.trim(),
        notes: formData.notes.trim() || undefined,
        eventId: event.id,
        isSplittable: formData.quantity > 1 // Auto-calculated based on quantity
      };

      if (item) {
        const success = await FirebaseService.updateMenuItem(item.id, itemData);
        if (success) {
          updateMenuItem(item.id, itemData);
          toast.success('הפריט עודכן בהצלחה!');
          onClose();
        } else {
          throw new Error('Failed to update menu item');
        }
      } else {
        // 3. Adding creator details to new item
        const newItem = {
          ...itemData,
          createdAt: Date.now(),
          creatorId: authUser?.uid || 'admin',
          creatorName: authUser?.displayName || 'Admin'
        };

        const itemId = await FirebaseService.createMenuItem(newItem);
        if (itemId) {
          toast.success('הפריט נוסף בהצלחה!');
          onClose();
        } else {
          throw new Error('Failed to create menu item');
        }
      }
    } catch (error) {
      console.error('Error saving menu item:', error);
      toast.error(item ? 'שגיאה בעדכון הפריט. אנא נסה שוב.' : 'שגיאה בהוספת הפריט. אנא נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => {
      const updates = { [field]: value };
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
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">{item ? 'עריכת פריט' : 'פריט חדש'}</h2>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="סגור"
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="mb-4">
                <label htmlFor={nameId} className="block text-sm font-medium text-gray-700 mb-2">שם הפריט *</label>
                <div className="relative">
                  <ChefHat className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={nameId}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="לחם, סלט, יין, וכו'"
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? nameErrorId : undefined}
                  />
                </div>
                {errors.name && (<p id={nameErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />{errors.name}</p>)}
              </div>

              <div className="mb-4">
                <label htmlFor={categoryId} className="block text-sm font-medium text-gray-700 mb-2">קטגוריה *</label>
                <select
                  id={categoryId}
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value as MenuCategory)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={isSubmitting}
                  required
                  aria-required="true"
                >
                  {categoryOptions.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor={quantityId} className="block text-sm font-medium text-gray-700 mb-2">כמות מוצעת *</label>
                <div className="relative">
                  <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={quantityId}
                    type="number"
                    min="1"
                    max="100"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.quantity ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.quantity ? 'true' : 'false'}
                    aria-describedby={errors.quantity ? quantityErrorId : undefined}
                  />
                </div>
                {errors.quantity && (<p id={quantityErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />{errors.quantity}</p>)}
              </div>

              <div className="mb-4">
                <label htmlFor={notesId} className="block text-sm font-medium text-gray-700 mb-2">הערות (אופציונלי)</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-3 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <textarea
                    id={notesId}
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="הערות נוספות על הפריט..."
                    rows={3}
                    className="w-full pr-10 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    id={isRequiredId}
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) => handleInputChange('isRequired', e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    disabled={isSubmitting}
                  />
                  <span className="mr-2 text-sm text-gray-700">פריט חובה</span>
                </label>
                <p className="text-xs text-gray-500 mt-1" id={`${isRequiredId}-help`}>פריטים חובה מסומנים באופן מיוחד למשתתפים</p>
              </div>

              {/* Auto-calculated: Items with quantity > 1 are automatically splittable */}
              {formData.quantity > 1 && (
                <p className="text-xs text-blue-600 mb-4 bg-blue-50 p-2 rounded" role="status">
                  ℹ️ הפריט יוגדר אוטומטית כ"ניתן לחלוקה" כי הכמות גדולה מ-1.
                </p>
              )}

              <div className="flex space-x-3 rtl:space-x-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {isSubmitting ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" aria-hidden="true"></div>שומר...</>) : (item ? 'עדכן פריט' : 'הוסף פריט')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}