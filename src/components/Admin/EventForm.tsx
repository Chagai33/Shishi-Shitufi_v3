// src/components/Admin/EventForm.tsx
import React, { useState, useEffect, useRef, useId } from 'react';
import { X, Calendar, Clock, MapPin, User, FileText, AlertCircle, LayoutTemplate, Trash2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { TEMPLATES, EVENT_PRESETS } from '../../constants/templates';
import { useAuth } from '../../hooks/useAuth';
import { FirebaseService } from '../../services/firebaseService';
import { ShishiEvent, EventDetails, EventType, CategoryConfig } from '../../types';
import { getNextFriday } from '../../utils/dateUtils';
import toast from 'react-hot-toast';
import FocusTrap from 'focus-trap-react';
import { CategoryEditor } from './CategoryEditor';
import { ImportItemsModal } from './ImportItemsModal';
import { ConfirmationModal } from './ConfirmationModal';

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
  const allowRideOffersId = useId();
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
    allowUserItems: event?.details.allowUserItems ?? true,
    allowRideOffers: event?.details.allowRideOffers ?? true,
    allowRideRequests: event?.details.allowRideRequests ?? false,
    userItemLimit: event?.details.userItemLimit || 3,
    categories: event?.details.categories || TEMPLATES['DEFAULT'].categories,
  });

  // Custom Templates State
  const [customTemplates, setCustomTemplates] = useState<any[]>([]);

  const loadCustomTemplates = async () => {
    if (!authUser?.uid) return;
    try {
      const templates = await FirebaseService.getUserTemplates(authUser.uid);
      setCustomTemplates(templates);
    } catch (error) {
      console.error('Failed to load templates', error);
    }
  };

  useEffect(() => {
    if (authUser?.uid) {
      loadCustomTemplates();
    }
  }, [authUser?.uid]);

  const handleDeleteTemplate = async (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setActiveModal({
      type: 'confirm',
      title: 'מחיקת תבנית',
      message: 'האם אתה בטוח שברצונך למחוק תבנית זו?',
      onConfirm: async () => {
        try {
          if (authUser?.uid) {
            await FirebaseService.deleteCustomTemplate(authUser.uid, templateId);
            toast.success('התבנית נמחקה');
            loadCustomTemplates();
          }
        } catch (error) {
          toast.error('שגיאה במחיקת התבנית');
        } finally {
          setActiveModal(null);
        }
      }
    });
  };

  const [migrationData, setMigrationData] = useState<string | null>(null);
  const [showImportForMigration, setShowImportForMigration] = useState(false);
  const [migrationStartTime, setMigrationStartTime] = useState<number>(0);

  // Confirmation Modal State
  const [activeModal, setActiveModal] = useState<{
    type: 'confirm' | 'prompt' | 'migration';
    message: string;
    onConfirm: (value?: string) => void;
    title?: string;
    confirmLabel?: string;
    secondaryLabel?: string;
    onSecondary?: () => void;
  } | null>(null);

  const [templateName, setTemplateName] = useState('');

  // Template Selector UI State
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to deeply compare categories, ignoring irrelevant fields or order issues
  const areCategoriesEqual = (cats1: CategoryConfig[], cats2: CategoryConfig[]) => {
    if (cats1.length !== cats2.length) return false;
    const sorted1 = [...cats1].sort((a, b) => a.id.localeCompare(b.id));
    const sorted2 = [...cats2].sort((a, b) => a.id.localeCompare(b.id));

    return sorted1.every((c1, index) => {
      const c2 = sorted2[index];
      return c1.id === c2.id &&
        c1.name === c2.name &&
        c1.icon === c2.icon &&
        c1.color === c2.color &&
        c1.order === c2.order;
    });
  };

  const handleTemplateChange = (templateKey: string, isCustom = false) => {
    let template: any;

    if (isCustom) {
      template = customTemplates.find(t => t.id === templateKey);
    } else {
      // @ts-ignore
      template = EVENT_PRESETS[templateKey as EventType] || TEMPLATES[templateKey];
    }

    if (!template) return;

    const applyTemplate = () => {
      setFormData(prev => ({ ...prev, categories: template.categories }));
      // Migration logic is now handled in handleSubmit
    };

    // Check for unsaved changes (dirty) before switching
    const isModified = (() => {
      // Check against current template (if any)
      const currentPreset = (Object.values(EVENT_PRESETS)).find(p =>
        areCategoriesEqual(p.categories, formData.categories)
      );

      if (currentPreset) return false;

      const currentCustom = customTemplates.find(t =>
        areCategoriesEqual(t.categories, formData.categories)
      );

      if (currentCustom) return false;

      return true;
    })();

    if (isModified) {
      setActiveModal({
        type: 'confirm',
        title: 'שינויים לא שמורים',
        message: 'ביצעת שינויים בקטגוריות שלא נשמרו.\nהאם אתה בטוח שברצונך לעבור סוג אירוע? השינויים יאבדו.',
        onConfirm: () => {
          applyTemplate();
          setActiveModal(null);
        }
      });
      return;
    }

    applyTemplate();
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
      if (selectedDate < today && !event) {
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
      const eventDetails: EventDetails = {
        title: formData.title.trim(),
        date: formData.date,
        time: formData.time,
        location: formData.location.trim(),
        isActive: formData.isActive,
        allowUserItems: formData.allowUserItems,
        allowRideOffers: formData.allowRideOffers,
        allowRideRequests: formData.allowRideRequests,
        userItemLimit: formData.allowUserItems ? formData.userItemLimit : 0,
        categories: formData.categories,
        ...(formData.description.trim() ? { description: formData.description.trim() } : {}),
        ...(formData.endDate ? { endDate: formData.endDate } : {}),
        ...(formData.endTime ? { endTime: formData.endTime } : {}),
      };

      const saveWithoutMigration = async () => {
        await FirebaseService.updateEventDetails(event!.id, eventDetails);
        toast.success('האירוע עודכן בהצלחה!');
        onSuccess?.();
        onClose();
      };

      if (event) {
        // Smart Migration Detection using areCategoriesEqual.
        // The baseline must mirror how formData.categories was initialised, otherwise
        // legacy events (which have no details.categories at all) always compare as
        // "changed" and every single save is forced through the migration flow.
        const baselineCategories = event.details.categories || TEMPLATES['DEFAULT'].categories;

        // If we have items AND categories actually changed
        if (event.menuItems && Object.keys(event.menuItems).length > 0 && !areCategoriesEqual(formData.categories, baselineCategories)) {
          setActiveModal({
            type: 'confirm',
            title: 'שינוי קטגוריות',
            message: 'שינית את הקטגוריות של האירוע, ויש בו כבר פריטים.\n\nהגירה חכמה: ניתוח הפריטים וסידורם מחדש לפי הקטגוריות החדשות.\nשמור בלי הגירה: הפריטים יישמרו כמו שהם. פריטים שהקטגוריה שלהם בוטלה יוצגו תחת שם הקטגוריה הישן, וללא סינון ייעודי.\nביטול: חזרה לטופס בלי לשמור.',
            confirmLabel: 'הגירה חכמה',
            secondaryLabel: 'שמור בלי הגירה',
            onSecondary: async () => {
              setActiveModal(null);
              await saveWithoutMigration();
            },
            onConfirm: async () => {
              // 1. Save Event Details first
              await FirebaseService.updateEventDetails(event.id, eventDetails);
              toast.success('הגדרות האירוע עודכנו. פותח חלון מיגרציה...');

              // 2. Prepare Migration
              const itemsList = Object.values(event.menuItems!).map(item => `${item.name} ${item.quantity}`).join('\n');
              setMigrationData(itemsList);
              setMigrationStartTime(Date.now());
              setShowImportForMigration(true);
              setActiveModal(null);
            }
          });
          setIsSubmitting(false); // Stop submitting spinner while user decides
          return;
        }

        await saveWithoutMigration();
      } else {
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

  const handleInputChange = (field: keyof typeof formData, value: any) => {
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
                  event={event}
                  onClose={() => {
                    setShowImportForMigration(false);
                    onClose();
                  }}
                  categoriesOverride={formData.categories}
                  initialText={migrationData}
                  autoRunAI={true}
                  migrationStartTime={migrationStartTime}
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
                  {authUser && (() => {
                    const isSaveDisabled = (() => {
                      for (const [, preset] of Object.entries(EVENT_PRESETS)) {
                        if (areCategoriesEqual(formData.categories, preset.categories)) return true;
                      }
                      for (const tmpl of customTemplates) {
                        if (areCategoriesEqual(formData.categories, tmpl.categories)) return true;
                      }
                      return false;
                    })();

                    return (
                      <button
                        type="button"
                        disabled={isSaveDisabled}
                        onClick={() => {
                          setTemplateName('');
                          setActiveModal({
                            type: 'prompt',
                            title: 'שמירת תבנית חדשה',
                            message: 'הכנס שם לתבנית החדשה:',
                            onConfirm: async (name) => {
                              if (!name || !name.trim() || !authUser) return;
                              try {
                                await FirebaseService.saveCustomTemplate(authUser.uid, name.trim(), formData.categories);
                                toast.success('התבנית נשמרה!');
                                loadCustomTemplates();
                                setActiveModal(null);
                              } catch (error: any) {
                                toast.error(error.message || 'שגיאה בשמירה');
                              }
                            }
                          });
                        }}
                        className={`p-1 rounded transition-colors ${isSaveDisabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100'}`}
                        title={isSaveDisabled ? 'אין שינויים לשמירה' : 'שמור תבנית אישית'}
                      >
                        <Save className="w-4 h-4" />
                      </button>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 transition-all duration-300">
                  {(() => {
                    const allPresets = (Object.entries(EVENT_PRESETS) as [EventType, typeof EVENT_PRESETS[EventType]][]);
                    const topPresets = allPresets.filter(([key]) =>
                      [EventType.FRIDAY_DINNER, EventType.BBQ, EventType.PICNIC].includes(key)
                    );

                    const visibleSystemTemplates = isExpanded ? allPresets : topPresets;

                    return (
                      <>
                        {visibleSystemTemplates.map(([key, template]) => (
                          <button
                            type="button"
                            key={key}
                            onClick={() => handleTemplateChange(key)}
                            className={`p-3 rounded-lg border text-right transition-all hover:shadow-md flex flex-col items-center gap-2
                                  ${areCategoriesEqual(formData.categories, template.categories)
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

                        {isExpanded && customTemplates.map((template) => (
                          <div
                            key={template.id}
                            onClick={() => handleTemplateChange(template.id, true)}
                            className={`cursor-pointer relative p-3 rounded-lg border text-right transition-all hover:shadow-md flex flex-col items-center gap-2 group
                                ${areCategoriesEqual(formData.categories, template.categories)
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

              {/* Custom Categories Editor */}
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
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSubmitting}
                    required
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
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.date ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={isSubmitting}
                      required
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
                      className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.time ? 'border-red-500' : 'border-gray-300'}`}
                      disabled={isSubmitting}
                      required
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
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.location ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSubmitting}
                    required
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
                    className={`w-full pr-10 pl-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${errors.hostName ? 'border-red-500' : 'border-gray-300'}`}
                    disabled={isSubmitting}
                    required
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
                <p className="text-xs text-gray-500 mt-1">
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

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    id={allowRideOffersId}
                    type="checkbox"
                    checked={formData.allowRideOffers}
                    onChange={(e) => handleInputChange('allowRideOffers', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="mr-2 text-sm text-gray-700">אפשר הצעת טרמפים</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 mr-6">
                  כפתור "הצע טרמפ" יוצג למשתתפים
                </p>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.allowRideRequests}
                    onChange={(e) => handleInputChange('allowRideRequests', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={isSubmitting}
                  />
                  <span className="mr-2 text-sm text-gray-700">אפשר בקשת טרמפים</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 mr-6">
                  כפתור "בקש טרמפ" יוצג למשתתפים
                </p>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 rtl:space-x-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
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
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      </FocusTrap>

      {/* Confirmation Modals */}
      {activeModal && (
        <ConfirmationModal
          title={activeModal.title}
          message={activeModal.message}
          onClose={() => setActiveModal(null)}
          options={activeModal.type === 'prompt' ? [
            {
              label: 'שמור',
              onClick: () => {
                if (activeModal.onConfirm) activeModal.onConfirm(templateName);
              },
              className: 'bg-blue-500 text-white hover:bg-blue-600'
            }
          ] : [
            {
              label: activeModal.confirmLabel || 'אישור',
              onClick: () => activeModal.onConfirm(),
              className: 'bg-blue-500 text-white hover:bg-blue-600'
            },
            ...(activeModal.onSecondary ? [{
              label: activeModal.secondaryLabel || 'שמור',
              onClick: activeModal.onSecondary,
              className: 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-300'
            }] : [])
          ]}
        >
          {activeModal.type === 'prompt' && (
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="שם התבנית (π.ל. ארוחת מוצש)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') activeModal.onConfirm(templateName);
              }}
            />
          )}
        </ConfirmationModal>
      )}
    </div>
  );
}