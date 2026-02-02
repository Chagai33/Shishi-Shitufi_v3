// src/components/Events/MenuItemCard.tsx

import React from 'react';
import { MenuItem, Assignment } from '../../types';
import { Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isCarpoolLogic } from '../../utils/eventUtils';

// Definition of Props that the component receives from the parent (EventPage)
interface MenuItemCardProps {
  item: MenuItem;
  assignment?: Assignment; // For backward compatibility / user's own assignment
  assignments?: Assignment[]; // All assignments for this item (for split view)
  onAssign: () => void;
  onEdit: () => void;
  onCancel: (assignment: Assignment) => void;
  isMyAssignment: boolean;
  isEventActive: boolean;
  currentUserId?: string;
  itemRowType?: 'needs' | 'offers';
  onDeleteItem?: () => void;
  onEditItem?: () => void;
  onEditAssignment?: (assignment: Assignment) => void;
  isOrganizer?: boolean;
  categoryDisplayName?: string;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  assignment,
  assignments = [],
  onAssign,
  onEdit,
  onCancel,
  isMyAssignment,
  isEventActive,
  currentUserId,
  itemRowType = 'needs', // Default
  onDeleteItem,
  onEditItem,
  onEditAssignment,
  isOrganizer,
  categoryDisplayName,
}) => {
  const { t } = useTranslation();

  const assignedByOther = assignment && !isMyAssignment;
  const isSplittable = item.isSplittable;
  const totalQuantity = item.quantity;
  const isOffers = isCarpoolLogic(item.name, item.category, itemRowType);

  const filledQuantity = isSplittable
    ? assignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
    : (assignment ? item.quantity : 0);

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

  return (
    <div className={`rounded-xl border flex flex-col transition-all duration-300 hover:shadow-md ${cardStyles}`}>
      <div className="p-4 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 text-lg tracking-tight leading-tight">{item.name}</h4>
              {/* Admin Delete Item Button */}
              {isOrganizer && isEventActive && onDeleteItem && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteItem();
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                  title={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {/* Edit Item Button (Creator/Admin) */}
            {((isOrganizer || (currentUserId && item.creatorId === currentUserId)) && isEventActive && onEditItem) && (
              <button
                onClick={onEditItem}
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mt-0.5 w-fit"
                title={t('eventPage.item.editItem')}
              >
                <Edit size={12} />
                {t('eventPage.item.editItem')}
              </button>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${tagColor}`}>
            {categoryDisplayName || t(`categories.${item.category}`) || t('categories.other')}
          </span>
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-gray-600 font-medium">
            {isOffers ? 'מקומות פנויים' : t('eventPage.item.quantityRequired')}: {isOffers ? Math.max(0, totalQuantity - filledQuantity) : item.quantity}
          </p>
          {item.creatorName && <p className="text-xs text-gray-400">{isOffers ? 'נהג/ת' : t('eventPage.item.createdBy')}: {item.creatorName}</p>}
          {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-1.5 rounded-lg mt-1 border border-gray-100">{item.notes}</p>}
        </div>

        {isSplittable && (
          <div className="mt-3">
            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
              <span>{isOffers ? 'תפוסה' : t('eventPage.item.progress')}</span>
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
                <p className="font-semibold mb-1 text-gray-700">{isOffers ? 'נוסעים' : t('eventPage.list.assignedHeader')}:</p>
                <div className="space-y-1">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center justify-between space-x-2 rtl:space-x-reverse group/row">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                        <span>
                          <span className="font-medium text-gray-900">{a.userName}</span>
                          <span className="text-gray-500 mx-1">({a.quantity})</span>
                          {a.notes && <span className="text-gray-400 italic">- {a.notes}</span>}
                        </span>
                      </div>
                      {/* Admin Cancel Assignment Button */}
                      {isOrganizer && isEventActive && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCancel(a);
                          }}
                          className="text-red-400 hover:text-red-600 p-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
                          title={t('eventPage.item.cancel')}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100/50 p-3 bg-gray-50/50 rounded-b-xl">
        {isSplittable ? (
          <div className="space-y-2">
            {hasMyAssignment && (
              <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm">
                <p className="text-xs font-bold text-blue-700 mb-1.5 uppercase tracking-wider">{isOffers ? 'אני מגיע/ה' : t('eventPage.item.iBring')}</p>
                <div className="space-y-1.5">
                  {myAssignments.map(myAss => (
                    <div key={myAss.id} className="flex justify-between items-center text-sm group">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span className="font-bold text-gray-800 text-base">{myAss.quantity} {isOffers ? (myAss.quantity > 1 ? 'מקומות' : 'מקום') : 'יח\''}</span>
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
                aria-label={hasMyAssignment ? (isOffers ? 'הצטרף לנסיעה' : t('eventPage.item.addMore')) : (isOffers ? 'אני אצטרף' : t('eventPage.item.iWillBringIt'))}
              >
                {hasMyAssignment ? (isOffers ? 'הצטרף לנסיעה' : t('eventPage.item.addMore')) : (isOffers ? 'אני אצטרף' : t('eventPage.item.iWillBringIt'))}
              </button>
            )}

            {isFull && (
              <div className="text-center py-1">
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                  <span className="mr-1.5">{isOffers ? 'הרכב מלא' : t('eventPage.item.completed')}</span>
                  <span className="text-xs" aria-hidden="true">✔️</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {isMyAssignment && assignment ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <span className="font-semibold text-blue-700">{isOffers ? 'אני מצטרף/ת' : t('eventPage.item.iBring')}</span>
                  <span className="font-bold text-gray-900">{assignment.quantity}</span>
                </div>
                {assignment.notes && <p className="text-xs text-gray-700 bg-white p-2.5 rounded-lg border border-gray-100">{t('eventPage.assignment.notesOptional')}: {assignment.notes}</p>}

                {isEventActive && (
                  <div className="flex space-x-3 rtl:space-x-reverse pt-1">
                    <button
                      onClick={onEdit}
                      className="flex-1 text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 py-2.5 rounded-lg flex items-center justify-center transition-all shadow-sm hover:shadow focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
                      aria-label={t('common.edit')}
                    >
                      <Edit size={16} className="ml-1.5" />
                      {t('common.edit')}
                    </button>
                    <button
                      onClick={() => onCancel(assignment)}
                      className="flex-1 text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg flex items-center justify-center transition-all shadow-sm hover:shadow focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      aria-label={item.creatorId === assignment.userId ? t('common.delete') : t('eventPage.item.cancelAssignment')}
                    >
                      <Trash2 size={16} className="ml-1.5" />
                      {item.creatorId === assignment.userId ? t('common.delete') : t('eventPage.item.cancel')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!isSplittable && assignment ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm p-3 bg-green-50/80 border border-green-100 rounded-lg">
                      <span className="font-semibold text-green-800 flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full ml-2"></div>
                        {isOffers ? 'נוסע/ת:' : t('eventPage.item.takenBy')} {assignment.userName}
                      </span>
                      <span className="font-bold text-gray-900">{assignment.quantity}</span>
                    </div>
                    {assignment.notes && <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200">{t('eventPage.assignment.notesOptional')}: {assignment.notes}</p>}
                  </div>
                ) : (
                  isEventActive ? (
                    (!isFull || (isSplittable && !isFull)) ? (
                      <button
                        onClick={onAssign}
                        className="w-full bg-orange-600 text-white py-3 text-sm rounded-xl hover:bg-orange-700 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                        aria-label={isOffers ? 'אני אצטרף' : t('eventPage.item.iWillBringIt')}
                      >
                        {isSplittable ? (isOffers ? `אני אצטרף (${t('eventPage.item.addMore')})` : `${t('eventPage.item.iWillBringIt')} (${t('eventPage.item.addMore')})`) : (isOffers ? 'אני אצטרף' : t('eventPage.item.iWillBringIt'))}
                      </button>
                    ) : (
                      <div className="text-center py-1">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                          <span className="mr-1.5">{isOffers ? 'הרכב מלא' : t('eventPage.item.completed')}</span>
                          <span className="text-xs" aria-hidden="true">✔️</span>
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-center text-gray-500 py-1">{t('eventPage.status.inactive')}</p>
                  )
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;
