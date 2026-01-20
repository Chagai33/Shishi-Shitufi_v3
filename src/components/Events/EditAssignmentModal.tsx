import React, { useState } from 'react';
import { X, Hash, MessageSquare, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, ShishiEvent, Assignment } from '../../types';
import toast from 'react-hot-toast';

interface EditAssignmentModalProps {
  menuItem: MenuItem;
  event: ShishiEvent;
  assignment: Assignment;
  onClose: () => void;
}

interface FormErrors {
  quantity?: string;
}

export function EditAssignmentModal({ menuItem, event, assignment, onClose }: EditAssignmentModalProps) {
  const { updateAssignment } = useStore();
  const [quantity, setQuantity] = useState(assignment.quantity);
  const [notes, setNotes] = useState(assignment.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (quantity <= 0) {
      newErrors.quantity = 'הכמות חייבת להיות לפחות 1';
    } else if (quantity > 100) {
      newErrors.quantity = 'הכמות לא יכולה להיות יותר מ-100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    if (!validateForm()) {
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }

    setIsSubmitting(true);

    try {
      const updates = {
        quantity,
        notes: notes.trim() || undefined,
        updatedAt: Date.now()
      };

      const success = await FirebaseService.updateAssignment(assignment.id, updates);
      
      if (success) {
        // Update local store immediately
        updateAssignment(assignment.id, updates);
        toast.success('השיבוץ עודכן בהצלחה!');
        onClose();
      } else {
        throw new Error('Failed to update assignment');
      }
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">עריכת שיבוץ</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Details */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-2">{menuItem.name}</h3>
            <p className="text-sm text-gray-600">עבור: {event.title}</p>
            <p className="text-sm text-gray-600">משובץ ל: {assignment.userName}</p>
            {menuItem.isRequired && (
              <div className="flex items-center mt-2">
                <AlertCircle className="h-4 w-4 text-red-500 ml-1" />
                <span className="text-sm text-red-600 font-medium">פריט חובה</span>
              </div>
            )}
          </div>

          {/* Quantity Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              כמות שאביא *
            </label>
            <div className="relative">
              <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="number"
                min="1"
                max="100"
                value={quantity}
                onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
                className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.quantity ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isSubmitting}
                required
              />
            </div>
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
              הערות (אופציונלי)
            </label>
            <div className="relative">
              <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
              <textarea
                value={notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="הערות נוספות..."
                rows={3}
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
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  מעדכן...
                </>
              ) : (
                'עדכן שיבוץ'
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}