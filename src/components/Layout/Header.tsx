import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Users, Shield, LogIn, LogOut } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { AdminLogin } from '../Auth/AdminLogin';

interface HeaderProps {
  currentView: 'events' | 'admin';
  onViewChange: (view: 'events' | 'admin') => void;
}

export function Header({ currentView, onViewChange }: HeaderProps) {
  const { user } = useStore();
  const isAdmin = user?.isAdmin || false;
  const { logout } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const handleAdminLogin = () => {
    setShowAdminLogin(true);
  };

  const handleLoginSuccess = () => {
    // Login success logic is handled by auth state observer
  };

  const hasUserName = user?.name && user.name.trim().length > 0;

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">

            {/* Logo - Clickable to Home */}
            <Link
              to="/"
              className="flex items-center space-x-4 rtl:space-x-reverse hover:opacity-80 transition-opacity group"
            >
              <div className="bg-orange-500 rounded-lg p-2 flex-shrink-0 group-hover:bg-orange-600 transition-colors">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-none">שישי שיתופי</h1>
                <p className="text-xs text-gray-500 mt-1">ניהול ארוחות קהילתיות</p>
              </div>
            </Link>

            {/* Right Side Navigation */}
            <nav className="flex items-center space-x-3 rtl:space-x-reverse">

              {/* Events View Button */}
              <button
                onClick={() => onViewChange('events')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${currentView === 'events'
                    ? 'bg-orange-50 text-orange-700 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <Calendar className="h-4 w-4" />
                <span className={`${currentView === 'events' ? 'inline' : 'hidden md:inline'}`}>אירועים</span>
              </button>

              {/* Admin Panel Button */}
              {isAdmin && (
                <button
                  onClick={() => onViewChange('admin')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${currentView === 'admin'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-blue-600 border border-blue-200 hover:bg-blue-50'
                    }`}
                >
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">פאנל ניהול</span>
                </button>
              )}

              <div className="h-6 w-px bg-gray-200 mx-1"></div>

              {/* User Info */}
              <div className="flex items-center gap-2 px-1" title={hasUserName ? user.name : 'אורח'}>
                {hasUserName && (
                  <span className="text-sm font-medium text-gray-700 hidden md:block max-w-[100px] truncate">
                    {user.name}
                  </span>
                )}
                <div className={`rounded-full p-1.5 ${hasUserName ? 'bg-orange-100 ring-2 ring-orange-50' : 'bg-gray-100'}`}>
                  <Users className={`h-4 w-4 ${hasUserName ? 'text-orange-600' : 'text-gray-500'}`} />
                </div>
              </div>

              {/* Auth Actions */}
              {isAdmin ? (
                <button
                  onClick={logout}
                  title="התנתק"
                  className="p-2 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={handleAdminLogin}
                  title="התחבר כמנהל"
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <span className="hidden sm:inline">כניסת מנהל</span>
                  <LogIn className="h-4 w-4" />
                </button>
              )}
            </nav>

          </div>
        </div>
      </header>

      {showAdminLogin && (
        <AdminLogin
          onClose={() => setShowAdminLogin(false)}
          onSuccess={handleLoginSuccess}
        />
      )}
    </>
  );
}
