// src/components/Events/MenuItemCard.tsx

import React from 'react';
import { MenuItem, Assignment } from '../../types';
import { Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
}) => {
  const { t } = useTranslation();

  const assignedByOther = assignment && !isMyAssignment;
  const isSplittable = item.isSplittable;
  const totalQuantity = item.quantity;

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
      <div className="p-5 flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h4 className="font-semibold text-gray-900 text-lg tracking-tight">{item.name}</h4>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${tagColor}`}>
            {t(`categories.${item.category}`) || t('categories.other')}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-600 font-medium">
            {isSplittable ? `${t('eventPage.item.quantityRequired')}: ${item.quantity}` : `${t('eventPage.item.quantityRequired')}: ${item.quantity}`}
          </p>
          {item.creatorName && <p className="text-xs text-gray-400">{t('eventPage.item.createdBy')}: {item.creatorName}</p>}
          {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">{item.notes}</p>}
        </div>

        {isSplittable && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
              <span>{t('eventPage.item.progress')}</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            {assignments.length > 0 && (
              <div className="mt-3 text-xs text-gray-600">
                <p className="font-semibold mb-2 text-gray-700">{t('eventPage.list.assignedHeader')}:</p>
                <div className="space-y-1.5">
                  {assignments.map(a => (
                    <div key={a.id} className="flex items-center space-x-2 rtl:space-x-reverse">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                      <span>
                        <span className="font-medium text-gray-900">{a.userName}</span>
                        <span className="text-gray-500 mx-1">({a.quantity})</span>
                        {a.notes && <span className="text-gray-400 italic">- {a.notes}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100/50 p-4 bg-gray-50/50 rounded-b-xl">
        {isSplittable ? (
          <div className="space-y-3">
            {hasMyAssignment && (
              <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">{t('eventPage.item.iBring')}</p>
                <div className="space-y-2">
                  {myAssignments.map(myAss => (
                    <div key={myAss.id} className="flex justify-between items-center text-sm group">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span className="font-bold text-gray-800">{myAss.quantity} יח'</span>
                        {myAss.notes && <span className="text-xs text-gray-600 border-r border-gray-300 pr-2 mr-2">{myAss.notes}</span>}
                      </div>
                      {isEventActive && (
                        <button
                          onClick={() => onCancel(myAss)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                          title={t('eventPage.item.cancelAssignment')}
                          aria-label={t('eventPage.item.cancelAssignment')}
                        >
                          <Trash2 size={18} />
                        </button>
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
                aria-label={hasMyAssignment ? t('eventPage.item.addMore') : t('eventPage.item.iWillBringIt')}
              >
                {hasMyAssignment ? t('eventPage.item.addMore') : t('eventPage.item.iWillBringIt')}
              </button>
            )}

            {isFull && (
              <div className="text-center py-1">
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                  <span className="mr-1.5">{t('eventPage.item.completed')}</span>
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
                  <span className="font-semibold text-blue-700">{t('eventPage.item.iBring')}</span>
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
                        {t('eventPage.item.takenBy')}: {assignment.userName}
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
                        aria-label={t('eventPage.item.iWillBringIt')}
                      >
                        {isSplittable ? `${t('eventPage.item.iWillBringIt')} (${t('eventPage.item.addMore')})` : t('eventPage.item.iWillBringIt')}
                      </button>
                    ) : (
                      <div className="text-center py-1">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                          <span className="mr-1.5">{t('eventPage.item.completed')}</span>
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
