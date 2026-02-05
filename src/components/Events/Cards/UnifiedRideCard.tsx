import { MenuItem, Assignment } from '../../../types';
import { MessageCircle, Edit, Trash2 } from 'lucide-react';
import { DriverGroup } from '../../../utils/rideGroupingUtils';

interface UnifiedRideCardProps {
  group: DriverGroup;
  assignments: Assignment[]; // All assignments for these items
  currentUserId?: string;
  isEventActive: boolean;
  isOrganizer?: boolean;

  // Handlers
  onAssign: (item: MenuItem) => void;
  onCancel: (assignment: Assignment) => void;
  onEditItem?: (item: MenuItem) => void; // We might need to know WHICH item to edit
  onDeleteItem?: (item: MenuItem) => void;
  onEditAssignment?: (item: MenuItem, assignment: Assignment) => void;
}

export const UnifiedRideCard: React.FC<UnifiedRideCardProps> = ({
  group,
  assignments,
  currentUserId,
  isEventActive,
  isOrganizer,
  onAssign,
  onCancel,
  onEditItem,
  onDeleteItem,
  onEditAssignment
}) => {
  const { outbound, returnRide, creatorName } = group;

  // We assume at least one exists, logic guarantees it.
  const mainItem = outbound || returnRide!;
  const creatorId = mainItem.creatorId;
  const isCreator = isOrganizer || (currentUserId && creatorId === currentUserId);

  const getWhatsAppLink = (phoneNumber: string) => {
    let cleanNum = phoneNumber.replace(/\D/g, '');
    if (cleanNum.startsWith('0')) cleanNum = '972' + cleanNum.substring(1);
    return `https://wa.me/${cleanNum}`;
  };

  const renderWhatsApp = (number: string) => (
    <a href={getWhatsAppLink(number)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      className="text-green-600 hover:text-green-700 mx-1.5 flex items-center justify-center bg-green-100 hover:bg-green-200 w-5 h-5 rounded-full transition-colors">
      <MessageCircle size={10} strokeWidth={3} />
    </a>
  );

  const renderLeg = (item?: MenuItem) => {
    if (!item) return null;

    const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
    const filledQuantity = itemAssignments.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    const totalQuantity = item.quantity;
    const isFull = filledQuantity >= totalQuantity;
    const progressPercent = Math.min(100, (filledQuantity / totalQuantity) * 100);

    // My assignments on this leg
    const myAssignments = currentUserId
      ? itemAssignments.filter(a => a.userId === currentUserId)
      : [];
    const hasMyAssignment = myAssignments.length > 0;
    const isMyItem = currentUserId === item.creatorId;

    return (
      <div className={`p-3 rounded-xl border transition-all ${hasMyAssignment ? 'bg-blue-50/50 border-blue-200' : 'bg-white border-gray-100'}`}>
        {/* Leg Header: Time | Direction | Action */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.direction === 'to_event' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
              {item.direction === 'to_event' ? '→ הלוך' : '← חזור'}
            </span>
            <span className="font-bold text-gray-800 text-sm">{item.departureTime}</span>
            {item.pickupLocation && (
              <span className="text-xs text-gray-500 hidden sm:inline-block">📍 {item.pickupLocation}</span>
            )}
          </div>

          {/* Action Button for Leg */}
          <div className="flex items-center gap-2">
            {/* Status Badge */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-400 font-bold">{filledQuantity}/{totalQuantity}</span>
              <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-rides-primary" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Join/Edit Buttons */}
            {isEventActive && !isFull && !hasMyAssignment && !isMyItem && (
              <button
                onClick={() => onAssign(item)}
                className="bg-rides-primary hover:bg-rides-hover text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                הצטרף
              </button>
            )}
            {(isFull && !hasMyAssignment && !isMyItem) && (
              <span className="text-gray-400 text-xs font-bold bg-gray-50 px-2 py-1 rounded border">מלא</span>
            )}
            {/* Creator Actions for this Leg */}
            {isEventActive && (isMyItem || isOrganizer) && (
              <div className="flex gap-1">
                <button onClick={() => onEditItem?.(item)} className="p-1 text-gray-400 hover:text-blue-500 rounded"><Edit size={14} /></button>
                {isOrganizer && <button onClick={() => onDeleteItem?.(item)} className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 size={14} /></button>}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Location (if needed) */}
        {item.pickupLocation && (
          <div className="text-xs text-gray-500 sm:hidden mb-2">📍 {item.pickupLocation}</div>
        )}

        {/* Participants for this Leg */}
        {itemAssignments.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
            {itemAssignments.map(a => {
              const isMe = a.userId === currentUserId;
              return (
                <div key={a.id} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${isMe ? 'bg-blue-400' : 'bg-gray-300'}`} />
                    <span className={isMe ? 'font-bold text-blue-800' : 'text-gray-600'}>{a.userName}</span>
                    <span className="text-gray-400">({a.quantity})</span>
                  </div>
                  {/* Delete/Edit Assignment Actions */}
                  {(isMe || isCreator) && (
                    <div className="flex gap-1 opacity-60 hover:opacity-100">
                      {isMe && onEditAssignment && <button onClick={() => onEditAssignment(item, a)}><Edit size={10} /></button>}
                      <button onClick={() => onCancel(a)} className="hover:text-red-500"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Determine shared phone number
  const phoneNumber = outbound?.phoneNumber || returnRide?.phoneNumber;
  // Usually notes are "Leaving from X" which is per leg. 
  // We should display notes inside the leg?
  // If notes are identical, display once? 
  // Let's keep notes inside the leg if they differ, or just ignore general notes in favor of per-leg clarity.

  // Actually BaseCard expects children.
  // We can wrap the whole thing in a clean container.

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Unified Header */}
      <div className="bg-gray-50 p-3 flex justify-between items-center border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-rides-bg flex items-center justify-center text-rides-primary font-bold text-sm">
            🚗
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm">{creatorName}</h3>
            {phoneNumber && (isCreator || assignments.some(a => a.userId === currentUserId)) && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <a href={`tel:${phoneNumber}`} className="hover:text-blue-600 hover:underline" dir="ltr">{phoneNumber}</a>
                {renderWhatsApp(phoneNumber)}
              </div>
            )}
          </div>
        </div>
        {/* Tag */}
        <span className="text-[10px] font-bold uppercase tracking-wider text-rides-primary bg-rides-bg px-2 py-1 rounded">
          הלוך וחזור
        </span>
      </div>

      {/* Body Content */}
      <div className="p-3 space-y-3">
        {/* Outbound Leg */}
        {outbound && renderLeg(outbound)}

        {/* Divider if both exist */}
        {outbound && returnRide && (
          <div className="flex items-center gap-2">
            <div className="h-px bg-gray-100 flex-1" />
            <div className="text-gray-300 text-[10px]">↕</div>
            <div className="h-px bg-gray-100 flex-1" />
          </div>
        )}

        {/* Return Leg */}
        {returnRide && renderLeg(returnRide)}
      </div>
    </div>
  );
};
