import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users, LogOut, Settings } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useAuth } from '../../hooks/useAuth';
import { AdminLogin } from '../Auth/AdminLogin';
import LanguageSwitcher from '../Common/LanguageSwitcher';

export function Header() {
  const { t } = useTranslation();
  const { user, currentEvent } = useStore();
  const { logout } = useAuth();
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const isOrganizer = user?.isAdmin || (currentEvent && user && currentEvent.organizerId === user.id) || (!currentEvent && user?.id);

  const hasUserName = user?.name && user.name.trim().length > 0;

  // Logic to determine if we should show the "Admin Panel" link/button
  // Only show if user is admin or on an event page where they might be the organizer (checked strictly by isAdmin for global context usually, but let's keep it simple)
  // Actually, for the global header, "Admin" button usually links to dashboard or some admin view.
  // In the original header, it toggled views.
  // IMPORTANT: The original header had "onViewChange". The new global header sits in App.tsx.
  // It shouldn't control a local state in DashboardPage.
  // If we are on Dashboard, we might need a way to switch views, BUT the design request just showed a static header.
  // For now, I will implement the visual part. Functional "View Switching" might need to be inside DashboardPage's sub-header or handled differently if we strictly follow "Global Header".
  // However, the prompt says "I want this HEADER in all screens".
  // I will focus on the visual elements of the image provided: Branding, Settings, Globe, User.

  const handleLoginSuccess = () => {
    // Login success logic is handled by auth state observer
  };

  return (
    <>
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">

            {/* Right Side (RTL Start) - Logo & Title */}
            <Link
              to="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
            >
              {/* Using ChefHat as consistent with other pages, or Calendar if preferred. Image showed simple text. Using text as primary. */}
              {/* <div className="bg-orange-500 rounded-lg p-2 flex-shrink-0 group-hover:bg-orange-600 transition-colors">
                <Calendar className="h-6 w-6 text-white" />
              </div> */}
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-orange-500 leading-none tracking-tight">{t('header.title')}</h1>
                <p className="text-xs text-gray-500 mt-1">{t('header.subtitle')}</p>
              </div>
            </Link>

            {/* Left Side (RTL End) - Actions */}
            <div className="flex items-center gap-3">

              {/* Language Switcher - Globe Icon */}
              <LanguageSwitcher />

              {/* Settings / Admin Link - Placeholder for now or link to dashboard if logged in */}
              {user && isOrganizer && (
                <Link
                  to="/dashboard"
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('header.nav.dashboard')}
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}

              <div className="h-6 w-px bg-gray-200 mx-1"></div>

              {/* User Profile */}
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-700 leading-none">
                    {hasUserName ? user.name : t('header.guest')}
                  </p>
                </div>

                {/* User Avatar / Icon */}
                <div className={`rounded-md p-1.5 ${hasUserName ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                  <Users className="w-5 h-5" />
                </div>

                {/* Login / Logout */}
                {user && (user.email || user.isAdmin) ? (
                  <button
                    onClick={logout}
                    title={t('header.logout')}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                ) : (
                  // Optional: Show login if not logged in? Image showed "Vhhh" which implies logged in or guest name.
                  // If strictly just "Header", maybe no login button here, but for usability it's good.
                  // For now, minimal intervention.
                  null
                )}
              </div>

            </div>

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
