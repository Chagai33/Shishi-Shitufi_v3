// src/components/Events/AssignmentModal.tsx

import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { FirebaseService } from '../../services/firebaseService';
import { MenuItem, Assignment } from '../../types';
import { User as FirebaseUser } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { X, Hash, MessageSquare, User as UserIcon } from 'lucide-react';

interface AssignmentModalProps {
  item: MenuItem;
  organizerId: string;
  eventId: string;
  user: FirebaseUser;
  onClose: () => void;
  isEdit?: boolean;
  existingAssignment?: Assignment;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({
  item,
  organizerId,
  eventId,
  user,
  onClose,
  isEdit = false,
  existingAssignment,
}) => {
  const [quantity, setQuantity] = useState(existingAssignment?.quantity || item.quantity);
  const [notes, setNotes] = useState(existingAssignment?.notes || '');
  const [isLoading, setIsLoading] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  // Check if user is already registered as event participant
  useEffect(() => {
    const participants = useStore.getState().currentEvent?.participants || {};
    const isParticipant = !!participants[user.uid];
    
    // Show name field only if it's an anonymous user who hasn't joined yet
    if (user.isAnonymous && !isParticipant) {
      setShowNameInput(true);
    }
  }, [user.uid, user.isAnonymous]);

  const handleSubmit = async () => {
    // Validation
    if (showNameInput && !participantName.trim()) {
      toast.error("כדי להשתבץ, יש להזין שם מלא.");
      return;
    }
    if (quantity <= 0) {
      toast.error("הכמות חייבת להיות גדולה מ-0.");
      return;
    }
    
    setIsLoading(true);

    try {
      let finalUserName = participantName.trim();
      
      // If user entered a name, register them as event participant
      if (showNameInput && finalUserName) {
        await FirebaseService.joinEvent(organizerId, eventId, user.uid, finalUserName);
      } else {
        // If they're already a participant, take their existing name
        const existingParticipant = useStore.getState().currentEvent?.participants[user.uid];
        finalUserName = existingParticipant?.name || user.displayName || 'אורח';
      }

      if (isEdit && existingAssignment) {
        // --- Edit logic ---
        await FirebaseService.updateAssignment(organizerId, eventId, existingAssignment.id, {
          quantity,
          notes: notes.trim(),
        });
        toast.success("השיבוץ עודכן בהצלחה!");
      } else {
        // --- Create new assignment logic ---
        const assignmentData: Omit<Assignment, 'id'> = {
          menuItemId: item.id,
          userId: user.uid,
          userName: finalUserName,
          quantity,
          notes: notes.trim(),
          status: 'confirmed',
          assignedAt: Date.now(),
        };
        await FirebaseService.createAssignment(organizerId, eventId, assignmentData);
        toast.success(`שובצת בהצלחה לפריט: ${item.name}`);
      }
      onClose();
    } catch (error: any) {
      console.error("Error in assignment modal:", error);
      toast.error(error.message || "אירעה שגיאה.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">{isEdit ? 'עריכת שיבוץ' : 'שיבוץ פריט'}</h2>
          <button onClick={onClose} disabled={isLoading} className="text-neutral-400 hover:text-neutral-600 transition-colors disabled:opacity-50">
            <X size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="bg-accent/10 p-4 rounded-lg mb-6 text-center">
            <p className="font-bold text-accent">{item.name}</p>
            <p className="text-sm text-accent/80">כמות מוצעת: {item.quantity}</p>
          </div>

          <div className="space-y-4">
            {showNameInput && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">שם מלא*</label>
                <div className="relative">
                  <UserIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <input 
                    type="text" 
                    value={participantName} 
                    onChange={e => setParticipantName(e.target.value)} 
                    placeholder="השם שיוצג לכולם" 
                    className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent" 
                  />
                </div>
                <p className="text-xs text-neutral-500 mt-1">השם יישמר למכשיר זה עבור אירוע זה.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">כמות שאביא*</label>
              <div className="relative">
                <Hash className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input 
                  type="number" 
                  value={quantity} 
                  onChange={e => setQuantity(parseInt(e.target.value, 10) || 1)} 
                  className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent" 
                  min="1" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">הערות (אופציונלי)</label>
              <div className="relative">
                <MessageSquare className="absolute right-3 top-3 h-4 w-4 text-neutral-400" />
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full p-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent" 
                  rows={3} 
                  placeholder="לדוגמה: ללא גלוטן, טבעוני..." 
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="bg-neutral-100 px-6 py-4 flex justify-end space-x-3 rtl:space-x-reverse rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-neutral-200 text-neutral-700 hover:bg-neutral-300 font-medium transition-colors">
            ביטול
          </button>
          <button onClick={handleSubmit} disabled={isLoading} className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:bg-neutral-300 font-medium transition-colors">
            {isLoading ? 'מעדכן...' : isEdit ? 'שמור שינויים' : 'אשר שיבוץ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentModal;