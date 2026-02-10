import React, { useMemo } from 'react';
import { MenuItem, Assignment } from '../../../types';
import { Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BaseCard } from './BaseCard';

interface ItemCardProps {
  item: MenuItem;
  assignment?: Assignment;
  assignments?: Assignment[];
  onAssign: () => void;
  onEdit: () => void;
  onCancel: (assignment: Assignment) => void;
  isMyAssignment: boolean;
  isEventActive: boolean;
  currentUserId?: string;
  onDeleteItem?: () => void;
  onEditItem?: () => void;
  onEditAssignment?: (assignment: Assignment) => void;
  isOrganizer?: boolean;
  categoryDisplayName?: string;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  assignment,
  assignments = [],
  onAssign,
  onEdit,
  onCancel,
  isMyAssignment,
  isEventActive,
  currentUserId,
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

  const filledQuantity = useMemo(() => {
    return assignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
  }, [assignments]);

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

  // Specific Logic for ItemCard
  const isCreatorLogic = isOrganizer || (currentUserId && item.creatorId === currentUserId);

  return (
    <BaseCard
      title={item.name}
      categoryDisplayName={categoryDisplayName || t(`categories.${item.category}`) || t('categories.other')}
      cardStyles={cardStyles}
      tagColor={tagColor}
      onEdit={onEditItem}
      onDelete={onDeleteItem}
      showEdit={!!(isCreatorLogic && isEventActive)}
      showDelete={isOrganizer && isEventActive}
      footer={
        isSplittable ? (
          <div className="space-y-2">
            {hasMyAssignment && (
              <div className="bg-white p-2.5 rounded-lg border border-blue-100 shadow-sm">
                <p className="text-xs font-bold text-blue-700 mb-1.5 uppercase tracking-wider">{t('eventPage.item.iBring')}</p>
                <div className="space-y-1.5">
                  {myAssignments.map(myAss => (
                    <div key={myAss.id} className="flex justify-between items-center text-sm group">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span className="font-bold text-gray-800 text-base">{myAss.quantity} {'items'}</span>
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
                className="w-full bg-accent-dark text-white py-3 text-sm rounded-xl hover:bg-accent-dark/90 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] focus:ring-2 focus:ring-accent focus:ring-offset-2"
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
                      aria-label={t('eventPage.item.cancelAssignment')}
                    >
                      <Trash2 size={16} className="ml-1.5" />
                      {t('eventPage.item.cancel')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!isSplittable && assignments.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm p-3 bg-green-50/80 border border-green-100 rounded-lg">
                      <span className="font-semibold text-green-800 flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-600 rounded-full ml-2"></div>
                        {t('eventPage.item.takenBy')} {assignments[0].userName}
                      </span>
                      <span className="font-bold text-gray-900 flex items-center gap-2">
                        {assignments[0].quantity}
                        {isOrganizer && isEventActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancel(assignments[0]);
                            }}
                            className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title={t('eventPage.item.cancel')}
                            aria-label={t('eventPage.item.cancelAssignment')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                    {assignments[0].notes && <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-200">{t('eventPage.assignment.notesOptional')}: {assignments[0].notes}</p>}
                  </div>
                ) : (
                  isEventActive ? (
                    (!isFull || (isSplittable && !isFull)) ? (
                      <button
                        onClick={onAssign}
                        className="w-full bg-accent-dark text-white py-3 text-sm rounded-xl hover:bg-accent-dark/90 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] focus:ring-2 focus:ring-accent focus:ring-offset-2"
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
        )
      }
    >
      <div className="space-y-0.5">
        <p className="text-sm text-gray-600 font-medium">
          {t('eventPage.item.quantityRequired')}: {item.quantity}
        </p>
        <div className="flex flex-col gap-1">
          {item.creatorName && <p className="text-xs text-gray-400">{t('eventPage.item.createdBy')}: {item.creatorName}</p>}
        </div>
        {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-1.5 rounded-lg mt-1 border border-gray-100">{item.notes}</p>}
      </div>

      {isSplittable && (
        <div className="mt-3">
          <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
            <span>{t('eventPage.item.progress')}</span>
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
              <p className="font-semibold mb-1 text-gray-700">{t('eventPage.list.assignedHeader')}:</p>
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BaseCard>
  );
};
