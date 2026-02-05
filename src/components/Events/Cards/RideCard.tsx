import React, { useMemo } from 'react';
import { MenuItem, Assignment } from '../../../types';
import { MessageCircle, Edit, Trash2 } from 'lucide-react';
import { useStore } from '../../../store/useStore';

import { BaseCard } from './BaseCard';

interface RideCardProps {
  item: MenuItem;
  assignment?: Assignment;
  assignments?: Assignment[];
  onAssign: () => void;
  onCancel: (assignment: Assignment) => void;
  isMyAssignment: boolean;
  isEventActive: boolean;
  currentUserId?: string;
  onDeleteItem?: () => void;
  onEditItem?: () => void;
  onEditAssignment?: (assignment: Assignment) => void;
  isOrganizer?: boolean;
  categoryDisplayName?: string;
  eventName?: string;
}

export const RideCard: React.FC<RideCardProps> = ({
  item,
  assignments = [],
  onAssign,
  onCancel,
  isMyAssignment,
  isEventActive,
  currentUserId,
  onDeleteItem,
  onEditItem,
  onEditAssignment,
  isOrganizer,
  categoryDisplayName,
  eventName: _eventName,
}) => {
  const isRequest = item.rowType === 'needs' || item.category === 'ride_requests';
  const totalQuantity = item.quantity;
  const filledQuantity = assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const isFull = isRequest ? filledQuantity > 0 : (filledQuantity >= totalQuantity);
  const progressPercent = isFull ? 100 : (isRequest ? 0 : Math.min(100, (filledQuantity / totalQuantity) * 100));


  const myAssignments = currentUserId
    ? assignments.filter(a => a.userId === currentUserId)
    : (isMyAssignment && assignments[0] ? [assignments[0]] : []);

  const hasMyAssignment = myAssignments.length > 0;

  // WhatsApp Helper
  const getWhatsAppLink = (phoneNumber: string) => {
    let cleanNum = phoneNumber.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) {
      cleanNum = '972' + cleanNum.substring(1);
    }
    return `https://wa.me/${cleanNum}`;
  };

  const renderWhatsApp = (number: string) => (
    <a
      href={getWhatsAppLink(number)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-green-600 hover:text-green-700 mx-1.5 flex items-center justify-center bg-green-100 hover:bg-green-200 w-5 h-5 rounded-full transition-colors"
      title="WhatsApp"
    >
      <MessageCircle size={10} strokeWidth={3} />
    </a>
  );

  const isCreatorLogic = isOrganizer || (currentUserId && item.creatorId === currentUserId);
  const showCreatorPhoneToAssignee = hasMyAssignment && item.phoneNumber;

  // Check if creator has opposite direction ride
  const hasOppositeDirection = useMemo(() => {
    if (!item.direction || (item.direction as string) === 'both') return false;

    const oppositeDir = item.direction === 'to_event' ? 'from_event' : 'to_event';
    const allItems = useStore.getState().currentEvent?.menuItems;

    if (!allItems) return false;

    return Object.values(allItems).some((i: any) =>
      i.id !== item.id && // Exclude self
      i.creatorId === item.creatorId &&
      i.direction === oppositeDir &&
      (i.category === 'ride_offers' || i.category === 'ride_requests')
    );
  }, [item.direction, item.creatorId, item.id]);

  // Format time flexibility text
  const getFlexibilityText = (flex?: string) => {
    switch (flex) {
      case 'exact': return 'מדויק';
      case '15min': return '±15\'';
      case '30min': return '±30\'';
      case '1hour': return '±1שעה';
      case 'flexible': return 'גמיש מאוד';
      default: return '';
    }
  };

  const cardStyles = hasMyAssignment
    ? 'bg-blue-50/50 border-blue-200'
    : isFull
      ? 'bg-gray-50/80 border-gray-200 grayscale-[0.8] opacity-75 shadow-none'
      : 'bg-white border-gray-200 hover:border-blue-200 transition-colors shadow-sm';

  const tagColor = 'bg-rides-bg text-rides-primary border-rides-bg';

  return (
    <BaseCard
      title={item.name}
      categoryDisplayName={categoryDisplayName || (isRequest ? 'בקשות טרמפ' : 'הצעות טרמפ')}
      cardStyles={cardStyles}
      tagColor={tagColor}
      onEdit={onEditItem}
      onDelete={onDeleteItem}
      showEdit={!!(isCreatorLogic && isEventActive)}
      showDelete={!!(isOrganizer && isEventActive)}
      footer={
        <div className="space-y-3">

          {/* Action Buttons */}
          {isEventActive && !isFull && !hasMyAssignment && currentUserId !== item.creatorId && (
            <button
              onClick={onAssign}
              className="w-full py-3 text-sm rounded-xl font-bold shadow-sm transition-all active:scale-[0.98] 
                bg-rides-primary hover:bg-rides-hover text-white shadow-rides-primary/50"
            >
              {isRequest ? 'אני יכול/ה לקחת' : 'אני אצטרף'}
            </button>
          )}

          {isFull && !hasMyAssignment && (
            <div className="text-center py-2 px-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-gray-500 text-sm font-bold flex items-center justify-center gap-2">
                <span>{isRequest ? 'נמצא נהג' : 'הרכב מלא'}</span>
                <span className="text-xs">✔️</span>
              </span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Header Info Block */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <span>{isRequest ? 'נוסעים' : 'מקומות מוצעים'}:</span>
              <span className="text-gray-900">{totalQuantity}</span>
            </div>
          </div>
          <div className="text-left flex flex-col items-end">
            <span className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">
              {isRequest ? 'נוסע/ת' : 'נהג/ת'}
            </span>
            <span className="text-xs font-bold text-gray-700 truncate max-w-[100px]">
              {item.creatorName}
            </span>
          </div>
        </div>

        {/* Direction, Time and Flexibility Info */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {item.direction && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium text-xs">
              {(item.direction as string) === 'both' ? '↔ הלוך וחזור' : (item.direction === 'to_event' ? '→ הלוך' : '← חזור')}
            </span>
          )}

          {item.departureTime && (
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-gray-700 text-xs flex items-center gap-1">
                {item.departureTime} {(item.direction as string) === 'both' && '(הלוך)'}
                {item.timeFlexibility && item.timeFlexibility !== 'exact' && (
                  <span className="text-[10px] text-gray-500">
                    ({getFlexibilityText(item.timeFlexibility)})
                  </span>
                )}
              </span>
              {/* Secondary Time for Round Trip */}
              {(item.direction as string) === 'both' && (item as any).departureTimeFrom && (
                <span className="font-bold text-gray-700 text-xs flex items-center gap-1">
                  {(item as any).departureTimeFrom} (חזור)
                  {(item as any).timeFlexibilityFrom && (item as any).timeFlexibilityFrom !== 'exact' && (
                    <span className="text-[10px] text-gray-500">
                      ({getFlexibilityText((item as any).timeFlexibilityFrom)})
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Pickup Location */}
        {item.pickupLocation && (
          <div className="text-xs text-gray-600 flex items-center gap-1 mt-2 bg-gray-50 rounded-lg p-2">
            <span>📍</span>
            <span className="font-medium">{item.pickupLocation}</span>
          </div>
        )}

        {/* Has Opposite Direction Badge */}
        {hasOppositeDirection && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-2 py-1.5 mt-2">
            <span className="text-xs text-yellow-700 flex items-center gap-1 font-medium">
              ⭐ גם {item.direction === 'to_event' ? 'חוזר' : 'הולך'}!
            </span>
          </div>
        )}

        {/* Visibility Info & Phone (Creator's phone for Assignees) */}
        {(showCreatorPhoneToAssignee || item.notes) && (
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
            {showCreatorPhoneToAssignee && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  {isRequest ? 'טלפון הנוסע/ת:' : 'טלפון הנהג/ת:'}
                </span>
                <div className="flex items-center gap-2">
                  <a href={`tel:${item.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="text-sm font-bold text-blue-600 hover:underline" dir="ltr">
                    {item.phoneNumber}
                  </a>
                  {renderWhatsApp(item.phoneNumber!)}
                </div>
              </div>
            )}
            {item.notes && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">הערות:</span>
                <p className="text-xs text-gray-600 leading-relaxed italic">"{item.notes}"</p>
              </div>
            )}
          </div>
        )}

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-gray-500">
              {isRequest ? 'מצב שיבוץ' : 'תפוסה'}
            </span>
            <span className="text-[10px] font-bold text-gray-400">
              {isRequest && isFull ? 'נמצא נהג/ת' : `${filledQuantity}/${totalQuantity}`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 bg-rides-primary`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Participants List (Assignee's phone for Creator) */}
        {assignments.length > 0 && (
          <div className="pt-2 border-t border-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">
              {isRequest ? 'נהג/ת רשום:' : 'נוסעים בטרמפ:'}
            </p>
            <div className="space-y-2">
              {assignments.map(a => {
                const isMyEntry = a.userId === currentUserId;
                return (
                  <div key={a.id} className={`flex flex-col space-y-1 group/user p-2 rounded-lg transition-colors ${isMyEntry ? 'bg-blue-50/50 border border-blue-100' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${isMyEntry ? 'bg-blue-400' : 'bg-gray-200'}`} />
                        <span className={`text-xs font-medium ${isMyEntry ? 'text-blue-900' : 'text-gray-700'}`}>
                          {a.userName} {isMyEntry && <span className="text-[10px] font-bold text-blue-500 mr-1">(אני)</span>}
                          {!isRequest && <span className="text-gray-400 mr-1">({a.quantity})</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {(isOrganizer || currentUserId === item.creatorId || isMyEntry) && (
                          <>
                            {isMyEntry && onEditAssignment && (
                              <button
                                onClick={() => onEditAssignment(a)}
                                className="p-1 text-blue-400 hover:text-blue-600 hover:bg-white rounded-md transition-all"
                                title="ערוך"
                              >
                                <Edit size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => onCancel(a)}
                              className={`p-1 transition-all rounded-md ${isMyEntry ? 'text-blue-400 hover:text-red-500 hover:bg-white' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                              title={isMyEntry ? "בטל שיבוץ" : "הסר שיבוץ"}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Phone visibility for mutual contact */}
                    {(isCreatorLogic || isMyEntry) && a.phoneNumber && (
                      <div className="mr-3.5 flex items-center gap-2">
                        <a href={`tel:${a.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="text-[10px] font-bold text-blue-500 hover:underline" dir="ltr">
                          {a.phoneNumber}
                        </a>
                        {renderWhatsApp(a.phoneNumber)}
                      </div>
                    )}
                    {/* Personal Notes */}
                    {a.notes && (
                      <p className={`mr-3.5 text-[10px] italic ${isMyEntry ? 'text-blue-600' : 'text-gray-500'}`}>
                        "{a.notes}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
};
