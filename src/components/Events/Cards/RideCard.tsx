import React from 'react';
import { MenuItem, Assignment } from '../../../types';
import { MessageCircle, Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BaseCard } from './BaseCard';

interface RideCardProps {
  item: MenuItem;
  assignment?: Assignment;
  assignments?: Assignment[];
  onAssign: () => void;
  // onEdit removed as unused
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
  assignment,
  assignments = [],
  onAssign,
  // onEdit removed
  onCancel,
  isMyAssignment,
  isEventActive,
  currentUserId,
  onDeleteItem,
  onEditItem,
  onEditAssignment,
  isOrganizer,
  categoryDisplayName,
  eventName,
}) => {
  const { t } = useTranslation();

  const assignedByOther = assignment && !isMyAssignment;
  const totalQuantity = item.quantity;

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
      aria-label="Contact via WhatsApp"
    >
      <MessageCircle size={10} strokeWidth={3} />
    </a>
  );

  const filledQuantity = assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  const isFull = filledQuantity >= totalQuantity;
  const progressPercent = Math.min(100, (filledQuantity / totalQuantity) * 100);

  const myAssignments = currentUserId
    ? assignments.filter(a => a.userId === currentUserId)
    : (isMyAssignment && assignment ? [assignment] : []);

  const hasMyAssignment = myAssignments.length > 0;

  const cardStyles = hasMyAssignment
    ? 'bg-blue-50/50 border-blue-200 shadow-sm'
    : assignedByOther
      ? 'bg-green-50/50 border-green-200 shadow-sm'
      : 'bg-white border-gray-200 shadow-sm hover:border-gray-300';

  const tagColor = hasMyAssignment
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';

  const isCreator = currentUserId === item.creatorId;
  const showDriverPhoneToPassenger = hasMyAssignment && item.phoneNumber;
  const isCreatorLogic = isOrganizer || (currentUserId && item.creatorId === currentUserId);


  return (
    <BaseCard
      title={item.name}
      categoryDisplayName={categoryDisplayName || t(`categories.${item.category}`) || t('categories.other')}
      cardStyles={cardStyles}
      tagColor={tagColor}
      onEdit={onEditItem}
      onDelete={onDeleteItem}
      showEdit={isCreatorLogic && isEventActive}
      showDelete={isOrganizer && isEventActive}
      footer={
        <div className="space-y-2">
          {hasMyAssignment && (
            <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm">
              <p className="text-xs font-bold text-blue-700 mb-1.5 uppercase tracking-wider">{'אני מגיע/ה'}</p>
              <div className="space-y-1.5">
                {myAssignments.map(myAss => (
                  <div key={myAss.id} className="flex justify-between items-center text-sm group">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <span className="font-bold text-gray-800 text-base">{myAss.quantity} {(myAss.quantity > 1 ? 'מקומות' : 'מקום')}</span>
                      {myAss.notes && <span className="text-xs text-gray-600 border-r border-gray-300 pr-2 mr-2">{myAss.notes}</span>}
                    </div>
                    {isEventActive && (
                      <div className="flex gap-1 group/btn opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {onEditAssignment && (
                          <button
                            onClick={() => onEditAssignment(myAss)}
                            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-full hover:bg-blue-50 transition-colors"
                            title={t('eventPage.item.editQuantity')}
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => onCancel(myAss)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                          title={t('eventPage.item.cancelAssignment')}
                          aria-label={t('eventPage.item.cancelAssignment')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isEventActive && !isFull && (
            <button
              onClick={onAssign}
              className="w-full bg-orange-600 text-white py-3 text-sm rounded-xl hover:bg-orange-700 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              aria-label={hasMyAssignment ? 'הצטרף לנסיעה' : 'אני אצטרף'}
            >
              {hasMyAssignment ? 'הצטרף לנסיעה' : 'אני אצטרף'}
            </button>
          )}

          {isFull && (
            <div className="text-center py-1">
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                <span className="mr-1.5">{'הרכב מלא'}</span>
                <span className="text-xs" aria-hidden="true">✔️</span>
              </span>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-0.5">
        <p className="text-sm text-gray-600 font-medium">
          {'מקומות פנויים'}: {Math.max(0, totalQuantity - filledQuantity)}
        </p>
        <div className="flex flex-col gap-1">
          {item.creatorName && <p className="text-xs text-gray-400">{'נהג/ת'}: {item.creatorName}</p>}
          {/* Show Driver's Phone to Passenger */}
          {showDriverPhoneToPassenger && (
            <div className="flex items-center gap-1 text-xs text-green-600 font-medium mt-1 bg-green-50 p-1 rounded border border-green-100 w-fit">
              <span>📞</span>
              <a href={`tel:${item.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="hover:underline" dir="ltr">{item.phoneNumber}</a>
              {renderWhatsApp(item.phoneNumber!)}
            </div>
          )}
        </div>
        {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-1.5 rounded-lg mt-1 border border-gray-100">{item.notes}</p>}
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
          <span>{'תפוסה'}</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${isFull ? 'bg-green-500' : 'bg-orange-500'}`}
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        {assignments.length > 0 && (
          <div className="mt-2 text-xs text-gray-600">
            <p className="font-semibold mb-1 text-gray-700">{'נוסעים'}:</p>
            <div className="space-y-1">
              {assignments.map(a => (
                <div key={a.id} className="flex flex-col space-y-1 group/row border-b border-gray-50 pb-1 last:border-0">
                  <div className="flex items-center justify-between space-x-2 rtl:space-x-reverse">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span>
                        <span className="font-medium text-gray-900">{a.userName}</span>
                        <span className="text-gray-500 mx-1">({a.quantity})</span>
                        {a.notes && <span className="text-gray-400 italic">- {a.notes}</span>}
                      </span>
                    </div>
                    {/* Admin/Creator Cancel Assignment Button */}
                    {((isOrganizer || isCreator) && isEventActive) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Responsible Nagger Logic
                          if (a.phoneNumber) {
                            const confirmed = window.confirm(
                              `האם אתה בטוח שברצונך להסיר את ${a.userName}?\n\nכדי למנוע אי נעימות, לאחר האישור ייפתח לך הווצאפ לשליחת הודעת ביטול לנוסע.`
                            );
                            if (confirmed) {
                              onCancel(a);
                              const message = `היי ${a.userName}, מצטער/ת אך אני נאלץ/ת לבטל את הטרמפ לאירוע ${eventName || 'בשישי שיתופי'}.`;
                              window.open(getWhatsAppLink(a.phoneNumber) + `?text=${encodeURIComponent(message)}`, '_blank');
                            }
                          } else if (window.confirm(t('common.areYouSure'))) {
                            onCancel(a);
                          }
                        }}
                        className="text-red-400 hover:text-red-600 p-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        title={t('eventPage.item.cancel')}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Show Passenger Phone to Driver/Creator */}
                  {isCreator && a.phoneNumber && (
                    <div className="mr-3.5 flex items-center gap-1 text-[10px] text-gray-500">
                      <span>📞</span>
                      <a href={`tel:${a.phoneNumber}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-600 hover:underline" dir="ltr">{a.phoneNumber}</a>
                      {renderWhatsApp(a.phoneNumber)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
};
