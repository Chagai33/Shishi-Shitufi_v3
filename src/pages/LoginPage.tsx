// src/pages/LoginPage.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { FirebaseService } from '../services/firebaseService';
import { toast } from 'react-hot-toast';
import { LogIn, UserPlus, Eye, EyeOff, ChefHat } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const navigate = useNavigate();

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLoginView) {
        // --- Login logic ---
        await signInWithEmailAndPassword(auth, email, password);
        toast.success('התחברת בהצלחה!');
        navigate('/dashboard');
      } else {
        // --- Registration logic ---
        if (!agreedToTerms) {
          toast.error('יש לאשר את תנאי השימוש ומדיניות הפרטיות.');
          setIsLoading(false);
          return;
        }
        if (!displayName.trim()) {
          toast.error('יש להזין שם להצגה');
          setIsLoading(false);
          return;
        }
        await FirebaseService.createOrganizer(email, password, displayName);
        toast.success('נרשמת בהצלחה! ברוך הבא.');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      let errorMessage = "אירעה שגיאה. אנא נסה שוב.";
      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'אימייל או סיסמה שגויים.';
            break;
          case 'auth/email-already-in-use':
            errorMessage = 'כתובת האימייל כבר בשימוש.';
            break;
          case 'auth/weak-password':
            errorMessage = 'הסיסמה חלשה מדי. נדרשים לפחות 6 תווים.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'כתובת האימייל אינה תקינה.';
            break;
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <ChefHat className="mx-auto h-12 w-12 text-orange-500" />
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
                שישי שיתופי
            </h1>
            <p className="mt-2 text-sm text-gray-600">
                {isLoginView ? 'התחבר לחשבונך כדי לנהל אירועים' : 'צור חשבון חדש והתחל לארגן'}
            </p>
        </div>

        <div className="bg-white p-8 shadow-lg rounded-xl">
          <form onSubmit={handleAuthAction} className="space-y-6">
            {!isLoginView && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  שם להצגה
                </label>
                <div className="mt-1">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                כתובת אימייל
              </label>
              <div className="mt-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                סיסמה
              </label>
              <div className="mt-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLoginView ? "current-password" : "new-password"}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {!isLoginView && (
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <input
                  id="terms-agree"
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="terms-agree" className="text-xs text-gray-600">
                  אני מאשר/ת שקראתי והסכמתי ל
                  <Link to="/terms" target="_blank" className="text-orange-600 hover:underline mx-1">
                    תנאי השימוש
                  </Link>
                  ול
                  <Link to="/privacy" target="_blank" className="text-orange-600 hover:underline mx-1">
                    מדיניות הפרטיות
                  </Link>
                  .
                </label>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || (!isLoginView && !agreedToTerms)}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-orange-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : isLoginView ? (
                  'התחבר'
                ) : (
                  'צור חשבון'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLoginView(!isLoginView)}
              className="text-sm font-medium text-orange-600 hover:text-orange-500"
            >
              {isLoginView ? 'אין לך חשבון? צור אחד' : 'יש לך חשבון? התחבר'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;