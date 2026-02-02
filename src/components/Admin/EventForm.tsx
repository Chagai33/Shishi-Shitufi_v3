// src/components/Admin/EventForm.tsx
import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText, AlertCircle, LayoutTemplate, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { TEMPLATES, EVENT_PRESETS } from '../../constants/templates';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, EventDetails, EventType } from '../../types';
import { getNextFriday } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import FocusTrap from 'focus-trap-react';
import { CategoryEditor } from './CategoryEditor'; // NEW Import
import { ImportItemsModal } from './ImportItemsModal'; // NEW Import


interface EventFormProps {
  event?: ShishiEvent;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormErrors {
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  hostName?: string;
  endDate?: string;
}

export function EventForm({ event, onClose, onSuccess }: EventFormProps) {
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.uid;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Accessibility: IDs and refs
  const titleId = useId();
  const formTitleId = useId();
  const dateId = useId();
  const timeId = useId();
  const endDateId = useId();
  const endTimeId = useId();
  const locationId = useId();
  const hostNameId = useId();
  const descriptionId = useId();
  const isActiveId = useId();
  const allowUserItemsId = useId();
  const userItemLimitId = useId();
  const titleErrorId = useId();
  const dateErrorId = useId();
  const timeErrorId = useId();
  const endDateErrorId = useId();
  const locationErrorId = useId();
  const hostNameErrorId = useId();
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ESC handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, isSubmitting]);

  // Focus return
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    return () => {
      returnFocusRef.current?.focus();
    };
  }, []);

  const [formData, setFormData] = useState({
    title: event?.details.title || '',
    date: event?.details.date || getNextFriday(),
    time: event?.details.time || '19:00',
    location: event?.details.location || '',
    description: event?.details.description || '',
    hostName: event?.organizerName || authUser?.displayName || '',
    isActive: event?.details.isActive ?? true,
    endDate: event?.details.endDate || '',
    endTime: event?.details.endTime || '',
    allowUserItems: event?.details.allowUserItems ?? true, // Default: enabled
    userItemLimit: event?.details.userItemLimit || 3, // Default: 3
    categories: event?.details.categories || TEMPLATES['DEFAULT'].categories,
  });

  // Custom Templates State
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  useEffect(() => {
    if (authUser?.uid) {
      loadCustomTemplates();
    }
  }, [authUser?.uid]);

  const loadCustomTemplates = async () => {
    if (!authUser?.uid) return;
    try {
      const templates = await FirebaseService.getUserTemplates(authUser.uid);
      setCustomTemplates(templates);
    } catch (error) {
      console.error('Failed to load templates', error);
    }
  };

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent selection
    if (!window.confirm('האם אתה בטוח שברצונך למחוק תבנית זו?')) return;

    try {
      if (authUser?.uid) {
        await FirebaseService.deleteCustomTemplate(authUser.uid, templateId);
        toast.success('התבנית נמחקה');
        loadCustomTemplates();
      }
    } catch (error) {
      toast.error('שגיאה במחיקת התבנית');
    }
  };

  const [migrationData, setMigrationData] = useState<string | null>(null);
  const [showImportForMigration, setShowImportForMigration] = useState(false);
  const [migrationStartTime, setMigrationStartTime] = useState<number>(0);

  // Template Selector UI State
  const [isExpanded, setIsExpanded] = useState(false);



  const handleTemplateChange = (templateKey: string, isCustom = false) => {
    let template;

    if (isCustom) {
      template = customTemplates.find(t => t.id === templateKey);
    } else {
      // @ts-ignore
      template = EVENT_PRESETS[templateKey as EventType] || TEMPLATES[templateKey];
    }

    if (!template) return;

    if (event && event.menuItems && Object.keys(event.menuItems).length > 0) {
      // Confirm template switch for existing events with items
      if (window.confirm('שינוי סוג האירוע ישנה את מבנה הקטגוריות. האם תרצה להשתמש ב"הגירה חכמה" (Smart Migration) כדי לסדר את הפריטים מחדש?\n\nאישור: מחיקת פריטים ופתיחת ייבוא חכם.\nביטול: שמירה על הפריטים (יעברו לקטגוריה "כללי").')) {
        // Smart Migration Flow
        const itemsList = Object.values(event.menuItems).map(item => `${item.name} ${item.quantity}`).join('\n');

        setMigrationData(itemsList);
        setMigrationStartTime(Date.now());
        setShowImportForMigration(true); // Flag to open import modal after save (conceptually, or we handle it via onSuccess wrapper)

        // In this specific flow, we are actually modifying the form state first.
        // The actual "Action" needs to happen when the user clicks SAVE. 
        // But the user expects the "Smart Migration" to be a distinct flow.
        // Let's defer the action to handleSubmit by carrying the `migrationData` state.
      }
    }

    setFormData(prev => ({ ...prev, categories: template.categories }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'שם האירוע הוא שדה חובה';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'שם האירוע חייב להכיל לפחות 3 תווים';
    }

    if (!formData.date) {
      newErrors.date = 'תאריך הוא שדה חובה';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today && !event) { // Allow editing past events, but not creating them
        newErrors.date = 'לא ניתן ליצור אירוע בתאריך שעבר';
      }
    }

    if (!formData.time) {
      newErrors.time = 'שעה היא שדה חובה';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'מיקום הוא שדה חובה';
    } else if (formData.location.trim().length < 3) {
      newErrors.location = 'המיקום חייב להכיל לפחות 3 תווים';
    }

    if (!formData.hostName.trim()) {
      newErrors.hostName = 'שם המארח הוא שדה חובה';
    } else if (formData.hostName.trim().length < 2) {
      newErrors.hostName = 'שם המארח חייב להכיל לפחות 2 תווים';
    }

    if (formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
      newErrors.endDate = 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה';
    } else if (formData.endDate && formData.endTime && formData.endDate === formData.date && formData.endTime < formData.time) {
      newErrors.endDate = 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin || !authUser) {
      toast.error('רק מנהלים יכולים ליצור ולערוך אירועים.');
      return;
    }

    if (!validateForm()) {
      toast.error('יש לתקן את השגיאות בטופס');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. If Migration Logic is active: Delete ALL existing items first
      // CORRECTION: With "Atomic Save", we DO NOT delete here. 
      // We wait for the ImportItemsModal to call replaceAllMenuItems.
      // So this block is removed or commented out.
      /* 
      if (migrationData && event) {
        await FirebaseService.deleteAllEventItems(event.id);
      } 
      */

      const eventDetails: EventDetails = {
        title: formData.title.trim(),
        date: formData.date,
        time: formData.time,
        location: formData.location.trim(),
        isActive: formData.isActive,
        allowUserItems: formData.allowUserItems,
        userItemLimit: formData.allowUserItems ? formData.userItemLimit : 0,
        categories: formData.categories,
        ...(formData.description.trim() ? { description: formData.description.trim() } : {}),
        ...(formData.endDate ? { endDate: formData.endDate } : {}),
        ...(formData.endTime ? { endTime: formData.endTime } : {}),
      };

      if (event) {
        // Update existing event
        await FirebaseService.updateEventDetails(event.id, eventDetails);
        toast.success(migrationData ? 'התבנית שונתה! פותח חלון ייבוא...' : 'האירוע עודכן בהצלחה!');

        if (migrationData) {
          // DO NOT close form. Open Import Modal instead.
          // But validation: we need to trigger this AFTER the render update.
          // Since we use 'showImportForMigration' state, it should handled in JSX.
          onSuccess?.(); // Optional: refresh parent
        } else {
          onSuccess?.();
          onClose();
        }
      } else {
        // Create new event
        const eventId = await FirebaseService.createEvent(authUser.uid, eventDetails);
        if (eventId) {
          toast.success('האירוע נוצר בהצלחה!');
          onSuccess?.();
          onClose();
        } else {
          throw new Error('Failed to create event');
        }
      }
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(event ? 'שגיאה בעדכון האירוע. אנא נסה שוב.' : 'שגיאה ביצירת האירוע. אנא נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number | boolean | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isAdmin) {
    return (
      <FocusTrap>
        <div role="presentation" onClick={onClose}>
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => e.stopPropagation()}>
            <div role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
              <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <AlertCircle className="h-8 w-8 text-red-600" aria-hidden="true" />
              </div>
              <h2 id={titleId} className="text-lg font-semibold text-gray-900 mb-4">גישה מוגבלת</h2>
              <p className="text-gray-600 mb-4">רק מנהלים יכולים ליצור ולערוך אירועים</p>
              <button
                type="button"
                onClick={onClose}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      </FocusTrap>
    );
  }

  return (
    <div role="presentation" onClick={onClose}>
      <FocusTrap>
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={formTitleId}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 id={formTitleId} className="text-lg font-semibold text-gray-900">
                {event ? 'עריכת אירוע' : 'אירוע חדש'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label="סגור"
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6">

              {/* Import Modal Integration for Smart Migration */}
              {showImportForMigration && event && migrationData && (
                <ImportItemsModal
                  event={event} // Passed full event
                  onClose={() => {
                    setShowImportForMigration(false);
                    onClose(); // Close the main form too when they are done
                  }}
                  categoriesOverride={formData.categories} // Use the NEW categories
                  initialText={migrationData}
                  autoRunAI={true} // Auto trigger AI
                  migrationStartTime={migrationStartTime} // For concurrency handling
                />
              )}

              {/* Template Selector */}
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-blue-900 flex items-center">
                    <LayoutTemplate className="w-4 h-4 ml-2" />
                    סוג אירוע
                  </label>

                  {/* Save Template Button - Top Left */}
                  {authUser && (
                    <button
                      type="button"
                      onClick={async () => {
                        const name = window.prompt('הכנס שם לתבנית החדשה:');
                        if (!name || !name.trim()) return;

                        try {
                          // @ts-ignore
                          await FirebaseService.saveCustomTemplate(authUser.uid, name.trim(), formData.categories);
                          toast.success('התבנית נשמרה!');
                          loadCustomTemplates(); // Immediate refresh
                        } catch (error: any) {
                          toast.error(error.message || 'שגיאה בשמירה');
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 transition-colors"
                      title="שמור תבנית אישית"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 transition-all duration-300">
                  {/* Logic: Show top 3 (Friday, BBQ, Picnic) + Expand Button */}
                  {(() => {
                    const allPresets = (Object.entries(EVENT_PRESETS) as [EventType, typeof EVENT_PRESETS[EventType]][]);
                    // Top 3 common ones
                    const topPresets = allPresets.filter(([key]) =>
                      [EventType.FRIDAY_DINNER, EventType.BBQ, EventType.PICNIC].includes(key)
                    );

                    // If expanded, show everything. If not, show Top 3.
                    const visibleSystemTemplates = isExpanded ? allPresets : topPresets;

                    // If we are selecting a template that is HIDDEN, we should probably auto-expand or show it.
                    // But for simplicity, let's keep the user control.

                    return (
                      <>
                        {visibleSystemTemplates.map(([key, template]) => (
                          <button
                            type="button"
                            key={key}
                            onClick={() => handleTemplateChange(key)}
                            className={`p-3 rounded-lg border text-right transition-all hover:shadow-md flex flex-col items-center gap-2
                                ${JSON.stringify(formData.categories) === JSON.stringify(template.categories)
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                : 'border-gray-200 hover:border-indigo-300'
                              }`}
                          >
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-xl border border-gray-100">
                              {key === EventType.FRIDAY_DINNER ? '🍷' :
                                key === EventType.BBQ ? '🥩' :
                                  key === EventType.PICNIC ? '🧺' :
                                    key === EventType.SCHOOL_PARTY ? '🎒' :
                                      key === EventType.PARTY ? '🎉' :
                                        key === EventType.DAIRY ? '🧀' :
                                          key === EventType.OTHER ? '🚫' : '✨'}
                            </div>
                            <span className="text-sm font-medium text-gray-700 text-center">{template.name}</span>
                          </button>
                        ))}

                        {/* Custom Templates (Only show if expanded OR if selected is custom) */}
                        {isExpanded && customTemplates.map((template) => (
                          <div
                            key={template.id}
                            onClick={() => handleTemplateChange(template.id, true)}
                            className={`cursor-pointer relative p-3 rounded-lg border text-right transition-all hover:shadow-md flex flex-col items-center gap-2 group
                              ${JSON.stringify(formData.categories) === JSON.stringify(template.categories)
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                : 'border-gray-200 hover:border-indigo-300'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTemplate(template.id, e)}
                              className="absolute top-1 left-1 p-1 text-gray-400 hover:text-red-500 transition-colors"
                              title="מחק תבנית"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shadow-sm text-xl border border-indigo-200">
                              ✨
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate w-full text-center">{template.name}</span>
                          </div>
                        ))}

                        {/* Expand/Collapse Button */}
                        <button
                          type="button"
                          onClick={() => setIsExpanded(!isExpanded)}
                          className="p-3 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-all flex flex-col items-center justify-center gap-2"
                        >
                          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                          <span className="text-xs font-medium">
                            {isExpanded ? 'פחות אפשרויות' : 'עוד אפשרויות...'}
                          </span>
                        </button>
                      </>
                    );
                  })()}
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  בחירת תבנית תגדיר מראש את הקטגוריות לאירוע.
                </p>
              </div>

              {/* Custom Categories Editor - NEW */}
              <div className="mb-6 border-b border-gray-200 pb-6">
                <CategoryEditor
                  categories={formData.categories}
                  onChange={(newCats) => setFormData(prev => ({ ...prev, categories: newCats }))}
                />
              </div>

              {/* Title */}
              <div className="mb-6">
                <label htmlFor={titleId} className="block text-sm font-medium text-gray-700 mb-2">
                  כותרת האירוע *
                </label>
                <div className="relative">
                  <FileText className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={titleId}
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="שישי שיתופי בקהילה"
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.title ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.title ? 'true' : 'false'}
                    aria-describedby={errors.title ? titleErrorId : undefined}
                  />
                </div>
                {errors.title && (
                  <p id={titleErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor={dateId} className="block text-sm font-medium text-gray-700 mb-2">
                    תאריך התחלה *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <input
                      id={dateId}
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.date ? 'border-red-500' : 'border-gray-300'
                        }`}
                      disabled={isSubmitting}
                      required
                      aria-required="true"
                      aria-invalid={errors.date ? 'true' : 'false'}
                      aria-describedby={errors.date ? dateErrorId : undefined}
                    />
                  </div>
                  {errors.date && (
                    <p id={dateErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                      {errors.date}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor={timeId} className="block text-sm font-medium text-gray-700 mb-2">
                    שעת התחלה *
                  </label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <input
                      id={timeId}
                      type="time"
                      value={formData.time}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.time ? 'border-red-500' : 'border-gray-300'
                        }`}
                      disabled={isSubmitting}
                      required
                      aria-required="true"
                      aria-invalid={errors.time ? 'true' : 'false'}
                      aria-describedby={errors.time ? timeErrorId : undefined}
                    />
                  </div>
                  {errors.time && (
                    <p id={timeErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                      {errors.time}
                    </p>
                  )}
                </div>
              </div>

              {/* End Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label htmlFor={endDateId} className="block text-sm font-medium text-gray-700 mb-2">תאריך סיום (אופציונלי)</label>
                  <div className="relative">
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <input
                      id={endDateId}
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={isSubmitting}
                      aria-invalid={errors.endDate ? 'true' : 'false'}
                      aria-describedby={errors.endDate ? endDateErrorId : undefined}
                    />
                  </div>
                  {errors.endDate && (
                    <p id={endDateErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                      {errors.endDate}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor={endTimeId} className="block text-sm font-medium text-gray-700 mb-2">שעת סיום (אופציונלי)</label>
                  <div className="relative">
                    <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                    <input
                      id={endTimeId}
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleInputChange('endTime', e.target.value)}
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.endDate ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={isSubmitting || !formData.endDate}
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <label htmlFor={locationId} className="block text-sm font-medium text-gray-700 mb-2">
                  מיקום *
                </label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={locationId}
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="כתובת או שם המקום"
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.location ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.location ? 'true' : 'false'}
                    aria-describedby={errors.location ? locationErrorId : undefined}
                  />
                </div>
                {errors.location && (
                  <p id={locationErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                    {errors.location}
                  </p>
                )}
              </div>

              {/* Host Name */}
              <div className="mb-6">
                <label htmlFor={hostNameId} className="block text-sm font-medium text-gray-700 mb-2">
                  שם המארח *
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
                  <input
                    id={hostNameId}
                    type="text"
                    value={formData.hostName}
                    onChange={(e) => handleInputChange('hostName', e.target.value)}
                    placeholder="שם המארח"
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.hostName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    disabled={isSubmitting}
                    required
                    aria-required="true"
                    aria-invalid={errors.hostName ? 'true' : 'false'}
                    aria-describedby={errors.hostName ? hostNameErrorId : undefined}
                  />
                </div>
                {errors.hostName && (
                  <p id={hostNameErrorId} role="alert" className="mt-1 text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-4 w-4 ml-1" aria-hidden="true" />
                    {errors.hostName}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <label htmlFor={descriptionId} className="block text-sm font-medium text-gray-700 mb-2">
                  תיאור (אופציונלי)
                </label>
                <textarea
                  id={descriptionId}
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="פרטים נוספים על האירוע..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Active Status */}
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    id={isActiveId}
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="mr-2 text-sm text-gray-700">האירוע פעיל</span>
                </label>
                <p className="text-xs text-gray-500 mt-1" id={`${isActiveId}-help`}>
                  רק אירועים פעילים מאפשרים שיבוצים חדשים
                </p>
              </div>
              <div className="border-t pt-6 mb-6">
                <label className="flex items-center">
                  <input
                    id={allowUserItemsId}
                    type="checkbox"
                    checked={formData.allowUserItems}
                    onChange={(e) => handleInputChange('allowUserItems', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="mr-2 text-sm text-gray-700">אפשר למשתתפים להוסיף פריטים בעצמם</span>
                </label>
                {formData.allowUserItems && (
                  <div className="mt-4 mr-6">
                    <label htmlFor={userItemLimitId} className="block text-sm font-medium text-gray-700 mb-2">
                      מגבלת פריטים למשתמש
                    </label>
                    <input
                      id={userItemLimitId}
                      type="number"
                      min="1"
                      max="10"
                      value={formData.userItemLimit}
                      onChange={(e) => handleInputChange('userItemLimit', parseInt(e.target.value) || 1)}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" aria-hidden="true"></div>
                      שומר...
                    </>
                  ) : (
                    event ? 'עדכן אירוע' : 'צור אירוע'
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}