import React, { useEffect, useRef, useId } from 'react';
import FocusTrap from 'focus-trap-react';

interface ConfirmationModalProps {
  title?: string;
  message: string;
  children?: React.ReactNode;
  options: {
    label: string;
    onClick: () => void;
    className?: string;
    // Optional, and unused by the two other screens that render this dialog.
    // Account deletion needs it: its button carries a disabled: style already
    // and has never been able to use it, so the button both stayed clickable
    // while the deletion was in flight and could not be held shut until the
    // person confirms which account they mean.
    disabled?: boolean;
  }[];
  onClose: () => void;
}

export function ConfirmationModal({ title, message, children, options, onClose }: ConfirmationModalProps) {
  // Accessibility: Unique ID for ARIA labeling
  const titleId = useId();

  // Accessibility: Store reference to the element that opened the modal
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Accessibility: Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Accessibility: Store active element on mount, restore on unmount
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;

    return () => {
      // Return focus when modal closes
      if (returnFocusRef.current && typeof returnFocusRef.current.focus === 'function') {
        returnFocusRef.current.focus();
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      role="presentation"
    >
      <FocusTrap>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          /* Height capped and scrollable: the account deletion dialog is six
             lines of text before it adds a field to type into, and on a phone
             the keyboard takes half the screen the moment that field has
             focus, which used to push the buttons out of reach. */
          className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 mb-4">{title || 'אישור פעולה'}</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
            {children && <div className="mt-4">{children}</div>}
          </div>
          <div className="flex justify-end p-4 bg-gray-50 rounded-b-xl space-x-2 rtl:space-x-reverse">
            {options.map((option, index) => (
              <button
                key={index}
                onClick={option.onClick}
                type="button"
                disabled={option.disabled}
                className={`px-4 py-2 rounded-md ${option.className || 'bg-gray-200 text-gray-800'}`}
              >
                {option.label}
              </button>
            ))}
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-md bg-gray-200 text-gray-800"
            >
              ביטול
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
