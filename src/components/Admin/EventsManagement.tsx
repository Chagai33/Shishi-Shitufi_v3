import React, { useState } from 'react';
import { Edit, Trash2, Plus, Users, ChefHat, AlertCircle, Search } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EventForm } from './EventForm';
import { MenuManagement } from './MenuManagement';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent } from '../../types';
import { formatDate, formatTime } from '../../utils/dateUtils';
import toast from 'react-hot-toast';

interface EventsManagementProps {
  setShowEventForm: (show: boolean) => void;
  setEditingEvent: (event: ShishiEvent | null) => void;
  setShowImportModal: (show: boolean) => void;
  setSelectedEventForImport: (event: ShishiEvent | null) => void;
}

export function EventsManagement({ setShowEventForm, setEditingEvent, setShowImportModal, setSelectedEventForImport }: EventsManagementProps) {
  const { events, menuItems, assignments, deleteEvent } = useStore();
  const [selectedEvent, setSelectedEvent] = useState<ShishiEvent | null>(null);
  const [showMenuManagement, setShowMenuManagement] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleDeleteEvent = async (event: ShishiEvent) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${event.title}"?\n\nפעולה זו תמחק גם את כל פריטי התפריט והשיבוצים הקשורים לאירוע.`)) {
      return;
    }

    setDeletingEventId(event.id);

    try {
      const success = await FirebaseService.deleteEvent(event.id);
      if (success) {
        deleteEvent(event.id);
        toast.success('האירוע נמחק בהצלחה!');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('שגיאה במחיקת האירוע. אנא נסה שוב.');
    } finally {
      setDeletingEventId(null);
    }
  };

  const getEventStats = (eventId: string) => {
    const eventMenuItems = menuItems.filter(item => item.eventId === eventId);
    const eventAssignments = assignments.filter(assignment => assignment.eventId === eventId);
    const assignedItems = eventMenuItems.filter(item => item.assignedTo);

    return {
      totalItems: eventMenuItems.length,
      assignedItems: assignedItems.length,
      totalAssignments: eventAssignments.length
    };
  };

  if (showMenuManagement && selectedEvent) {
    return (
      <MenuManagement
        event={selectedEvent}
        onBack={() => {
          setShowMenuManagement(false);
          setSelectedEvent(null);
        }}
        setShowImportModal={setShowImportModal}
        setSelectedEventForImport={setSelectedEventForImport}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h3 className="text-xl font-semibold text-gray-900">ניהול אירועים</h3>

        <div className="flex w-full md:w-auto gap-3">
          <div className="relative flex-grow md:flex-grow-0">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="חפש אירוע..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-64 pr-9 pl-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={() => {
              setEditingEvent(null);
              setShowEventForm(true);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center whitespace-nowrap"
          >
            <Plus className="h-4 w-4 ml-2" />
            <span className="hidden sm:inline">הוסף אירוע</span>
            <span className="sm:hidden">חדש</span>
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <ChefHat className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">אין אירועים</h3>
            <p className="text-gray-500 mb-4">התחל על ידי יצירת האירוע הראשון</p>
            <button
              onClick={() => {
                setEditingEvent(null);
                setShowEventForm(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              צור אירוע ראשון
            </button>
          </div>
        ) : (
          events
            .filter(event =>
              event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
              event.location.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .map((event) => {
              const stats = getEventStats(event.id);
              const assignmentPercentage = stats.totalItems > 0
                ? (stats.assignedItems / stats.totalItems) * 100
                : 0;
              const isDeleting = deletingEventId === event.id;

              return (
                <div key={event.id} className={`bg-gray-50 rounded-lg p-4 ${isDeleting ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 rtl:space-x-reverse mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{event.title}</h4>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${event.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          {event.isActive ? 'פעיל' : 'לא פעיל'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span>{formatDate(event.date)} • {formatTime(event.time)}</span>
                        <span>{event.location}</span>
                        <span>מארח: {event.hostName}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowMenuManagement(true);
                        }}
                        disabled={isDeleting}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                        title="נהל תפריט"
                      >
                        <ChefHat className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => {
                          setEditingEvent(event);
                          setShowEventForm(true);
                        }}
                        disabled={isDeleting}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="ערוך"
                      >
                        <Edit className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(event)}
                        disabled={isDeleting}
                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 flex items-center"
                        title="מחק"
                      >
                        {isDeleting ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{stats.totalItems}</p>
                      <p className="text-xs text-gray-600">פריטים</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">{stats.assignedItems}</p>
                      <p className="text-xs text-gray-600">משובצים</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-blue-600">{stats.totalAssignments}</p>
                      <p className="text-xs text-gray-600">שיבוצים</p>
                    </div>
                  </div>

                  {/* Progress */}
                  {stats.totalItems > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">התקדמות שיבוצים</span>
                        <span className="text-xs text-gray-600">{assignmentPercentage.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${assignmentPercentage === 100
                              ? 'bg-green-500'
                              : assignmentPercentage >= 50
                                ? 'bg-blue-500'
                                : 'bg-orange-500'
                            }`}
                          style={{ width: `${assignmentPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Event Form Modal is now in AdminPanel */}
    </div>
  );
}
