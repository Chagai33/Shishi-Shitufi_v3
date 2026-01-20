import React, { useState } from 'react';
import { X, Lock, User, Eye, EyeOff, AlertCircle, Info, UserPlus } from 'lucide-react';
import { signInWithEmailAndPassword, updateProfile } from 'firebase/auth'; // Adding updateProfile
import { auth } from '../../lib/firebase';
import { FirebaseService } from '../../services/firebaseService';
import { useStore } from '../../store/useStore'; // Change
import toast from 'react-hot-toast';

interface AdminLoginProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

export function AdminLogin({ onClose, onSuccess }: AdminLoginProps) {
  const { setUserAdminStatus } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSetupInfo, setShowSetupInfo] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'כתובת אימייל לא תקינה';
    }
    if (!password.trim() || password.length < 6) {
      newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים';
    }
    if (showAdminSetup && !displayName.trim()) {
      newErrors.displayName = 'שם הוא שדה חובה';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const isAdminCheck = await FirebaseService.checkAdminStatus(userCredential.user.uid);
      
      if (!isAdminCheck) {
        setShowAdminSetup(true);
        setIsLoading(false);
        return;
      }
      
      setUserAdminStatus(true);
      toast.success('התחברת בהצלחה כמנהל!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Admin login error:', error);
      let errorMessage = 'פרטי התחברות שגויים';
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/invalid-credential') {
          errorMessage = 'פרטי התחברות שגויים או חשבון מנהל לא קיים';
          setShowSetupInfo(true);
        } else if (firebaseError.code === 'auth/wrong-password') {
          errorMessage = 'סיסמה שגויה';
        } else if (firebaseError.code === 'auth/too-many-requests') {
          errorMessage = 'יותר מדי ניסיונות התחברות. נסה שוב מאוחר יותר';
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupAdmin = async () => {
    if (!displayName.trim()) {
      toast.error('יש להזין שם');
      return;
    }
    if (!auth.currentUser) {
        toast.error('שגיאה: לא זוהה משתמש מחובר');
        return;
    }
    setIsLoading(true);
    try {
      // Update profile in Firebase Auth itself
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      // Add user to admins table in database
      await FirebaseService.addCurrentUserAsAdmin(displayName.trim());
      
      setUserAdminStatus(true);
      toast.success('נוספת בהצלחה כמנהל!');
      onSuccess();
      onClose();
    } catch (error: unknown) {
      console.error('Error setting up admin:', error);
      const message = error instanceof Error ? error.message : 'שגיאה בהוספת המנהל';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'email') setEmail(value);
    else if (field === 'password') setPassword(value);
    else if (field === 'displayName') setDisplayName(value);
    
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="bg-blue-100 rounded-lg p-2"><Lock className="h-5 w-5 text-blue-600" /></div>
            <h2 className="text-lg font-semibold text-gray-900">{showAdminSetup ? 'הגדרת מנהל' : 'התחברות מנהל'}</h2>
          </div>
          <button onClick={onClose} disabled={isLoading} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        {showAdminSetup ? (
          <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <UserPlus className="h-5 w-5 text-blue-600 mt-0.5 ml-2 flex-shrink-0" />
                <div className="text-sm">
                  <h3 className="font-medium text-blue-800 mb-2">הגדרת הרשאות מנהל</h3>
                  <p className="text-blue-700">התחברת בהצלחה, אך עדיין לא הוגדרת כמנהל במערכת. הזן שם להצגה כדי להשלים את ההגדרה.</p>
                </div>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">שם להצגה *</label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" value={displayName} onChange={(e) => handleInputChange('displayName', e.target.value)} placeholder="שם המנהל" className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.displayName ? 'border-red-500' : 'border-gray-300'}`} disabled={isLoading} required />
              </div>
              {errors.displayName && (<p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.displayName}</p>)}
            </div>
            <div className="flex space-x-3 rtl:space-x-reverse">
              <button onClick={handleSetupAdmin} disabled={isLoading || !displayName.trim()} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isLoading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>מגדיר...</>) : ('הגדר כמנהל')}</button>
              <button onClick={() => setShowAdminSetup(false)} disabled={isLoading} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">חזור</button>
            </div>
          </div>
        ) : (
          <>
            {showSetupInfo && (
              <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-amber-600 mt-0.5 ml-2 flex-shrink-0" />
                  <div className="text-sm">
                    <h3 className="font-medium text-amber-800 mb-2">הגדרת חשבון מנהל נדרשת</h3>
                    <div className="text-amber-700 space-y-2">
                      <p>כדי להתחבר כמנהל, יש לבצע את השלבים הבאים:</p>
                      <ol className="list-decimal list-inside space-y-1 mr-4">
                        <li>היכנס ל-Firebase Console</li>
                        <li>עבור ל-Authentication → Sign-in method</li>
                        <li>הפעל את שיטת "Email/Password"</li>
                        <li>עבור ל-Authentication → Users</li>
                        <li>לחץ "Add user" וצור חשבון מנהל</li>
                      </ol>
                      <p className="text-xs mt-2">לאחר יצירת החשבון, תוכל להתחבר עם הפרטים שיצרת.</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowSetupInfo(false)} className="mt-3 text-amber-600 hover:text-amber-800 text-sm font-medium">הבנתי</button>
              </div>
            )}
            <form onSubmit={handleLogin} className="p-6">
              <div className="mb-6"><p className="text-gray-600 text-sm">התחבר עם פרטי המנהל כדי לנהל אירועים ופריטי תפריט</p></div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">אימייל *</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="admin@example.com" className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.email ? 'border-red-500' : 'border-gray-300'}`} disabled={isLoading} required />
                </div>
                {errors.email && (<p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.email}</p>)}
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה *</label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => handleInputChange('password', e.target.value)} placeholder="הזן סיסמה" className={`w-full pr-10 pl-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.password ? 'border-red-500' : 'border-gray-300'}`} disabled={isLoading} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600" disabled={isLoading}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
                {errors.password && (<p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.password}</p>)}
              </div>
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button type="submit" disabled={isLoading || !email.trim() || !password.trim()} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isLoading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>מתחבר...</>) : ('התחבר')}</button>
                <button type="button" onClick={onClose} disabled={isLoading} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">ביטול</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
