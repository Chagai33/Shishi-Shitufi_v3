// src/App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useStore } from './store/useStore';

import DashboardPage from './pages/DashboardPage';
import EventPage from './pages/EventPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/Common/LoadingSpinner';

import { Footer } from './components/Layout/Footer';
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { ConfirmationModal } from './components/Admin/ConfirmationModal'; // <-- Modal import
import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast'; // <--- Change here
import { FirebaseService } from './services/firebaseService';





/*************  ✨ Windsurf Command ⭐  *************/
/**
 * הקומפוננטה הראשית של האפליקציה, האחראית על הראוטינג ועל הצגה של המודאל למחיקת חשבון.
 * 
 * הקומפוננטה מקבלת את המצב הנוכחי של האותנטיקציה ואת המצב הנוכחי של המודאל למחיקת חשבון מה-Store.
 * היא מציגה את הראוטינג לעמודים השונים באפליקציה, ומציגה את המודאל למחיקת חשבון אם הוא פתוח.
 * היא גם מטפלת בלוגיקה של מחיקת החשבון והנתונים המשויכים אליו.
 */
/*******  082bce00-3db0-46d3-ab25-193bdca2e3fe  *******/

import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation(); // <-- Hook
  const { isLoading: isAuthLoading } = useAuth();
  const { user, isDeleteAccountModalOpen, toggleDeleteAccountModal } = useStore();

  // Account deletion logic
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    toast.loading(t('account.delete.processing'), { id: 'delete-toast' });
    try {
      await FirebaseService.deleteCurrentUserAccount();
      toast.success(t('account.delete.success'), { id: 'delete-toast' });
    } catch (error: any) {
      toast.error(error.message || t('account.delete.error'), { id: 'delete-toast' });
    } finally {
      toggleDeleteAccountModal();
      setIsDeletingAccount(false);
    }
  };

  if (isAuthLoading) {
    return <LoadingSpinner />;
  }

  const isRegisteredUser = user && user.email;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <main className="flex-grow">
        <Routes>
          <Route
            path="/login"
            element={isRegisteredUser ? <Navigate to="/dashboard" /> : <LoginPage />}
          />

          <Route
            path="/dashboard"
            element={isRegisteredUser ? <DashboardPage /> : <Navigate to="/login" />}
          />

          <Route path="/event/:eventId" element={<EventPage />} />

          {/* --- Adding routing to new pages --- */}
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />

          <Route
            path="/"
            element={isRegisteredUser ? <Navigate to="/dashboard" /> : <LandingPage />}
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      {/* Adding the modal here */}
      {isDeleteAccountModalOpen && (
        <ConfirmationModal
          message={t('account.delete.confirmMessage')}
          onClose={toggleDeleteAccountModal}
          options={[
            {
              label: isDeletingAccount ? t('common.loading') : t('account.delete.confirmButton'),
              onClick: handleDeleteAccount,
              className: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
            }
          ]}
        />
      )}
    </div>
  );
}

export default App;