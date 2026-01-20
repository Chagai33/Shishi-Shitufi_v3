// src/components/Admin/AdminPanel.tsx

import React, { useState } from 'react';
import { Plus, Settings, Users, BarChart3, Shield, Trash2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { EventForm } from './EventForm';
import { ShishiEvent } from '../../types';
import { EventsManagement } from './EventsManagement';
import { Statistics } from './Statistics';
import { AdminUsersManagement } from './AdminUsersManagement';
import { TemporaryUserManagement } from './TemporaryUserManagement';
import { ImportItemsModal } from './ImportItemsModal';
import { FirebaseService } from '../../services/firebaseService';
import toast from 'react-hot-toast';

// A new component for the data maintenance tab
const DataMaintenance = () => {
  const [isCleaning, setIsCleaning] = useState(false);

  const handleCleanup = async () => {
    if (window.confirm('האם אתה בטוח שברצונך להריץ ניקוי שיבוצי רפאים? פעולה זו אינה הפיכה.')) {
      setIsCleaning(true);
      try {
        await FirebaseService.cleanupGhostAssignments();
      } catch (error) {
        // Toast is already handled in the service
      } finally {
        setIsCleaning(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">תחזוקת נתונים</h3>
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">ניקוי שיבוצי רפאים</h4>
            <p className="text-sm text-gray-600">
              פעולה זו תסיר שיבוצים שנותרו מקושרים למשתמשים שנמחקו.
            </p>
          </div>
          <button
            onClick={handleCleanup}
            disabled={isCleaning}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:bg-red-300 flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isCleaning ? 'מנקה...' : 'הפעל ניקוי'}
          </button>
        </div>
      </div>
    </div>
  );
};


export function AdminPanel() {
  const { events, assignments } = useStore();
  const [activeTab, setActiveTab] = useState<'events' | 'stats' | 'admins' | 'temp-users' | 'maintenance'>('events');
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ShishiEvent | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedEventForImport, setSelectedEventForImport] = useState<ShishiEvent | null>(null);

  const tabs = [
    { id: 'events', label: 'ניהול אירועים', icon: Settings },
    { id: 'stats', label: 'סטטיסטיקות', icon: BarChart3 },
    { id: 'admins', label: 'ניהול מנהלים', icon: Shield },
    { id: 'temp-users', label: 'ניהול משתמשים זמניים', icon: Users },
    { id: 'maintenance', label: 'תחזוקה', icon: Trash2 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Compact statistics row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm text-gray-600 mb-6">
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <p>סך אירועים:</p>
          <strong className="text-gray-900">{events.length}</strong>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <p>פעילים:</p>
          <strong className="text-green-600">{events.filter(e => e.isActive).length}</strong>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <p>שיבוצים:</p>
          <strong className="text-blue-600">{assignments.length}</strong>
        </div>
      </div>

      {/* Main container with tabs and content */}
      <div className="bg-white rounded-lg shadow-md">
        {/* New title and tabs row */}
        <div className="border-b border-gray-200 flex justify-between items-center px-4 py-3">
          <div className="flex items-center gap-x-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
            {/* '+' button appears only in relevant tab */}
            {activeTab === 'events' && (
              <button
                onClick={() => setShowEventForm(true)}
                title="אירוע חדש"
                className="bg-blue-500 text-white rounded-full p-1.5 hover:bg-blue-600 transition-colors shadow"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Tab buttons */}
          <nav className="flex space-x-1 rtl:space-x-reverse bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  title={tab.label}
                  className={`p-2 rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="p-4 sm:p-6">
          {activeTab === 'events' && <EventsManagement setShowEventForm={setShowEventForm} setEditingEvent={setEditingEvent} setShowImportModal={setShowImportModal} setSelectedEventForImport={setSelectedEventForImport} />}
          {activeTab === 'stats' && <Statistics />}
          {activeTab === 'admins' && <AdminUsersManagement />}
          {activeTab === 'temp-users' && <TemporaryUserManagement />}
          {activeTab === 'maintenance' && <DataMaintenance />}
        </div>
      </div>

      {/* Modal for creating event */}
      {showEventForm && (
        <EventForm
          event={editingEvent || undefined}
          onClose={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
        />
      )}

      {showImportModal && selectedEventForImport && (
        <ImportItemsModal
          event={selectedEventForImport}
          onClose={() => {
            setShowImportModal(false);
            setSelectedEventForImport(null);
          }}
        />
      )}
    </div>
  );
}