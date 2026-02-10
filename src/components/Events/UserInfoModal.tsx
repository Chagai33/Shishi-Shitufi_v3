import React, { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { X, User, Phone, Mail, AlertCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { saveUserToLocalStorage, updateUserInLocalStorage } from '../../utils/userUtils';
import toast from 'react-hot-toast';

interface UserInfoModalProps {
  onClose: () => void;
  onComplete: () => void;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

export function UserInfoModal({ onClose, onComplete }: UserInfoModalProps) {
  const { user, setUser } = useStore();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Accessibility: Unique ID for ARIA labeling
  const titleId = useId();
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const emailErrorId = useId();

  // Accessibility: Store reference to the element that opened the modal
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'שם הוא שדה חובה';
    } else if (name.trim().length < 2) {
      newErrors.name = 'השם חייב להכיל לפחות 2 תווים';
    }

    if (phone.trim() && !/^[\d\-\s\+\(\)]+$/.test(phone.trim())) {
      newErrors.phone = 'מספר טלפון לא תקין';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }

    setIsSubmitting(true);

    try {
      const updatedUser = {
        ...user!,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined
      };

      saveUserToLocalStorage(updatedUser);
      setUser(updatedUser);

      toast.success('הפרטים נשמרו בהצלחה!');
      onComplete();
    } catch (error) {
      console.error('Error saving user info:', error);
      toast.error('שגיאה בשמירת הפרטים. אנא נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case 'name':
        setName(value);
        break;
      case 'phone':
        setPhone(value);
        break;
      case 'email':
        setEmail(value);
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
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">פרטים אישיים</h2>
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
            <div className="mb-6">
              <p className="text-gray-600 text-sm">
                כדי לשבץ פריטים, יש להזין פרטים אישיים. הפרטים נשמרים רק במכשיר שלך.
              </p>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label htmlFor="name-input" className="block text-sm font-medium text-gray-700 mb-2">
                שם מלא <span className="text-red-500" aria-label="שדה חובה">*</span>
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="name-input"
                  type="text"
                  value={name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="הזן שם מלא"
                  autoComplete="name"
                  className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'
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

            {/* Phone */}
            <div className="mb-4">
              <label htmlFor="phone-input" className="block text-sm font-medium text-gray-700 mb-2">
                טלפון (אופציונלי)
              </label>
              <div className="relative">
                <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="050-1234567"
                  autoComplete="tel"
                  inputMode="tel"
                  className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${errors.phone ? 'border-red-500' : 'border-gray-300'
                    }`}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? phoneErrorId : undefined}
                />
              </div>
              {errors.phone && (
                <p id={phoneErrorId} className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                  <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="mb-6">
              <label htmlFor="email-input" className="block text-sm font-medium text-gray-700 mb-2">
                אימייל (אופציונלי)
              </label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                <input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="example@email.com"
                  autoComplete="email"
                  inputMode="email"
                  className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent ${errors.email ? 'border-red-500' : 'border-gray-300'
                    }`}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? emailErrorId : undefined}
                />
              </div>
              {errors.email && (
                <p id={emailErrorId} className="mt-1 text-sm text-red-600 flex items-center" role="alert">
                  <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 rtl:space-x-reverse">
              <button
                onClick={handleSave}
                disabled={!name.trim() || isSubmitting}
                type="button"
                className="flex-1 bg-accent-dark hover:bg-accent-dark/90 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                    שומר…
                  </>
                ) : (
                  'שמור פרטים'
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                type="button"
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}