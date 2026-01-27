// src/components/Events/MenuItemCard.tsx

import React from 'react';
import { MenuItem, Assignment } from '../../types';
import { Edit, Trash2 } from 'lucide-react';

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
  const categoryNames: { [key: string]: string } = {
    starter: 'מנה ראשונה',
    main: 'מנה עיקרית',
    dessert: 'קינוחים',
    drink: 'שתייה',
    other: 'אחר',
  };

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
            {categoryNames[item.category] || 'לא ידוע'}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-gray-600 font-medium">
            {isSplittable ? `סה"כ נדרש: ${item.quantity}` : `כמות נדרשת: ${item.quantity}`}
          </p>
          {item.creatorName && <p className="text-xs text-gray-400">נוצר ע"י: {item.creatorName}</p>}
          {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-lg mt-2 border border-gray-100">{item.notes}</p>}
        </div>

        {isSplittable && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
              <span>התקדמות</span>
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
                <p className="font-semibold mb-2 text-gray-700">משובצים:</p>
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
                <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">התרומה שלי</p>
                <div className="space-y-2">
                  {myAssignments.map(myAss => (
                    <div key={myAss.id} className="flex justify-between items-center text-sm group">
                      <div className="flex items-center space-x-2 rtl:space-x-reverse">
                        <span className="font-bold text-gray-800">{myAss.quantity} יח'</span>
                        {myAss.notes && <span className="text-xs text-gray-500 border-r border-gray-300 pr-2 mr-2">{myAss.notes}</span>}
                      </div>
                      {isEventActive && (
                        <button
                          onClick={() => onCancel(myAss)}
                          className="text-red-400 hover:text-red-600 p-1.5 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="בטל שיבוץ זה"
                        >
                          <Trash2 size={14} />
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
                className="w-full bg-orange-500 text-white py-2.5 text-sm rounded-xl hover:bg-orange-600 font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98]"
              >
                {hasMyAssignment ? 'הוסף עוד' : 'שבץ אותי'}
              </button>
            )}

            {isFull && (
              <div className="text-center py-1">
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                  <span className="mr-1.5">הושלם</span>
                  <span className="text-xs">✔️</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {isMyAssignment && assignment ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                  <span className="font-semibold text-blue-700">השיבוץ שלי</span>
                  <span className="font-bold text-gray-900">{assignment.quantity}</span>
                </div>
                {assignment.notes && <p className="text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-100">הערה: {assignment.notes}</p>}

                {isEventActive && (
                  <div className="flex space-x-3 rtl:space-x-reverse pt-1">
                    <button onClick={onEdit} className="flex-1 text-xs bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 py-2 rounded-lg flex items-center justify-center transition-all shadow-sm hover:shadow">
                      <Edit size={12} className="ml-1.5" />
                      ערוך
                    </button>
                    <button onClick={() => onCancel(assignment)} className="flex-1 text-xs bg-white border border-red-100 text-red-600 hover:bg-red-50 py-2 rounded-lg flex items-center justify-center transition-all shadow-sm hover:shadow">
                      <Trash2 size={12} className="ml-1.5" />
                      {item.creatorId === assignment.userId ? 'מחק פריט' : 'בטל'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!isSplittable && assignment ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm p-2 bg-green-50/50 rounded-lg">
                      <span className="font-semibold text-green-700 flex items-center">
                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full ml-2"></div>
                        שובץ ל: {assignment.userName}
                      </span>
                      <span className="font-bold">{assignment.quantity}</span>
                    </div>
                    {assignment.notes && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">הערה: {assignment.notes}</p>}
                  </div>
                ) : (
                  isEventActive ? (
                    (!isFull || (isSplittable && !isFull)) ? (
                      <button
                        onClick={onAssign}
                        className="w-full bg-orange-500 text-white py-2.5 text-sm rounded-xl hover:bg-orange-600 font-semibold shadow-sm hover:shadow transition-all active:scale-[0.98]"
                      >
                        {isSplittable ? 'שבץ אותי (הוסף)' : 'שבץ אותי'}
                      </button>
                    ) : (
                      <div className="text-center py-1">
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full inline-flex items-center">
                          <span className="mr-1.5">הושלם</span>
                          <span className="text-xs">✔️</span>
                        </span>
                      </div>
                    )
                  ) : (
                    <p className="text-sm text-center text-gray-400 py-1">האירוע אינו פעיל</p>
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
