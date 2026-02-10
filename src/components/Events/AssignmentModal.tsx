
import React, { useState, useEffect, useMemo, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, selectAssignments, selectMenuItems } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, Assignment } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { X, MessageSquare, User as UserIcon, Plus, Minus, Edit, AlertCircle } from 'lucide-react';
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
  itemRowType
}) => {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
  const [notes, setNotes] = useState(existingAssignment?.notes || '');
  const [phoneNumber, setPhoneNumber] = useState(existingAssignment?.phoneNumber || '');
  // Carpool / Smart Category Logic
  const isOffers = isCarpoolLogic(item.name, item.category, itemRowType);
  const isRequest = itemRowType === 'needs' || item.category === 'ride_requests';

  const [isLoading, setIsLoading] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('');

  const [tempUserName, setTempUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);


  // ============================================================================
  // ROUND TRIP LOGIC (Twin Detection)
  // ============================================================================
  const allMenuItems = useStore(selectMenuItems);
  const allAssignments = useStore(selectAssignments);

  const twinItem = useMemo(() => {
    // 1. Must be a "Ride"
    if (!isOffers || !item.direction || (item.direction as string) === 'both') return null;

    // 2. Determine Opposite Direction
    const oppositeDir = item.direction === 'to_event' ? 'from_event' : 'to_event';

    // 3. Find Twin
    const twin = allMenuItems.find(i =>
      i.id !== item.id &&
      i.creatorId === item.creatorId &&
      i.eventId === eventId &&
      i.direction === oppositeDir &&
      (i.category === 'ride_offers' || i.category === 'ride_requests' || i.category === 'trempim')
    );

    if (!twin) return null;

    // 4. Time Validation (Don't offer past rides)
    // Simple check: if ride has a time, and it's clearly passed (e.g. yesterday), ignore.
    // Since we don't have full dates, we assume event context. 
    // TODO: Ideally stick to future logic. For now, we trust the event list is current.
    // If we wanted to be strict: 
    // const now = new Date();
    // if (isPast(twin.departureTime)) return null; 

    // 5. Availability Check
    const twinAssignments = allAssignments.filter(a => a.menuItemId === twin.id);
    const twinTotal = twinAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
    const twinAvailable = twin.quantity - twinTotal;

    // Check if I am already on it
    const amIAssigned = user ? twinAssignments.some(a => a.userId === user.uid) : false;

    // If I'm not assigned and it's full -> Hide
    // If I AM assigned -> Show (so I can edit/update)
    if (twinAvailable < 1 && !amIAssigned) return null;

    return { item: twin, available: twinAvailable }; // available might be 0 or neg, but we handle it in submit
  }, [item, allMenuItems, allAssignments, isOffers, eventId, user]);

  // Check if I ALREADY have an assignment on the twin item (For Edit Mode)
  const myTwinAssignment = useMemo(() => {
    if (!twinItem || !user) return null;
    return allAssignments.find(a => a.menuItemId === twinItem.item.id && a.userId === user.uid);
  }, [twinItem, user, allAssignments]);

  // State for joining the twin ride
  const [joinTwinRide, setJoinTwinRide] = useState(false);

  // Auto-select if available (User can opt-out)
  useEffect(() => {
    if (twinItem) {
      if (!isEdit) {
        setJoinTwinRide(true); // Default for new join
      } else if (myTwinAssignment) {
        setJoinTwinRide(true); // Default for edit (sync update)
      }
    }
  }, [twinItem, isEdit, myTwinAssignment]);

  // Calculate effective availability for Twin Ride (including my own seats if I'm editing)
  const maxTwinCapacity = useMemo(() => {
    if (!twinItem) return 0;
    let capacity = twinItem.available;
    if (myTwinAssignment) {
      capacity += myTwinAssignment.quantity; // Add back my seats effectively
    }
    return Math.max(0, capacity);
  }, [twinItem, myTwinAssignment]);

  const isTwinCapacityIssue = quantity > maxTwinCapacity;

  // Auto-disable if capacity issue
  // Auto-disable removed to allow user to toggle and see error interactively
  // useEffect(() => {
  //   if (isTwinCapacityIssue && joinTwinRide) {
  //     setJoinTwinRide(false);
  //   }
  // }, [isTwinCapacityIssue, joinTwinRide]);

  // ============================================================================

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

  // Phone Auto-Fill Logic
  useEffect(() => {
    if (isOffers && !phoneNumber && !isEdit) {
      // Priority 1: User Profile (Registered)
      // Note: We don't have user.phoneNumber in the Auth object by default unless we use Phone Auth provider.
      // We rely on our DB user profile if fetched - BUT 'user' prop is FirebaseUser (Auth).
      // So for now, we rely on LocalStorage as the "Device Memory" which is perfect for this requirement.

      const savedPhone = localStorage.getItem('user_last_phone');
      if (savedPhone) {
        setPhoneNumber(savedPhone);
      }
    }
  }, [isOffers, isEdit, phoneNumber]); // Run once when "Offers" mode is active

  const handleSubmit = async () => {
    let finalUserName = tempUserName.trim();

    if (isEditingName && !finalUserName) {
      toast.error(t('eventPage.assignment.nameRequired'));
      return;
    }

    if (isOffers && !phoneNumber.trim()) {
      toast.error('חובה להזין מספר טלפון לתיאום הנסיעה');
      return;
    }

    // SAVE PHONE TO STORAGE (Convenience)
    if (isOffers && phoneNumber.trim()) {
      try {
        localStorage.setItem('user_last_phone', phoneNumber.trim());

        // If registered, sync to DB (nice to have)
        // We can't easily access the DB user record here without a fetch, 
        // but we can fire-and-forget an update if they are not anonymous
        if (!user.isAnonymous) {
          FirebaseService.updateUser(user.uid, { phoneNumber: phoneNumber.trim() } as any);
        }
      } catch (e) { /* ignore storage errors */ }
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

        // SMART UPDATE (Sync Edit)
        if (joinTwinRide && myTwinAssignment && twinItem) {
          // Check capacity first
          // available = (total - used) + my_current_holding
          // We want to update my_current_holding to 'quantity'
          // So: if (available_without_me < quantity) fail

          const twinUsed = allAssignments
            .filter(a => a.menuItemId === twinItem.item.id && a.id !== myTwinAssignment.id)
            .reduce((sum, a) => sum + (a.quantity || 0), 0);

          const twinRealAvailable = twinItem.item.quantity - twinUsed;

          if (quantity <= twinRealAvailable) {
            try {
              const twinUpdateData = { ...assignmentData }; // Clone same data
              await FirebaseService.updateAssignment(eventId, myTwinAssignment.id, twinUpdateData);
              toast.success('עודכנו שתי הנסיעות בהצלחה!');
              onClose();
              setIsLoading(false);
              return; // Early return to avoid double toast
            } catch (err) {
              console.error("Failed to sync update twin", err);
              toast.error("הנסיעה הראשונה עודכנה, אך הייתה שגיאה בעדכון הנסיעה השנייה.");
            }
          } else {
            toast.error(`לא ניתן לעדכן את הנסיעה השנייה - אין מספיק מקום (${twinRealAvailable} פנויים)`);
            // We continue to show success for the first one below, but user is warned.
          }
        }

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

        // 1. Create Primary Assignment
        await FirebaseService.createAssignment(eventId, newAssignment);

        // 2. Handle Twin Assignment (Round Trip)
        if (joinTwinRide && twinItem) {
          // Re-check capacity for Twin
          const twinAssignments = allAssignments.filter(a => a.menuItemId === twinItem.item.id);
          const twinUsed = twinAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
          const twinRealAvailable = twinItem.item.quantity - twinUsed;

          if (quantity <= twinRealAvailable) {
            try {
              const twinAssignment = {
                ...newAssignment,
                menuItemId: twinItem.item.id,
                notes: `Round Trip Link: ${notes.trim()}`,
              };
              await FirebaseService.createAssignment(eventId, twinAssignment);
              toast.success(`נרשמת בהצלחה להלוך ולחזור! (${twinItem.item.departureTime || '?'})`);
            } catch (err) {
              console.error("Failed to join twin ride", err);
              toast.error("נרשמת לנסיעה הראשונה, אך הייתה שגיאה ברישום לנסיעה הפוכה.");
            }
          } else {
            // Partial Success (Capacity Mismatch)
            toast('נרשמת להלוך בלבד. הסיבה: אין מספיק מקום בחזור.', {
              icon: '⚠️',
              duration: 5000,
            });
          }
        } else {
          toast.success(isOffers ? 'הצטרפת לנסיעה בהצלחה!' : t('eventPage.assignment.assignSuccess', { itemName: item.name }));
        }
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
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full flex flex-col max-h-[90vh]" role="dialog" aria-labelledby={titleId}>
          {/* Dynamic Theme Header */}
          <div className={`flex items-center justify-between p-6 border-b flex-none rounded-t-xl text-white ${isOffers ? 'bg-rides-dark' : 'bg-accent-dark'}`}>
            <h2 id={titleId} className="text-lg font-bold">
              {isAddMore
                ? (isOffers ? t('eventPage.assignment.addPassengersTitle') : t('eventPage.assignment.addMoreTitle'))
                : isEdit
                  ? (isOffers ? t('eventPage.assignment.updateRideTitle') : t('eventPage.assignment.editTitle'))
                  : (isRequest
                    ? t('eventPage.assignment.iWillDriver')
                    : (isOffers ? t('eventPage.assignment.joinRideTitle') : t('eventPage.assignment.addTitle')))}
            </h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 flex-1 overflow-y-auto">
            <div className={`p-4 rounded-lg mb-6 text-center border ${isOffers ? 'bg-teal-50 border-teal-100 text-teal-800' : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
              <p className="font-bold">{item.name}</p>
              <p className="text-sm opacity-80">
                {isOffers ? t('eventPage.assignment.seats') : t('eventPage.assignment.suggestedQuantity')}: {item.quantity}
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
                      className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center"
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
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    {isRequest ? t('eventPage.assignment.driverName') : t('eventPage.assignment.fullName')}
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
                      ? (isOffers ? t('eventPage.assignment.seatsToAdd') : t('eventPage.assignment.quantityToAdd'))
                      : (isRequest
                        ? t('eventPage.assignment.seatsRequested')
                        : (isOffers ? t('eventPage.assignment.howManySeats') : t('eventPage.assignment.quantityToBring')))}
                  </label>
                  <div className="flex gap-2 items-center">
                    {(item.isSplittable || item.quantity > 1) && quantity < maxQuantity && (
                      <button
                        type="button"
                        onClick={() => setQuantity(maxQuantity)}
                        className={`text-xs font-medium underline ${isOffers ? 'text-teal-600 hover:text-teal-700' : 'text-orange-600 hover:text-orange-700'}`}
                      >
                        {isOffers ? 'שריין הכל' : t('eventPage.assignment.bringAll')}
                      </button>
                    )}
                    {(item.isSplittable || item.quantity > 1) && (
                      <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {isRequest ? t('eventPage.assignment.seatsRequested') : (isOffers ? 'מקומות פנויים' : t('eventPage.assignment.remaining'))}: {maxQuantity}
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

              {/* ROUND TRIP SMART CARD */}
              {isOffers && twinItem && (!isEdit || myTwinAssignment) && !isAddMore && (
                <div
                  className={`mt-4 border-2 rounded-xl p-3 transition-all cursor-pointer ${(isTwinCapacityIssue && joinTwinRide)
                    ? 'border-red-300 bg-red-50'
                    : (joinTwinRide ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-200')
                    }`}
                  onClick={() => setJoinTwinRide(!joinTwinRide)}>

                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${(isTwinCapacityIssue && joinTwinRide)
                      ? 'bg-white border-red-300'
                      : (joinTwinRide ? 'bg-teal-500 border-teal-500' : 'border-gray-300 bg-white')
                      }`}>
                      {joinTwinRide && !isTwinCapacityIssue && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      {joinTwinRide && isTwinCapacityIssue && <X className="w-3.5 h-3.5 text-red-500" />}
                    </div>

                    <div className="flex-1">
                      <h4 className={`font-bold text-sm ${isTwinCapacityIssue && joinTwinRide ? 'text-red-800' : 'text-gray-900'}`}>
                        {isEdit
                          ? (twinItem.item.direction === 'to_event' ? 'לעדכן גם את ההלוך?' : 'לעדכן גם את החזור?')
                          : (twinItem.item.direction === 'to_event' ? 'הצטרף גם לנסיעה הלוך?' : 'הצטרף גם לנסיעה חזור?')}
                      </h4>

                      {isTwinCapacityIssue && joinTwinRide ? (
                        <div className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1 animate-fadeIn">
                          <AlertCircle size={12} />
                          אין מספיק מקום בנסיעה זו (נותרו {maxTwinCapacity})
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                          <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-medium">
                            {twinItem.item.direction === 'to_event' ? 'הלוך' : 'חזור'}
                          </span>
                          {twinItem.item.departureTime && (
                            <span className="font-semibold">{twinItem.item.departureTime}</span>
                          )}
                          <span>•</span>
                          <span>נותרו {maxTwinCapacity} מקומות</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Phone Number - Only for Rides */}
              {isOffers && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {isRequest ? t('eventPage.assignment.driverPhone') : t('eventPage.assignment.phoneLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="050-0000000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rides focus:border-transparent text-right sm:text-left dir-ltr"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t('eventPage.assignment.phoneHelp')}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {isRequest ? t('eventPage.assignment.carDetails') : t('eventPage.assignment.notesOptional')}
                </label>
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

          <div className="bg-neutral-50 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl flex-none border-t">
            <button onClick={onClose} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold transition-colors disabled:opacity-50">{t('common.cancel')}</button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className={`px-6 py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none ${isOffers ? 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800' : 'bg-accent-dark hover:bg-accent-dark/90'}`}
            >
              {isLoading
                ? t('common.saving')
                : isAddMore
                  ? t('eventPage.assignment.add')
                  : isEdit
                    ? t('common.saveChanges')
                    : (isOffers
                      ? (joinTwinRide
                        ? (isEdit ? t('eventPage.assignment.updateBothRides') : t('eventPage.assignment.joinBothRides', { quantity }))
                        : (isEdit ? t('common.saveChanges') : (isRequest ? t('eventPage.assignment.confirmDrive') : t('eventPage.assignment.confirmJoin'))))
                      : t('eventPage.assignment.confirmAssignment'))}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

export default AssignmentModal;