// src/pages/LoginPage.tsx

import React, { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { FirebaseService } from '../services/firebaseService';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/Common/LanguageSwitcher';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  // Three named states, and not one flag with an opposite. The screen had two,
  // and every place that asked for "not login" meant "register". With a third
  // state those places would have shown the display name field, the terms
  // checkbox, and a submit button locked behind them, to somebody who only
  // asked to be sent a reset link.
  const [view, setView] = useState<'login' | 'register' | 'reset'>('login');
  const [resetRequested, setResetRequested] = useState(false);
  const isLoginView = view === 'login';
  const isRegisterView = view === 'register';
  const isResetView = view === 'reset';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const navigate = useNavigate();

  // Accessibility IDs
  const emailId = useId();
  const passwordId = useId();
  const displayNameId = useId();

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isResetView) {
        // --- Password reset logic ---
        // The service answers the same way whether or not the address is
        // registered, so this branch has nothing to decide.
        await FirebaseService.sendPasswordReset(email);
        setResetRequested(true);
      } else if (isLoginView) {
        // --- Login logic ---
        await signInWithEmailAndPassword(auth, email, password);
        toast.success(t('login.messages.loginSuccess'));
        navigate('/dashboard');
      } else {
        // --- Registration logic ---
        if (!agreedToTerms) {
          toast.error(t('login.messages.termsRequired'));
          setIsLoading(false);
          return;
        }
        if (!displayName.trim()) {
          toast.error(t('login.messages.displayNameRequired'));
          setIsLoading(false);
          return;
        }
        await FirebaseService.createOrganizer(email, password, displayName);
        toast.success(t('login.messages.registerSuccess'));
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      let errorMessage = t('common.errors.general');
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = t('login.messages.authErrors.invalidCredential');
            break;
          case 'auth/email-already-in-use':
            errorMessage = t('login.messages.authErrors.emailInUse');
            break;
          case 'auth/weak-password':
            errorMessage = t('login.messages.authErrors.weakPassword');
            break;
          case 'auth/invalid-email':
            errorMessage = t('login.messages.authErrors.invalidEmail');
            break;
          case 'auth/too-many-requests':
            errorMessage = t('login.messages.authErrors.tooManyRequests');
            break;
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const backToLogin = () => {
    setView('login');
    setResetRequested(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 relative">
      <div className="absolute top-4 left-4 rtl:left-auto rtl:right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <ChefHat className="mx-auto h-12 w-12 text-accent" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
            {t('header.title')}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isResetView
              ? t('login.reset.subtitle')
              : isLoginView
                ? t('login.subtitle.login')
                : t('login.subtitle.register')}
          </p>
        </div>

        <div className="bg-white p-8 shadow-lg rounded-xl">
          {/* Once the request has gone out the form is replaced and not left
              standing next to a confirmation, so that nobody sends the same
              mail four times while waiting for the first one. */}
          {isResetView && resetRequested ? (
            // Announced, because this replaces the form rather than joining
            // it: without a live region somebody using a screen reader presses
            // the button and hears nothing at all.
            <p role="status" className="text-sm leading-relaxed text-gray-700">
              {t('login.reset.sent')}
            </p>
          ) : (
          <form onSubmit={handleAuthAction} className="space-y-6">
            {isRegisterView && (
              <div>
                <label htmlFor={displayNameId} className="block text-sm font-medium text-gray-700">
                  {t('login.fields.displayName')}
                </label>
                <div className="mt-1">
                  <input
                    id={displayNameId}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor={emailId} className="block text-sm font-medium text-gray-700">
                {t('login.fields.email')}
              </label>
              <div className="mt-1">
                <input
                  id={emailId}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {/* Taken off the page and not merely hidden. The field is marked
                required, and a required field the person cannot see stops the
                browser from submitting while pointing at nothing: a button
                that is pressed and does nothing at all. */}
            {!isResetView && (
              <div>
                <label htmlFor={passwordId} className="block text-sm font-medium text-gray-700">
                  {t('login.fields.password')}
                </label>
                <div className="mt-1 relative">
                  <input
                    id={passwordId}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isLoginView ? "current-password" : "new-password"}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                  </button>
                </div>
                {isLoginView && (
                  <div className="mt-2 text-end">
                    <button
                      type="button"
                      onClick={() => {
                        setResetRequested(false);
                        setView('reset');
                      }}
                      className="text-sm font-medium text-accent hover:text-accent/80 focus:outline-none focus:underline"
                    >
                      {t('login.forgotPassword')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isRegisterView && (
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <input
                  id="terms-agree"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="h-4 w-4 text-accent border-gray-300 rounded focus:ring-accent"
                />
                <label htmlFor="terms-agree" className="text-xs text-gray-600">
                  {t('login.terms.agree')}
                  <Link to="/terms" target="_blank" className="text-accent hover:underline mx-1">
                    {t('login.terms.terms')}
                  </Link>
                  {t('login.terms.and')}
                  <Link to="/privacy" target="_blank" className="text-accent hover:underline mx-1">
                    {t('login.terms.privacy')}
                  </Link>
                  .
                </label>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || (isRegisterView && !agreedToTerms)}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-accent-dark hover:bg-accent-dark/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:bg-accent/40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : isResetView ? (
                  t('login.reset.submit')
                ) : isLoginView ? (
                  t('login.submit.login')
                ) : (
                  t('login.submit.register')
                )}
              </button>
            </div>
          </form>
          )}

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={isResetView ? backToLogin : () => setView(isLoginView ? 'register' : 'login')}
              className="text-sm font-medium text-accent hover:text-accent/80 focus:outline-none focus:underline"
            >
              {isResetView
                ? t('login.reset.back')
                : isLoginView
                  ? t('login.toggle.toRegister')
                  : t('login.toggle.toLogin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;