import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import FocusTrap from 'focus-trap-react';

interface CancelRideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmSingle: () => void;
    onConfirmBoth: () => void;
    isTwinAvailable: boolean;
    direction: 'to_event' | 'from_event' | string;
}

export const CancelRideModal: React.FC<CancelRideModalProps> = ({
    isOpen,
    onClose,
    onConfirmSingle,
    onConfirmBoth,
    isTwinAvailable,
    direction
}) => {
    if (!isOpen) return null;

    const isOutbound = direction === 'to_event';
    const singleButtonText = isOutbound ? "בטל את ההלוך בלבד" : "בטל את החזור בלבד";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <FocusTrap active={isOpen}>
                <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden flex flex-col animate-fadeIn">
                    {/* Dynamic Theme Header - Matches AssignmentModal for Rides */}
                    <div className="flex items-center justify-between p-6 border-b flex-none rounded-t-xl text-white bg-rides-dark">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            ביטול רישום לנסיעה
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                            aria-label="סגור"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Info Box */}
                        <div className="p-4 rounded-lg mb-6 bg-red-50 border border-red-100 text-red-900 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
                            <div>
                                <p className="font-medium text-sm">
                                    {isTwinAvailable
                                        ? 'שמנו לב שאתה רשום גם לנסיעה בכיוון השני.'
                                        : 'האם אתה בטוח שברצונך לבטל את הרישום לנסיעה?'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {isTwinAvailable ? (
                                <>
                                    <button
                                        onClick={onConfirmSingle}
                                        className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl font-semibold transition-colors flex items-center justify-center shadow-sm"
                                    >
                                        {singleButtonText}
                                    </button>
                                    <button
                                        onClick={onConfirmBoth}
                                        className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                                    >
                                        בטל את שתי הנסיעות
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={onConfirmSingle}
                                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-95"
                                >
                                    כן, בטל את הנסיעה
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="bg-neutral-50 px-6 py-4 flex justify-center border-t rounded-b-xl">
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-800 font-medium text-sm transition-colors"
                        >
                            התחרטתי, אל תבטל כלום
                        </button>
                    </div>
                </div>
            </FocusTrap>
        </div>
    );
};
