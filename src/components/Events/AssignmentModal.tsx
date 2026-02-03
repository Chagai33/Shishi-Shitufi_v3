
import React, { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, selectAssignments } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, Assignment } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { X, MessageSquare, User as UserIcon, Plus, Minus, Edit } from 'lucide-react';
import FocusTrap from 'focus-trap-react';
import { isCarpoolLogic } from '../../utils/eventUtils';

interface AssignmentModalProps {
  item: MenuItem;
  eventId: string;
  user: FirebaseUser;
  onClose: () => void;
  isEdit?: boolean;
  isAddMore?: boolean;
  existingAssignment?: Assignment;
  itemRowType?: 'needs' | 'offers';
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  item,
  eventId,
  user,
  onClose,
  isEdit = false,
  isAddMore = false,
  existingAssignment,
  itemRowType = 'needs'
}) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
  const [notes, setNotes] = useState(existingAssignment?.notes || '');
  const [phoneNumber, setPhoneNumber] = useState(existingAssignment?.phoneNumber || ''); // NEW
  const [isLoading, setIsLoading] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');

  const [tempUserName, setTempUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  // Carpool / Smart Category Logic
  const isOffers = isCarpoolLogic(item.name, item.category, itemRowType);

  // Accessibility
  const titleId = useId();

  const assignments = useStore(selectAssignments);

  // Calculate max quantity (logic from EventPage)
  const maxQuantity = useMemo(() => {
    const effectivelySplittable = item.isSplittable || item.quantity > 1;
    if (!effectivelySplittable) return 1;

    const itemAssignments = assignments.filter(a => a.menuItemId === item.id && a.eventId === eventId);
    const currentTotal = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);

    let available = item.quantity - currentTotal;

    if (isEdit && existingAssignment && !isAddMore) {
      available += existingAssignment.quantity;
    }

    return Math.max(0, available);
  }, [item, assignments, eventId, isEdit, existingAssignment, isAddMore]);

  // Initial Quantity Logic
  useEffect(() => {
    const effectivelySplittable = item.quantity > 1 || item.isSplittable;

    if (!effectivelySplittable) {
      setQuantity(1);
    } else if (isAddMore) {
      setQuantity(Math.min(1, maxQuantity));
    } else if (!existingAssignment) {
      setQuantity(Math.min(1, maxQuantity));
    }
  }, [item.isSplittable, item.quantity, maxQuantity, existingAssignment, isAddMore]);

  // User Name Logic
  useEffect(() => {
    const currentEvent = useStore.getState().currentEvent;
    const existingParticipant = currentEvent?.participants?.[user.uid];

    if (existingParticipant) {
      setCurrentUserName(existingParticipant.name);
      setTempUserName(existingParticipant.name);
      setShowNameInput(false);
    } else if (user.isAnonymous) {
      setShowNameInput(true);
      setIsEditingName(true);
    } else {
      setCurrentUserName(user.displayName || t('common.user'));
      setTempUserName(user.displayName || t('common.user'));
      setShowNameInput(false);
    }
  }, [user.uid, user.isAnonymous, t]);

  const handleSubmit = async () => {
    let finalUserName = tempUserName.trim();

    if (isEditingName && !finalUserName) {
      toast.error(t('eventPage.assignment.nameRequired'));
      return;
    }
    if (quantity <= 0) { toast.error(t('eventPage.assignment.quantityPositive')); return; }
    if ((item.isSplittable || item.quantity > 1) && quantity > maxQuantity) {
      toast.error(t('eventPage.assignment.quantityExceedsAvailable', { maxQuantity }));
      return;
    }

    setIsLoading(true);
    try {
      if (isEditingName || showNameInput) {
        await FirebaseService.joinEvent(eventId, user.uid, finalUserName);
      }

      const assignmentData: any = {
        quantity,
        notes: notes.trim(),
        userName: finalUserName,
      };

      if (phoneNumber.trim()) {
        assignmentData.phoneNumber = phoneNumber.trim();
      }

      if (isEdit && existingAssignment) {
        let finalQuantity = quantity;

        if (isAddMore) {
          finalQuantity = existingAssignment.quantity + quantity;
        }

        assignmentData.quantity = finalQuantity;

        await FirebaseService.updateAssignment(eventId, existingAssignment.id, assignmentData);
        toast.success(isAddMore ? t('eventPage.assignment.addMoreSuccess') : (isOffers ? 'הנסיעה עודכנה בהצלחה!' : t('eventPage.assignment.updateSuccess')));
      } else {
        const newAssignment: any = {
          menuItemId: item.id,
          userId: user.uid,
          userName: finalUserName,
          quantity,
          notes: notes.trim(),
          status: 'confirmed',
          assignedAt: Date.now(),
          eventId
        };

        if (phoneNumber.trim()) {
          newAssignment.phoneNumber = phoneNumber.trim();
        }

        await FirebaseService.createAssignment(eventId, newAssignment);
        toast.success(isOffers ? 'הצטרפת לנסיעה בהצלחה!' : t('eventPage.assignment.assignSuccess', { itemName: item.name }));
      }
      onClose();
    } catch (error: any) { toast.error(error.message || t('common.errorOccurred')); }
    finally { setIsLoading(false); }
  };

  const handleIncrement = () => setQuantity(q => {
    const max = (item.isSplittable || item.quantity > 1) ? maxQuantity : item.quantity;
    return Math.min(q + 1, max);
  });
  const handleDecrement = () => setQuantity(q => Math.max(1, q - 1));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <FocusTrap>
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full" role="dialog" aria-labelledby={titleId}>
          <div className="flex items-center justify-between p-6 border-b">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-900">
              {isAddMore
                ? (isOffers ? 'הוספת נווסעים' : t('eventPage.assignment.addMoreTitle'))
                : isEdit
                  ? (isOffers ? 'עדכון נסיעה' : t('eventPage.assignment.editTitle'))
                  : (isOffers ? 'הצטרפות לנסיעה' : t('eventPage.assignment.addTitle'))}
            </h2>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700"><X size={24} /></button>
          </div>

          <div className="p-6">
            <div className="bg-accent/10 p-4 rounded-lg mb-6 text-center">
              <p className="font-bold text-accent">{item.name}</p>
              <p className="text-sm text-accent/80">
                {isOffers ? 'מקומות:' : t('eventPage.assignment.suggestedQuantity')}: {item.quantity}
              </p>
            </div>

            <div className="space-y-4">
              {/* Name Editing Section */}
              {currentUserName && !showNameInput && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {t('eventPage.assignment.registerAs')} <span className="text-blue-600 font-bold">{tempUserName}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(!isEditingName)}
                      className="text-xs text-orange-600 hover:text-orange-700 underline flex items-center"
                    >
                      <Edit size={12} className="ml-1" />
                      {t('eventPage.assignment.changeName')}
                    </button>
                  </div>

                  {isEditingName && (
                    <div className="mb-3 animate-fadeIn">
                      <label className="block text-xs font-medium text-gray-600 mb-1">{user.uid.startsWith('guest_') ? t('eventPage.assignment.fullName') : t('eventPage.assignment.newName')}</label>
                      <input
                        type="text"
                        value={tempUserName}
                        onChange={(e) => setTempUserName(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder={t('eventPage.assignment.namePlaceholder')}
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {showNameInput && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('eventPage.assignment.fullName')}
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="text"
                      value={participantName}
                      onChange={e => setParticipantName(e.target.value)}
                      placeholder={t('eventPage.assignment.namePlaceholder')}
                      className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500"
                    />
                  </div>
                </div>
              )}

              {/* Stepper UI for Quantity */}
              <div>
                <div className="flex justify-between mb-2 items-center">
                  <label className="block text-sm font-medium text-neutral-700">
                    {isAddMore
                      ? (isOffers ? 'מספר מקומות להוספה' : t('eventPage.assignment.quantityToAdd'))
                      : (isOffers ? 'כמה מקומות לשריין?' : t('eventPage.assignment.quantityToBring'))}
                  </label>
                  <div className="flex gap-2 items-center">
                    {(item.isSplittable || item.quantity > 1) && quantity < maxQuantity && (
                      <button
                        type="button"
                        onClick={() => setQuantity(maxQuantity)}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium underline"
                      >
                        {isOffers ? 'שריין הכל' : t('eventPage.assignment.bringAll')}
                      </button>
                    )}
                    {(item.isSplittable || item.quantity > 1) && (
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {isOffers ? 'מקומות פנויים' : t('eventPage.assignment.remaining')}: {maxQuantity}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden h-12">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="w-16 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-accent transition-colors border-l border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Minus size={20} />
                  </button>

                  <div className="flex-1 flex items-center justify-center h-full bg-white font-bold text-xl text-neutral-800">
                    {quantity}
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= ((item.isSplittable || item.quantity > 1) ? maxQuantity : item.quantity)}
                    className="w-16 h-full flex items-center justify-center bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-accent transition-colors border-r border-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              {/* Phone Number - Only for Rides */}
              {isOffers && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    מספר טלפון (ליצירת קשר עם הנהג)
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="050-0000000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-right sm:text-left dir-ltr"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">המספר יוצג לנהג בלבד לתיאום הנסיעה</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">{t('eventPage.assignment.notesOptional')}</label>
                <div className="relative">
                  <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-neutral-400" />
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full p-2.5 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 shadow-sm placeholder-gray-500"
                    rows={3}
                    placeholder={isOffers ? "לדוגמה: מחכה בתחנה..." : t('eventPage.assignment.notesPlaceholder')}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-800 hover:bg-neutral-300 font-medium">{t('common.cancel')}</button>
            <button onClick={handleSubmit} disabled={isLoading} className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:bg-neutral-300">
              {isLoading
                ? t('common.saving')
                : isAddMore
                  ? t('eventPage.assignment.add')
                  : isEdit
                    ? t('common.saveChanges')
                    : (isOffers ? 'אשר הצטרפות' : t('eventPage.assignment.confirmAssignment'))}
            </button>
          </div>
        </div >
      </FocusTrap>
    </div >
  );
};

export default AssignmentModal;