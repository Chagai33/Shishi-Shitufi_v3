import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Users, Mail, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { FirebaseService } from '../../services/firebaseService';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface Admin {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
  createdBy: string;
  isActive: boolean;
  updatedAt?: number;
  updatedBy?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

export function AdminUsersManagement() {
  const { user: currentUser } = useAuth();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });

  useEffect(() => {
    const unsubscribe = FirebaseService.subscribeToAdmins((adminsList) => {
      setAdmins(adminsList);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.email.trim()) { newErrors.email = 'אימייל הוא שדה חובה'; } 
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) { newErrors.email = 'כתובת אימייל לא תקינה'; }
    if (!editingAdmin) {
      if (!formData.password.trim()) { newErrors.password = 'סיסמה היא שדה חובה'; }
      else if (formData.password.length < 6) { newErrors.password = 'הסיסמה חייבת להכיל לפחות 6 תווים'; }
    }
    if (!formData.displayName.trim()) { newErrors.displayName = 'שם הוא שדה חובה'; }
    else if (formData.displayName.trim().length < 2) { newErrors.displayName = 'השם חייב להכיל לפחות 2 תווים'; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) { toast.error('יש לתקן את השגיאות בטופס'); return; }
    setIsSubmitting(true);
    try {
      if (editingAdmin) {
        const success = await FirebaseService.updateAdminUser(editingAdmin.uid, { displayName: formData.displayName.trim() });
        if (success) { toast.success('המנהל עודכן בהצלחה!'); handleCloseForm(); }
      } else {
        const success = await FirebaseService.createAdminUser(formData.email.trim(), formData.password, formData.displayName.trim());
        if (success) { toast.success('המנהל נוצר בהצלחה!'); handleCloseForm(); }
      }
    } catch (error: any) { console.error('Error saving admin:', error); toast.error(error.message || 'שגיאה בשמירת המנהל'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteAdmin = async (admin: Admin) => {
    // --- Check to prevent deletion of super-admin ---
    if (admin.email === 'chagai33@gmail.com') {
      toast.error('לא ניתן למחוק את מנהל המערכת הראשי.');
      return;
    }
    if (admin.uid === currentUser?.uid) { toast.error('לא ניתן למחוק את עצמך.'); return; }
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המנהל "${admin.displayName}"?`)) { return; }
    try {
      const success = await FirebaseService.deleteAdminUser(admin.uid);
      if (success) { toast.success('המנהל נמחק בהצלחה!'); }
    } catch (error: any) { console.error('Error deleting admin:', error); toast.error(error.message || 'שגיאה במחיקת המנהל'); }
  };

  const handleToggleActive = async (admin: Admin) => {
    // --- Check to prevent deactivation of super-admin ---
    if (admin.email === 'chagai33@gmail.com') {
      toast.error('לא ניתן לשנות את הסטטוס של מנהל המערכת הראשי.');
      return;
    }
    if (admin.uid === currentUser?.uid) { toast.error('לא ניתן לשנות את הסטטוס של עצמך.'); return; }
    try {
      const success = await FirebaseService.updateAdminUser(admin.uid, { isActive: !admin.isActive });
      if (success) { toast.success(`המנהל ${admin.isActive ? 'הושבת' : 'הופעל'} בהצלחה!`); }
    } catch (error: any) { console.error('Error toggling admin status:', error); toast.error(error.message || 'שגיאה בעדכון סטטוס המנהל'); }
  };

  const handleCloseForm = () => { setShowAddForm(false); setEditingAdmin(null); setFormData({ email: '', password: '', displayName: '' }); setErrors({}); };
  const handleEditAdmin = (admin: Admin) => { setEditingAdmin(admin); setFormData({ email: admin.email, password: '', displayName: admin.displayName }); setShowAddForm(true); };
  const handleInputChange = (field: keyof typeof formData, value: string) => { setFormData(prev => ({ ...prev, [field]: value })); if (errors[field as keyof FormErrors]) { setErrors(prev => ({ ...prev, [field]: undefined })); } };

  return (
    <div>
      {/* Header - No Change */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3 rtl:space-x-reverse"><div className="bg-purple-100 rounded-lg p-2"><Shield className="h-5 w-5 text-purple-600" /></div><div><h3 className="text-lg font-semibold text-gray-900">ניהול מנהלים</h3><p className="text-sm text-gray-600">הוספה, עריכה ומחיקה של משתמשי מנהל</p></div></div>
        <button onClick={() => setShowAddForm(true)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 rtl:space-x-reverse transition-colors"><Plus className="h-4 w-4" /><span>מנהל חדש</span></button>
      </div>
      
      {/* Admins List Table - No Change */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {isLoading ? ( <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div><p className="text-gray-600">טוען רשימת מנהלים...</p></div> ) : admins.length === 0 ? ( <div className="p-8 text-center"><div className="bg-gray-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4"><Users className="h-8 w-8 text-gray-400" /></div><h3 className="text-lg font-medium text-gray-900 mb-2">אין מנהלים</h3><p className="text-gray-500 mb-4">התחל על ידי הוספת המנהל הראשון</p><button onClick={() => setShowAddForm(true)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">הוסף מנהל ראשון</button></div> ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">אימייל</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סטטוס</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">נוצר</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">פעולות</th></tr></thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.map((admin) => (
                  <tr key={admin.uid} className={admin.uid === currentUser?.uid ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4"><div className="flex items-center"><div className="bg-purple-100 rounded-full h-8 w-8 flex items-center justify-center ml-3"><Shield className="h-4 w-4 text-purple-600" /></div><div><p className="font-medium text-gray-900">{admin.displayName}</p>{admin.uid === currentUser?.uid && ( <p className="text-xs text-blue-600">זה אתה</p> )}</div></div></td>
                    <td className="px-6 py-4"><div className="flex items-center text-gray-600"><Mail className="h-4 w-4 ml-2" /><span className="text-sm">{admin.email}</span></div></td>
                    <td className="px-6 py-4"><div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${admin.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{admin.isActive ? ( <><CheckCircle className="h-3 w-3 ml-1" />פעיל</> ) : ( <><AlertCircle className="h-3 w-3 ml-1" />מושבת</> )}</div></td>
                    <td className="px-6 py-4 text-sm text-gray-600">{new Date(admin.createdAt).toLocaleDateString('he-IL')}</td>
                    <td className="px-6 py-4"><div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <button onClick={() => handleEditAdmin(admin)} className="p-1 text-blue-600 hover:text-blue-700" title="ערוך"><Edit className="h-4 w-4" /></button>
                      {admin.uid !== currentUser?.uid && (
                        <>
                          <button onClick={() => handleToggleActive(admin)} className={`p-1 ${admin.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`} title={admin.isActive ? 'השבת' : 'הפעל'}>{admin.isActive ? <AlertCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
                          <button onClick={() => handleDeleteAdmin(admin)} className="p-1 text-red-600 hover:text-red-700" title="מחק"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Form - No Change */}
      {showAddForm && ( <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-xl shadow-xl max-w-md w-full"><div className="flex items-center justify-between p-6 border-b"><h2 className="text-lg font-semibold text-gray-900">{editingAdmin ? 'עריכת מנהל' : 'מנהל חדש'}</h2><button onClick={handleCloseForm} disabled={isSubmitting} className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"><Plus className="h-5 w-5 rotate-45" /></button></div><form onSubmit={handleSubmit} className="p-6"><div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-2">שם מלא *</label><input type="text" value={formData.displayName} onChange={(e) => handleInputChange('displayName', e.target.value)} placeholder="שם המנהל" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.displayName ? 'border-red-500' : 'border-gray-300'}`} disabled={isSubmitting} required />{errors.displayName && ( <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.displayName}</p> )}</div><div className="mb-4"><label className="block text-sm font-medium text-gray-700 mb-2">אימייל *</label><input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="admin@example.com" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.email ? 'border-red-500' : 'border-gray-300'}`} disabled={isSubmitting || !!editingAdmin} required />{errors.email && ( <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.email}</p> )}{editingAdmin && ( <p className="mt-1 text-xs text-gray-500">לא ניתן לשנות כתובת אימייל של מנהל קיים</p> )}</div>{!editingAdmin && ( <div className="mb-6"><label className="block text-sm font-medium text-gray-700 mb-2">סיסמה *</label><input type="password" value={formData.password} onChange={(e) => handleInputChange('password', e.target.value)} placeholder="לפחות 6 תווים" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${errors.password ? 'border-red-500' : 'border-gray-300'}`} disabled={isSubmitting} required />{errors.password && ( <p className="mt-1 text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 ml-1" />{errors.password}</p> )}</div> )}<div className="flex space-x-3 rtl:space-x-reverse"><button type="submit" disabled={isSubmitting} className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center">{isSubmitting ? ( <> <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>{editingAdmin ? 'מעדכן...' : 'יוצר...'}</> ) : ( editingAdmin ? 'עדכן מנהל' : 'צור מנהל' )}</button><button type="button" onClick={handleCloseForm} disabled={isSubmitting} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50">ביטול</button></div></form></div></div> )}
    </div>
  );
}