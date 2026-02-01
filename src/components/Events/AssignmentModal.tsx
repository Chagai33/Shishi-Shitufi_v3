// src/components/Events/AssignmentModal.tsx

import React, { useState, useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';
import { useStore, selectAssignments } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, Assignment } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { X, Hash, MessageSquare, User as UserIcon } from 'lucide-react';

interface AssignmentModalProps {
  item: MenuItem;
  organizerId: string;
  eventId: string;
  user: FirebaseUser;
  onClose: () => void;
  isEdit?: boolean;
  isAddMore?: boolean;
  existingAssignment?: Assignment;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  item,
  organizerId,
  eventId,
  user,
  onClose,
  isEdit = false,
  isAddMore = false,
  existingAssignment,
}) => {
  const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
  const [notes, setNotes] = useState(existingAssignment?.notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Accessibility: Unique ID for ARIA labeling
  const titleId = useId();

  // Accessibility: Store reference to the element that opened the modal
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Calculate max quantity for splittable items
  const assignments = useStore(selectAssignments);

  const maxQuantity = React.useMemo(() => {
    if (!item.isSplittable) return 1;

    const itemAssignments = assignments.filter(a => a.menuItemId === item.id && a.eventId === eventId);
    const currentTotal = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);

    let available = item.quantity - currentTotal;

    // If we are editing, we can reuse our own quantity, unless it's Add More mode
    if (isEdit && existingAssignment && !isAddMore) {
      available += existingAssignment.quantity;
    }

    return Math.max(0, available);
  }, [item, assignments, eventId, isEdit, existingAssignment, isAddMore]);

  useEffect(() => {
    // If not splittable, always 1. If splittable, default to 1 but check max.
    if (!item.isSplittable) {
      setQuantity(1);
    } else if (isAddMore) {
      setQuantity(Math.min(1, maxQuantity));
    } else if (!existingAssignment) {
      // New assignment: default to 1, but if only 0 available (shouldn't happen if button enabled), 0.
      setQuantity(Math.min(1, maxQuantity));
    }
  }, [item.isSplittable, maxQuantity, existingAssignment, isAddMore]);

  // Check if user is already registered as event participant
  useEffect(() => {
    const participants = useStore.getState().currentEvent?.participants || {};
    const isParticipant = !!participants[user.uid];

    // Show name field only if it's an anonymous user who hasn't joined yet
    if (user.isAnonymous && !isParticipant) {
      setShowNameInput(true);
    }
  }, [user.uid, user.isAnonymous]);

  // Accessibility: Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isLoading]);

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

  const handleSubmit = async () => {
    // Validation
    if (showNameInput && !participantName.trim()) {
      toast.error("כדי להשתבץ, יש להזין שם מלא.");
      return;
    }
    if (quantity <= 0) {
      toast.error("הכמות חייבת להיות גדולה מ-0.");
      return;
    }
    if (item.isSplittable && quantity > maxQuantity) {
      toast.error(`הכמות המבוקשת גדולה מהכמות הפנויה (מקסימום ${maxQuantity}).`);
      return;
    }

    setIsLoading(true);

    try {
      let finalUserName = participantName.trim();

      // If user entered a name, register them as event participant
      if (showNameInput && finalUserName) {
        await FirebaseService.joinEvent(eventId, user.uid, finalUserName);
      } else {
        // If they're already a participant, take their existing name
        const existingParticipant = useStore.getState().currentEvent?.participants[user.uid];
        finalUserName = existingParticipant?.name || user.displayName || 'אורח';
      }

      if (isEdit && existingAssignment) {
        // --- Edit logic ---
        let finalQuantity = quantity;
        const finalNotes = notes.trim();

        if (isAddMore) {
          finalQuantity = existingAssignment.quantity + quantity;
        }

        await FirebaseService.updateAssignment(eventId, existingAssignment.id, {
          quantity: finalQuantity,
          notes: finalNotes,
        });
        toast.success(isAddMore ? "התוספת עודכנה בהצלחה!" : "השיבוץ עודכן בהצלחה!");
      } else {
        // --- Create new assignment logic ---
        const assignmentData: Omit<Assignment, 'id'> = {
          menuItemId: item.id,
          userId: user.uid,
          userName: finalUserName,
          quantity,
          notes: notes.trim(),
          status: 'confirmed',
          assignedAt: Date.now(),
          eventId: eventId // Added eventId
        };
        await FirebaseService.createAssignment(eventId, assignmentData);
        toast.success(`שובצת בהצלחה לפריט: ${item.name}`);
      }
      onClose();
    } catch (error: any) {
      console.error("Error in assignment modal:", error);
      toast.error(error.message || "אירעה שגיאה.");
    } finally {
      setIsLoading(false);
    }
  };

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
          <div className="flex items-center justify-between p-6 border-b border-neutral-200">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
              {isAddMore ? 'הוספת פריטים לשיבוץ קיים' : isEdit ? 'עריכת שיבוץ' : 'שיבוץ פריט'}
            </h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              aria-label="סגור חלון"
              type="button"
              className="text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50"
            >
              <X size={24} aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <div className="bg-accent/10 p-4 rounded-lg mb-6 text-center">
              <p className="font-bold text-accent">{item.name}</p>
              <p className="text-sm text-accent/80">כמות מוצעת: {item.quantity}</p>
            </div>

            <div className="space-y-4">
              {showNameInput && (
                <div>
                  <label htmlFor="participant-name" className="block text-sm font-medium text-neutral-700 mb-2">
                    שם מלא<span className="text-red-500" aria-label="שדה חובה">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                    <input
                      id="participant-name"
                      type="text"
                      value={participantName}
                      onChange={e => setParticipantName(e.target.value)}
                      placeholder="השם שיוצג לכולם"
                      required
                      aria-required="true"
                      autoComplete="name"
                      className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">השם יישמר למכשיר זה עבור אירוע זה.</p>
                </div>
              )}
              <div>
                <div className="flex justify-between mb-2">
                  <label htmlFor="quantity-input" className="block text-sm font-medium text-neutral-700">
                    {isAddMore ? 'כמות להוסיף' : 'כמות שאביא'}<span className="text-red-500" aria-label="שדה חובה">*</span>
                  </label>
                  {item.isSplittable && (
                    <span
                      className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full"
                      aria-live="polite"
                    >
                      נותרו: {maxQuantity}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" aria-hidden="true" />
                  <input
                    id="quantity-input"
                    type="number"
                    value={quantity}
                    onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                    min="1"
                    max={item.isSplittable ? maxQuantity : undefined}
                    required
                    aria-required="true"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="notes-input" className="block text-sm font-medium text-neutral-700 mb-2">
                  הערות (אופציונלי)
                </label>
                <div className="relative">
                  <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-neutral-400" aria-hidden="true" />
                  <textarea
                    id="notes-input"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent"
                    rows={3}
                    placeholder="לדוגמה: ללא גלוטן, טבעוני…"
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-neutral-100 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-700 hover:bg-neutral-300 font-medium transition-colors"
            >
              ביטול
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              type="button"
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:bg-neutral-300 font-medium transition-colors"
            >
              {isLoading ? 'מעדכן…' : isAddMore ? 'הוסף' : isEdit ? 'שמור שינויים' : 'אשר שיבוץ'}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

export default AssignmentModal;