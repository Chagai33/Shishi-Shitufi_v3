// src/components/Events/MenuItemCard.tsx

import React from 'react';
import { MenuItem, Assignment } from '../../types';
import { Edit, Trash2 } from 'lucide-react';

// Definition of Props that the component receives from the parent (EventPage)
interface MenuItemCardProps {
  item: MenuItem;
  assignment: Assignment | undefined;
  onAssign: () => void;
  onEdit: () => void;
  onCancel: () => void;
  isMyAssignment: boolean;
  isEventActive: boolean;
}

const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  assignment,
  onAssign,
  onEdit,
  onCancel,
  isMyAssignment,
  isEventActive,
}) => {
  const categoryNames: { [key: string]: string } = {
    starter: 'מנה ראשונה',
    main: 'מנה עיקרית',
    dessert: 'קינוחים',
    drink: 'שתייה',
    other: 'אחר',
  };

  // Determine tag color based on assignment status
  const tagColor = isMyAssignment
    ? 'border-blue-500 bg-blue-50 text-blue-700'
    : 'border-gray-300 bg-gray-50 text-gray-600';

  return (
    <div className={`bg-white rounded-lg border-2 flex flex-col ${isMyAssignment ? 'border-blue-400' : 'border-gray-200'}`}>
      {/* Top part with item details */}
      <div className="p-4 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-gray-800 text-base">{item.name}</h4>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tagColor}`}>
            {categoryNames[item.category] || 'לא ידוע'}
          </span>
        </div>
        <p className="text-sm text-gray-500">כמות נדרשת: {item.quantity}</p>
        {item.creatorName && <p className="text-xs text-gray-400 mt-1">נוצר ע"י: {item.creatorName}</p>}
        {item.notes && <p className="text-xs text-gray-500 mt-2 italic">הערות: {item.notes}</p>}
      </div>

      {/* Bottom part with actions and assignment details */}
      <div className="border-t p-3">
        {assignment ? (
          // --- Display when item is assigned ---
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className={`font-semibold ${isMyAssignment ? 'text-blue-700' : 'text-green-700'}`}>
                {isMyAssignment ? 'השיבוץ שלי' : `שובץ ל: ${assignment.userName}`}
              </span>
              <span className="font-bold">{assignment.quantity}</span>
            </div>
            {assignment.notes && <p className="text-xs text-gray-600 bg-gray-100 p-2 rounded">הערה: {assignment.notes}</p>}
            
            {/* Edit and cancel buttons for assigned user */}
            {isMyAssignment && isEventActive && (
              <div className="flex space-x-2 rtl:space-x-reverse pt-2">
                <button onClick={onEdit} className="flex-1 text-xs bg-gray-200 hover:bg-gray-300 py-1 rounded flex items-center justify-center">
                  <Edit size={12} className="ml-1" />
                  ערוך
                </button>
                <button onClick={onCancel} className="flex-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 py-1 rounded flex items-center justify-center">
  <Trash2 size={12} className="ml-1" />
  {isMyAssignment && item.creatorId === assignment?.userId ? 'מחק פריט' : 'בטל שיבוץ'}
</button>
              </div>
            )}
          </div>
        ) : (
          // --- Display when item is available ---
          isEventActive ? (
            <button onClick={onAssign} className="w-full bg-orange-500 text-white py-2 text-sm rounded-lg hover:bg-orange-600 font-semibold transition-colors">
              שבץ אותי
            </button>
          ) : (
            <p className="text-sm text-center text-gray-500">האירוע אינו פעיל</p>
          )
        )}
      </div>
    </div>
  );
};

export default MenuItemCard;
