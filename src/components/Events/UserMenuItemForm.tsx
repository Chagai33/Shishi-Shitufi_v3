// src/components/Events/UserMenuItemForm.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import { X, ChefHat, User as UserIcon, AlertCircle, Plus, Minus, Clock, MapPin, ChevronDown, ChevronUp, Info, Phone } from 'lucide-react';
import { useStore, selectMenuItems } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, MenuCategory, CategoryConfig } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import FocusTrap from 'focus-trap-react';
import { isCarpoolLogic } from '../../utils/eventUtils';

// ============================================================================
// HELPER COMPONENTS - Card View Style
// ============================================================================

// TimeSelect: Dropdown with 15-minute intervals

interface TimeSelectProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  referenceTime?: string; // Event time "HH:MM"
  type?: 'to' | 'from';   // Logic for offset
}

const TimeSelect: React.FC<TimeSelectProps> = ({
  label, value, onChange, disabled = false, required = false,
  referenceTime, type = 'to'
}) => {
  const times: string[] = [];

  // Calculate start hour based on event time
  let startHour = 0;
  if (referenceTime) {
    const [h] = referenceTime.split(':').map(Number);
    if (!isNaN(h)) {
      if (type === 'to') {
        // Start 5 hours before event
        startHour = (h - 5 + 24) % 24;
      } else {
        // Start from event time (e.g., event end usually starts *at* event time or later)
        // Let's assume return rides start around event time + 1 hour? Or just event time.
        // User said: "Event at 19:00... like inbound"
        startHour = h;
      }
    }
  }

  // Generate 24 hours starting from startHour
  for (let i = 0; i < 24; i++) {
    const h = (startHour + i) % 24;
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      times.push(time);
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
          className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white appearance-none text-gray-700"
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

// FlexibilitySelector: Select dropdown for time flexibility
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
        className="block w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white text-gray-700"
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// CollapsibleNotes: Accordion for remarks
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
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none resize-none"
            rows={3}
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  );
};



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
  const participantNameId = useId();
  const itemNameId = useId();
  const categoryId = useId();
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
    quantity: (isRideOffer ? (initialRowType === 'needs' ? 1 : 2) : 1),
    notes: '',
    isSplittable: (isRideOffer || defaultCat === 'ride_requests'),
    isRequired: false,
    phoneNumber: '',
    rowType: initialRowType || (defaultCat === 'ride_offers' || defaultCat === 'trempim' ? 'offers' : (defaultCat === 'ride_requests' ? 'needs' : undefined))
  });

  // Ride-specific state
  const [rideDirection, setRideDirection] = useState<'to_event' | 'from_event' | 'both'>('to_event');
  const [departureTimeTo, setDepartureTimeTo] = useState('');
  const [departureTimeFrom, setDepartureTimeFrom] = useState('');
  const [timeFlexibilityTo, setTimeFlexibilityTo] = useState<'exact' | '15min' | '30min' | '1hour' | 'flexible'>('15min');
  const [timeFlexibilityFrom, setTimeFlexibilityFrom] = useState<'exact' | '15min' | '30min' | '1hour' | 'flexible'>('15min');
  const [timeWarning, setTimeWarning] = useState<string | null>(null);

  useEffect(() => {
    if (rideDirection === 'both' && departureTimeTo && departureTimeFrom) {
      const [hTo, mTo] = departureTimeTo.split(':').map(Number);
      const [hFrom, mFrom] = departureTimeFrom.split(':').map(Number);
      const minTo = hTo * 60 + mTo;
      const minFrom = hFrom * 60 + mFrom;

      if (minFrom < minTo) {
        setTimeWarning('שים לב: שעת החזרה היא ביום למחרת 🌙');
      } else {
        setTimeWarning(null);
      }
    } else {
      setTimeWarning(null);
    }
  }, [departureTimeTo, departureTimeFrom, rideDirection]);



  const isRequest = formData.rowType === 'needs';
  const isRideCategory = formData.category === 'ride_offers' || formData.category === 'ride_requests' || formData.category === 'trempim';

  // For rides, don't allow self-assignment
  const effectiveMyQuantity = isRideCategory ? 0 : myQuantity;


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

  // Ensure "trempim" and ride options are filtered out for manual selection unless active
  const categoryOptions = React.useMemo(() => {
    let opts = eventCategories.map(cat => ({
      value: cat.id,
      // Aggressively clean specific emojis if present in DB data as requested
      label: cat.name.replace(/[📦🎯⚠️✅]/g, '').trim()
    }));

    // Filter out ride categories from the dropdown options unless it's the currently selected one
    // This hides them from the "Add Item" form for admins/users
    const rideIds = ['ride_offers', 'ride_requests', 'trempim'];
    opts = opts.filter(o => !rideIds.includes(o.value) || o.value === formData.category);

    // For backwards compatibility or explicit locking (if editing an existing ride item)
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

  // Validation Logic
  const getFieldError = (field: keyof FormErrors, value: any): string | undefined => {
    const isRide = formData.category === 'ride_offers' || formData.category === 'ride_requests' || formData.category === 'trempim';

    switch (field) {
      case 'name':
        if (!value || !value.toString().trim()) return t('userItemForm.errors.nameRequired');
        const minLen = isRide ? 3 : 2;
        if (value.toString().trim().length < minLen) {
          return isRide ? 'נא להזין מיקום ברור (לפחות 3 תווים)' : t('userItemForm.errors.nameLength');
        }
        break;

      case 'quantity':
        const num = Number(value);
        if (num < 1) return t('userItemForm.errors.quantityMin');
        if (isRide && num > 8) return 'מספר מקומות לא הגיוני (מקסימום 8)';
        if (!isRide && num > 100) return t('userItemForm.errors.quantityMax');
        break;

      case 'phoneNumber':
        if (isRide) {
          const raw = value?.toString().trim() || '';
          const clean = raw.replace(/\D/g, '').replace(/^972/, '0');
          if (!raw) return 'חובה להזין מספר טלפון';
          if (!/^05\d{8}$/.test(clean)) return 'מספר טלפון לא תקין (10 ספרות, קידומת 05)';
        }
        break;
    }
    return undefined;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Map input names to error keys if needed, assuming direct mapping
    const error = getFieldError(name as keyof FormErrors, value);

    setErrors(prev => {
      const next = { ...prev };
      if (error) next[name as keyof FormErrors] = error;
      else delete next[name as keyof FormErrors];
      return next;
    });
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const isRide = formData.category === 'ride_offers' || formData.category === 'ride_requests' || formData.category === 'trempim';

    // Validate all fields
    const nameErr = getFieldError('name', formData.name);
    if (nameErr) newErrors.name = nameErr;

    const qtyErr = getFieldError('quantity', formData.quantity);
    if (qtyErr) newErrors.quantity = qtyErr;

    if (isRide) {
      const phoneErr = getFieldError('phoneNumber', formData.phoneNumber);
      if (phoneErr) newErrors.phoneNumber = phoneErr;

      // Time Validation (Cross-field logic remains here)
      if ((rideDirection === 'to_event' || rideDirection === 'both') && !departureTimeTo) {
        toast.error('חובה להזין שעת יציאה להלוך');
        return false; // Blocking
      }
      if ((rideDirection === 'from_event' || rideDirection === 'both') && !departureTimeFrom) {
        toast.error('חובה להזין שעת יציאה לחזור');
        return false;
      }

      if (rideDirection === 'both' && departureTimeTo && departureTimeFrom) {
        const [hTo, mTo] = departureTimeTo.split(':').map(Number);
        const [hFrom, mFrom] = departureTimeFrom.split(':').map(Number);
        const minTo = hTo * 60 + mTo;
        const minFrom = hFrom * 60 + mFrom;

        if (minFrom === minTo) {
          toast.error('שעת החזרה זהה לשעת היציאה');
          return false;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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


      const isRide = ['ride_offers', 'ride_requests', 'trempim', 'rides'].includes(formData.category);
      const shouldBypassLimit = isOrganizer || isRide;

      const baseItemData = {
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

      if (!baseItemData.notes) delete (baseItemData as any).notes;
      if (!baseItemData.phoneNumber) delete (baseItemData as any).phoneNumber;

      // Handle ride items with directions
      if (isRide && rideDirection === 'both') {
        // Create two items - one for each direction

        // Item 1: To Event (הלוך)
        const itemDataTo: any = {
          ...baseItemData,
          name: `${formData.name.trim()} (הלוך)`,
          direction: 'to_event',
          departureTime: departureTimeTo,
          timeFlexibility: timeFlexibilityTo,
        };

        const itemIdTo = await FirebaseService.addMenuItem(event.id, itemDataTo, { bypassLimit: true });

        // Create assignment for "to" if needed
        if (itemIdTo && effectiveMyQuantity > 0) {
          await FirebaseService.createAssignment(event.id, {
            eventId: event.id,
            menuItemId: itemIdTo,
            userId: authUser.uid,
            userName: finalUserName,
            quantity: effectiveMyQuantity,
            status: 'confirmed' as const,
            assignedAt: Date.now(),
            notes: formData.notes
          });
        }

        // Item 2: From Event (חזור)
        const itemDataFrom: any = {
          ...baseItemData,
          name: `${formData.name.trim()} (חזור)`,
          direction: 'from_event',
          departureTime: departureTimeFrom,
          timeFlexibility: timeFlexibilityFrom,
        };

        const itemIdFrom = await FirebaseService.addMenuItem(event.id, itemDataFrom, { bypassLimit: true });

        // Create assignment for "from" if needed
        if (itemIdFrom && effectiveMyQuantity > 0) {
          await FirebaseService.createAssignment(event.id, {
            eventId: event.id,
            menuItemId: itemIdFrom,
            userId: authUser.uid,
            userName: finalUserName,
            quantity: effectiveMyQuantity,
            status: 'confirmed' as const,
            assignedAt: Date.now(),
            notes: formData.notes
          });
        }

        toast.success('הטרמפ נוסף בהצלחה (הלוך וחזור)');

      } else if (isRide) {
        // Single direction ride
        const itemData: any = {
          ...baseItemData,
          name: `${formData.name.trim()} (${rideDirection === 'to_event' ? 'הלוך' : 'חזור'})`,
          direction: rideDirection === 'from_event' ? 'from_event' : 'to_event',
          departureTime: rideDirection === 'to_event' ? departureTimeTo : departureTimeFrom,
          timeFlexibility: rideDirection === 'to_event' ? timeFlexibilityTo : timeFlexibilityFrom,
        };

        const itemId = await FirebaseService.addMenuItem(event.id, itemData, { bypassLimit: true });

        if (itemId && effectiveMyQuantity > 0) {
          await FirebaseService.createAssignment(event.id, {
            eventId: event.id,
            menuItemId: itemId,
            userId: authUser.uid,
            userName: finalUserName,
            quantity: effectiveMyQuantity,
            status: 'confirmed' as const,
            assignedAt: Date.now(),
            notes: formData.notes
          });
        }

        toast.success(t('userItemForm.errors.success'));

      } else {
        // Regular item (not a ride)
        const itemId = await FirebaseService.addMenuItem(event.id, baseItemData, { bypassLimit: shouldBypassLimit });

        if (itemId && effectiveMyQuantity > 0) {
          await FirebaseService.createAssignment(event.id, {
            eventId: event.id,
            menuItemId: itemId,
            userId: authUser.uid,
            userName: finalUserName,
            quantity: effectiveMyQuantity,
            status: 'confirmed' as const,
            assignedAt: Date.now(),
            notes: formData.notes
          });
        }

        toast.success(t('userItemForm.errors.success'));
      }

      onSuccess?.(formData.category);
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
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header - Teal Theme */}
            <div className="sticky top-0 z-10 bg-gradient-to-br from-teal-600 to-teal-700 text-white p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id={titleId} className="text-xl font-bold mb-1">
                    {isRequest ? 'בקש טרמפ' : (isOffersType ? 'הצע טרמפ' : t('userItemForm.title'))}
                  </h2>
                  <p className="text-sm text-teal-100">
                    {event.details.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  aria-label={t('common.close')}
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-2 transition-all disabled:opacity-50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* User Name Input - if needed */}
              {showNameInput && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <label htmlFor={participantNameId} className="block text-sm font-semibold text-gray-800 mb-2">
                    {isRequest ? '👤 שם הנוסע/ת' : (isOffersType ? '👤 שם הנהג/ת' : t('userItemForm.fields.fullName'))}
                  </label>

                  <input
                    id={participantNameId}
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder={t('userItemForm.fields.nameDisplayPlaceholder')}
                    autoComplete="name"
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all"
                    disabled={isSubmitting}
                    required
                  />

                  <p className="text-xs text-gray-600 mt-2">{t('userItemForm.fields.nameHelp')}</p>
                </div>
              )}

              {/* Category Selection - if not locked */}
              {!isLocked && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <label htmlFor={categoryId} className="block text-sm font-semibold text-gray-800 mb-2">
                    {t('userItemForm.fields.category')}
                  </label>
                  <select
                    id={categoryId}
                    value={formData.category}
                    onChange={(e) => handleInputChange('category', e.target.value as MenuCategory)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all bg-white"
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

              {/* SECTION 1: Route (Origin) - For Rides */}
              {(isOffersType || isRequest) && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span>מאיפה אתה יוצא?</span>
                  </h3>


                  <input
                    name="name"
                    onBlur={handleBlur}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error-ride" : undefined}
                    id={itemNameId}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={isRequest ? 'לדוגמה: ירושלים - תחנה מרכזית' : 'לדוגמה: תל אביב - רכבת ארלוזורוב'}
                    className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all ${errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                  />

                  {errors.name && (
                    <p id="name-error-ride" role="alert" className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.name}
                    </p>
                  )}



                  {/* Direction Toggle */}
                  <div className="mt-5">

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRideDirection('to_event')}
                        disabled={isSubmitting}
                        className={`py-3 px-3 text-sm font-semibold rounded-xl border-2 transition-all ${rideDirection === 'to_event'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md'
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
                          ? 'bg-teal-600 text-white border-teal-600 shadow-md'
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
                          ? 'bg-yellow-500 text-white border-yellow-500 shadow-md'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-yellow-50'
                          }`}
                      >
                        הלוך וחזור
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Regular Item Name - For non-rides */}
              {!isOffersType && !isRequest && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                  <label htmlFor={itemNameId} className="block text-sm font-semibold text-gray-800 mb-3">
                    {t('userItemForm.fields.name')}
                  </label>


                  <input
                    name="name"
                    onBlur={handleBlur}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "name-error-item" : undefined}
                    id={itemNameId}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={t('userItemForm.fields.namePlaceholder')}
                    className={`w-full px-3 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 transition-all ${errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                  />

                  {errors.name && (
                    <p id="name-error-item" role="alert" className="mt-2 text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.name}
                    </p>
                  )}
                </div>
              )}

              {/* SECTION 2: Times - For Rides */}
              {(isOffersType || isRequest) && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-5">


                  {/* Outbound Time */}
                  {(rideDirection === 'to_event' || rideDirection === 'both') && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        הלוך
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <TimeSelect
                          label="שעת יציאה"
                          value={departureTimeTo}
                          onChange={(e) => setDepartureTimeTo(e.target.value)}
                          disabled={isSubmitting}
                          required
                          referenceTime={event.details.time}
                          type="to"
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">גמישות</label>
                          <FlexibilitySelector
                            selected={timeFlexibilityTo}
                            onChange={(val) => setTimeFlexibilityTo(val as any)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Return Time */}
                  {(rideDirection === 'from_event' || rideDirection === 'both') && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        חזור
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <TimeSelect
                          label="שעת יציאה"
                          value={departureTimeFrom}
                          onChange={(e) => setDepartureTimeFrom(e.target.value)}
                          disabled={isSubmitting}
                          required
                          referenceTime={event.details.time}
                          type="from"
                        />
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">גמישות</label>
                          <FlexibilitySelector
                            selected={timeFlexibilityFrom}
                            onChange={(val) => setTimeFlexibilityFrom(val as any)}
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                      {timeWarning && (
                        <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded-lg mt-2 flex items-center gap-2 border border-orange-200">
                          <AlertCircle className="h-4 w-4" />
                          {timeWarning}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: Details (Phone, Seats, Notes) - For Rides */}
              {(isOffersType || isRequest) && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm space-y-4">


                  {/* Phone Number */}
                  <div>
                    <label htmlFor="phoneNumber" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      <Phone className="h-4 w-4 text-teal-600" />
                      מספר טלפון
                      <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        id="phoneNumber"
                        name="phoneNumber"
                        onBlur={handleBlur}
                        aria-invalid={!!errors.phoneNumber}
                        aria-describedby={errors.phoneNumber ? "phone-error" : undefined}
                        type="tel"
                        inputMode="numeric"
                        value={formData.phoneNumber || ''}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        placeholder="050-0000000"
                        className={`w-full pr-11 pl-3 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all ${errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
                          } ltr text-right`}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    {errors.phoneNumber && (
                      <p id="phone-error" role="alert" className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.phoneNumber}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">יוצג רק למי שישובץ לנסיעה</p>
                  </div>

                  {/* Number of Seats */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {isRequest ? 'כמה מקומות אתם צריכים?' : 'מספר מקומות פנויים'}
                    </label>
                    <Stepper
                      value={formData.quantity}
                      onChange={(val) => handleInputChange('quantity', val)}
                      label=""
                    />

                  </div>

                  {/* Collapsible Notes */}
                  <CollapsibleNotes
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    disabled={isSubmitting}
                    placeholder={isRequest
                      ? 'לדוגמה: מחכה ליד בית הכנסת הגדול...'
                      : 'לדוגמה: אין מקום למזוודות גדולות, רק תיקי גב...'}
                  />
                </div>
              )}

              {/* Quantity Section - For regular items */}
              {!isOffersType && !isRequest && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-gray-800 mb-4">
                    כמויות
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Total Needed */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {t('userItemForm.fields.quantityTotal')}
                      </label>
                      <Stepper
                        value={formData.quantity}
                        onChange={(val) => {
                          handleInputChange('quantity', val);
                          const newMyQty = myQuantity > val ? val : myQuantity;
                          if (myQuantity > val) setMyQuantity(val);
                          if (val > newMyQty) handleInputChange('isSplittable', true);
                        }}
                        label={t('userItemForm.fields.quantityTotal')}
                      />
                    </div>

                    {/* My Contribution */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          {t('userItemForm.fields.myContribution')}
                        </label>
                        {myQuantity < formData.quantity && (
                          <button
                            type="button"
                            onClick={() => setMyQuantity(formData.quantity)}
                            aria-label={t('userItemForm.fields.bringAll')}
                            className="text-xs text-teal-600 hover:text-teal-700 font-bold underline"
                          >
                            {t('userItemForm.fields.bringAll')}
                          </button>
                        )}
                      </div>
                      <Stepper
                        value={myQuantity}
                        onChange={setMyQuantity}
                        max={formData.quantity}
                        min={0}
                        label={t('userItemForm.fields.myContribution')}
                      />
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-gray-600 bg-gray-50 rounded-lg py-2 px-3">
                      {myQuantity < formData.quantity
                        ? myQuantity === 0
                          ? "אתה רק יוצר את הפריט (מנהל)"
                          : t('userItemForm.fields.remainingMsg', { count: formData.quantity - myQuantity })
                        : t('userItemForm.fields.youBringAllMsg')}
                    </p>
                  </div>
                </div>
              )}

              {/* Notes for regular items */}
              {!isOffersType && !isRequest && (
                <div className="bg-white border-2 border-gray-200 rounded-xl p-5 shadow-sm">
                  <CollapsibleNotes
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    disabled={isSubmitting}
                    placeholder={t('userItemForm.fields.notesPlaceholder')}
                  />
                </div>
              )}

              {/* Admin: Is Required Checkbox */}
              {isOrganizer && !isOffersType && !isRequest && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                  <input
                    id={isRequiredId}
                    type="checkbox"
                    checked={formData.isRequired}
                    onChange={(e) => handleInputChange('isRequired', e.target.checked)}
                    className="h-5 w-5 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <label htmlFor={isRequiredId} className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    {t('userItemForm.fields.isRequired')}
                  </label>
                </div>
              )}

              {/* Action Buttons - Teal Theme */}
              <div className="sticky bottom-0 -mx-6 -mb-6 p-6 bg-white border-t-2 border-gray-100 rounded-b-2xl flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:from-gray-300 disabled:to-gray-400 text-white py-4 px-6 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center active:scale-[0.98]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent ml-2"></div>
                      <span>{t('userItemForm.submitting')}</span>
                    </>
                  ) : (
                    <>

                      <span>
                        {isRequest
                          ? 'בקש טרמפ'
                          : isOffersType
                            ? 'הצע טרמפ'
                            : effectiveMyQuantity === 0
                              ? 'הוסף פריט'
                              : 'הוסף ושבץ אותי'}
                      </span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div >
      </FocusTrap >
    </div >
  );
}
