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
  const { user: authUser, isLoading: isAuthLoading, logout } = useAuth();
  const { user, isDeleteAccountModalOpen, toggleDeleteAccountModal } = useStore();
  const location = useLocation(); // <-- Get location

  // A guest has no user record any more, so the signed-in identity is the only
  // thing that knows they are here at all.
  const isAnonymousVisitor = !!authUser?.isAnonymous;

  // Account deletion logic
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    // The dialog and the button were already careful not to tell a guest they
    // have an account. These two were not, so the same person read a question
    // about their information, pressed a button about their information, and
    // was then told twice that an account had been deleted - which invites
    // exactly the question the wording was written to avoid: which account?
    toast.loading(
      t(isAnonymousVisitor ? 'account.delete.processingGuest' : 'account.delete.processing'),
      { id: 'delete-toast' }
    );
    try {
      await FirebaseService.deleteCurrentUserAccount();
      toast.success(
        t(isAnonymousVisitor ? 'account.delete.successGuest' : 'account.delete.success'),
        { id: 'delete-toast' }
      );

      // The account is gone on the server, but the browser is still holding a
      // session for it and will keep acting as though it works. Every write
      // after this point fails, with nothing on screen to explain why. Sign
      // out and start the app again from nothing.
      //
      // It matters more for a guest than for anybody else: signing out is also
      // what lets the event page hand them a fresh identity next time, instead
      // of leaving them attached to one that has been deleted.
      await logout();
      window.location.href = '/';
      return;
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
      <Footer isAnonymousVisitor={isAnonymousVisitor} />
      {/* Adding the modal here */}
      {isDeleteAccountModalOpen && (
        <ConfirmationModal
          /* The wording for an account holder describes deleting an account
             and the events they organised. A guest has neither, and what they
             do have - no way back to this identity once it is gone - is the
             part they have to be told before they press the button. */
          message={isAnonymousVisitor
            ? t('account.delete.confirmMessageGuest')
            /* Naming the account, because "your account" is not enough to
               identify one. Somebody signed in as one identity while
               believing they are another gets no signal from the old
               wording, and the button that acts on it sits in the footer of
               every page. It happened, to the one account in the database
               that a guard happens to protect.
               See DOCS/PLANING/39-delete-account-never-says-which-account.md. */
            : t('account.delete.confirmMessage', { email: user?.email || authUser?.email || '' })}
          onClose={toggleDeleteAccountModal}
          options={[
            {
              label: isDeletingAccount
                ? t('common.loading')
                : (isAnonymousVisitor
                  ? t('account.delete.confirmButtonGuest')
                  : t('account.delete.confirmButton')),
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