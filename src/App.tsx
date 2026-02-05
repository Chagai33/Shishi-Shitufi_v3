// src/App.tsx

import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useStore } from './store/useStore';

import DashboardPage from './pages/DashboardPage';
import EventPage from './pages/EventPage';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import LoadingSpinner from './components/Common/LoadingSpinner';

import { Footer } from './components/Layout/Footer';
import { Header } from './components/Layout/Header'; // <-- Import Header
import TermsPage from './pages/TermsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import { ConfirmationModal } from './components/Admin/ConfirmationModal';
import { useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FirebaseService } from './services/firebaseService';

import { useTranslation } from 'react-i18next';



function App() {
  const { t } = useTranslation();
  const { isLoading: isAuthLoading } = useAuth();
  const { user, isDeleteAccountModalOpen, toggleDeleteAccountModal } = useStore();
  const location = useLocation(); // <-- Get location

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

  // Decide when to show global header
  // Hide on Landing Page ('/') and Login Page ('/login')
  // Show on all others (Dashboard, Event, Terms, Privacy)
  const shouldShowHeader = !['/', '/login'].includes(location.pathname);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />

      {shouldShowHeader && <Header />}

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