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
import { useState, useEffect, useId } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { FirebaseService } from './services/firebaseService';

import { useTranslation } from 'react-i18next';



// What the server's answer means, put into words somebody can act on.
//
// It is decided here and not in the service layer because only this screen
// knows whether it is talking to an account holder or to a guest, and telling
// a guest that their account could not be deleted invites exactly the question
// the deletion wording was rewritten to avoid: which account?
//
// Three of these do not say the deletion failed. They say nobody knows. A
// request that timed out, a server that never answered and a connection that
// dropped all arrive here looking the same, and in every one of them the
// deletion may well have gone through. So none of them tells anyone to try
// again, because trying again would be asking somebody to delete twice.
//
// What the server wrote is never shown. It is English only, and for the one
// person whose account has just ceased to exist it says they must be logged
// in, which reads as a wrong password.
// See DOCS/PLANING/19-permission-denied-message.md.
function deleteAccountErrorKey(code: unknown, isGuest: boolean): string {
  switch (code) {
    case 'functions/permission-denied':
      return isGuest ? 'account.delete.errorGuest' : 'account.delete.errorProtected';
    case 'functions/unauthenticated':
      return 'account.delete.errorSessionEnded';
    case 'functions/internal':
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
      return 'account.delete.errorUnconfirmed';
    default:
      return isGuest ? 'account.delete.errorGuest' : 'account.delete.error';
  }
}

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
  const [typedEmail, setTypedEmail] = useState('');
  const confirmEmailId = useId();

  // The address of the account that is about to go. It comes from the signed-in
  // session first, because that is what the server deletes: the stored record
  // is written once at registration and never resynced, so if the two ever
  // disagree the session is the one telling the truth. One expression feeds
  // both the sentence and the field, because naming one address and accepting
  // another would leave the person unable to delete anything at all.
  const accountEmail = authUser?.email || user?.email || '';

  // Typing the address is the guard against deleting the wrong account, and it
  // is the only one most people have: the server protects exactly one account,
  // the super-admin, and everybody else who presses this by mistake loses their
  // events with it. It happened, and only that one guard stopped it.
  // See DOCS/PLANING/39-delete-account-never-says-which-account.md.
  //
  // A guest has no address, so there is nothing to ask them for and nothing
  // here changes for them.
  const mustTypeEmail = !isAnonymousVisitor && accountEmail !== '';
  const typedEmailMatches = typedEmail.trim().toLowerCase() === accountEmail.trim().toLowerCase();
  const canConfirmDelete = !isDeletingAccount && (!mustTypeEmail || typedEmailMatches);
  const showEmailMismatch = mustTypeEmail && !isDeletingAccount && typedEmail.trim() !== '' && !typedEmailMatches;

  // Cleared from the flag rather than from the dialog's own close handler,
  // because the dialog is also closed straight from the block below, which
  // never goes through that handler. Without this, a second attempt would open
  // with the address still typed and the button already unlocked, and the
  // guard would work exactly once.
  useEffect(() => {
    if (!isDeleteAccountModalOpen) setTypedEmail('');
  }, [isDeleteAccountModalOpen]);

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;
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
      toast.error(t(deleteAccountErrorKey(error?.code, isAnonymousVisitor)), { id: 'delete-toast' });
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
            : t('account.delete.confirmMessage', { email: accountEmail })}
          /* Closing is refused while the deletion is running. The flag behind
             this dialog is a toggle rather than a setter, so a Cancel or an
             Escape mid-flight would close it and the block that runs when the
             call finishes would toggle it straight back open, on top of the
             error. Neither one stops the server anyway. */
          onClose={() => { if (!isDeletingAccount) toggleDeleteAccountModal(); }}
          options={[
            {
              label: isDeletingAccount
                ? t('common.loading')
                : (isAnonymousVisitor
                  ? t('account.delete.confirmButtonGuest')
                  : t('account.delete.confirmButton')),
              onClick: handleDeleteAccount,
              disabled: !canConfirmDelete,
              className: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
            }
          ]}
        >
          {mustTypeEmail && (
            <div>
              <label htmlFor={confirmEmailId} className="block text-sm font-medium text-gray-700">
                {t('account.delete.confirmEmailLabel')}
              </label>
              <input
                id={confirmEmailId}
                type="email"
                /* An email address reads left to right whichever way the page
                   does, and a phone would otherwise capitalise the first
                   letter of it by itself. */
                dir="ltr"
                inputMode="email"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canConfirmDelete) handleDeleteAccount(); }}
                aria-describedby={showEmailMismatch ? `${confirmEmailId}-mismatch` : undefined}
                placeholder={t('account.delete.confirmEmailPlaceholder')}
                className="mt-1 w-full px-3 py-2 text-left border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              {showEmailMismatch && (
                <p id={`${confirmEmailId}-mismatch`} className="mt-1 text-xs text-error">
                  {t('account.delete.confirmEmailMismatch')}
                </p>
              )}
            </div>
          )}
        </ConfirmationModal>
      )}
    </div>
  );
}

export default App;