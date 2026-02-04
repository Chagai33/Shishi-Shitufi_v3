// src/components/Events/ParticipantsListModal.tsx

import React, { useMemo, useEffect, useRef, useId, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, Users, Car, UserSearch, MessageCircle } from 'lucide-react';
import { Assignment, MenuItem } from '../../types';
import { toast } from 'react-hot-toast';

interface AssignmentDisplay {
    assignmentId: string;
    userName: string;
    userId: string;
    itemName: string;
    quantity: number;
    assignedAt: number;
    menuItemId: string;
    totalQuantity: number;
}

interface ParticipantsListModalProps {
    assignments: Assignment[];
    menuItems: MenuItem[];
    onClose: () => void;
    onDeleteAssignment: (assignmentId: string, menuItemId: string, userName: string, itemName: string) => Promise<void>;
    isOrganizer: boolean;
}

export const ParticipantsListModal: React.FC<ParticipantsListModalProps> = ({
    assignments,
    menuItems,
    onClose,
    onDeleteAssignment,
    isOrganizer
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'participants' | 'drivers' | 'passengers'>('participants');

    // Accessibility: Unique ID for ARIA labeling
    const titleId = useId();

    // Accessibility: Store reference to the element that opened the modal
    const returnFocusRef = useRef<HTMLElement | null>(null);

    // Create a flat list of all assignments with item details, sorted by item name and then by assignedAt
    // Exclude ride assignments from participants tab
    const assignmentsList = useMemo<AssignmentDisplay[]>(() => {
        const list: AssignmentDisplay[] = [];

        assignments.forEach(assignment => {
            const menuItem = menuItems.find(item => item.id === assignment.menuItemId);
            // Skip ride items from participants list
            if (menuItem && menuItem.category !== 'ride_offers' && menuItem.category !== 'ride_requests') {
                list.push({
                    assignmentId: assignment.id,
                    userName: assignment.userName,
                    userId: assignment.userId,
                    itemName: menuItem.name,
                    quantity: assignment.quantity,
                    assignedAt: assignment.assignedAt || 0,
                    menuItemId: assignment.menuItemId,
                    totalQuantity: menuItem.quantity // Add total quantity for display
                });
            }
        });

        // Sort by item name first (alphabetically), then by assignedAt descending (newest first) within each item
        return list.sort((a, b) => {
            // First, compare by item name
            const itemNameCompare = a.itemName.localeCompare(b.itemName, 'he');
            if (itemNameCompare !== 0) {
                return itemNameCompare;
            }
            // If same item, sort by date (newest first)
            return b.assignedAt - a.assignedAt;
        });
    }, [assignments, menuItems]);

    // WhatsApp Helper
    const getWhatsAppLink = (phoneNumber: string) => {
        let cleanNum = phoneNumber.replace(/\D/g, '');
        if (cleanNum.startsWith('0')) {
            cleanNum = '972' + cleanNum.substring(1);
        }
        return `https://wa.me/${cleanNum}`;
    };

    // Drivers List (ride_offers)
    const driversList = useMemo(() => {
        return menuItems
            .filter(item => item.category === 'ride_offers')
            .map(item => {
                const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
                const filledSeats = itemAssignments.reduce((acc, a) => acc + (a.quantity || 0), 0);
                
                // Check if creator has opposite direction
                const oppositeDir = item.direction === 'to_event' ? 'from_event' : 'to_event';
                const hasOppositeDirection = menuItems.some(i => 
                    i.creatorId === item.creatorId &&
                    i.direction === oppositeDir &&
                    i.category === 'ride_offers'
                );

                return {
                    item,
                    assignments: itemAssignments,
                    availableSeats: item.quantity - filledSeats,
                    isFull: filledSeats >= item.quantity,
                    hasOppositeDirection
                };
            })
            .sort((a, b) => {
                // Priority: has opposite direction first
                if (a.hasOppositeDirection && !b.hasOppositeDirection) return -1;
                if (!a.hasOppositeDirection && b.hasOppositeDirection) return 1;
                
                // Then by direction (to_event first)
                if (a.item.direction === 'to_event' && b.item.direction === 'from_event') return -1;
                if (a.item.direction === 'from_event' && b.item.direction === 'to_event') return 1;
                
                // Then by departure time
                return (a.item.departureTime || '').localeCompare(b.item.departureTime || '');
            });
    }, [menuItems, assignments]);

    // Passengers List (ride_requests)
    const passengersList = useMemo(() => {
        return menuItems
            .filter(item => item.category === 'ride_requests')
            .map(item => {
                const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
                const hasDriver = itemAssignments.length > 0;

                return {
                    item,
                    driver: itemAssignments[0] || null,
                    hasDriver
                };
            })
            .sort((a, b) => {
                // Priority: without driver first (needs help)
                if (!a.hasDriver && b.hasDriver) return -1;
                if (a.hasDriver && !b.hasDriver) return 1;
                
                // Then by direction
                if (a.item.direction === 'to_event' && b.item.direction === 'from_event') return -1;
                if (a.item.direction === 'from_event' && b.item.direction === 'to_event') return 1;
                
                // Then by departure time
                return (a.item.departureTime || '').localeCompare(b.item.departureTime || '');
            });
    }, [menuItems, assignments]);

    // Format time flexibility
    const getFlexibilityText = (flex?: string) => {
        switch (flex) {
            case 'exact': return 'מדויק';
            case '15min': return '±15\'';
            case '30min': return '±30\'';
            case '1hour': return '±1שעה';
            case 'flexible': return 'גמיש מאוד';
            default: return '';
        }
    };

    const handleDelete = async (assignment: AssignmentDisplay) => {
        if (!isOrganizer) {
            toast.error(t('common.permissionDenied'));
            return;
        }

        const confirmMessage = t('eventPage.participantsList.deleteConfirm', {
            name: assignment.userName,
            item: assignment.itemName
        });

        if (window.confirm(confirmMessage)) {
            try {
                await onDeleteAssignment(
                    assignment.assignmentId,
                    assignment.menuItemId,
                    assignment.userName,
                    assignment.itemName
                );
                toast.success(t('eventPage.participantsList.assignmentDeleted'));
            } catch (error) {
                toast.error(t('eventPage.messages.cancelAssignmentError'));
            }
        }
    };

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
                    className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
                >
                    {/* Header */}
                    <div className="border-b">
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-blue-100 rounded-full p-2">
                                    <Users size={24} className="text-blue-600" aria-hidden="true" />
                                </div>
                                <h2 id={titleId} className="text-xl font-bold text-neutral-900">
                                    {t('eventPage.participantsList.title')}
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                type="button"
                                className="text-neutral-500 hover:text-neutral-700 transition-colors"
                                aria-label={t('common.close')}
                            >
                                <X size={24} aria-hidden="true" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-t border-gray-200 px-6">
                            <button
                                onClick={() => setActiveTab('participants')}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'participants'
                                        ? 'border-blue-600 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Users size={16} />
                                משתתפים ({assignmentsList.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('drivers')}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'drivers'
                                        ? 'border-green-600 text-green-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Car size={16} />
                                נהגים ({driversList.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('passengers')}
                                className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
                                    activeTab === 'passengers'
                                        ? 'border-purple-600 text-purple-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <UserSearch size={16} />
                                מחפשי טרמפ ({passengersList.length})
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {/* Participants Tab */}
                        {activeTab === 'participants' && (
                            assignmentsList.length === 0 ? (
                                <div className="text-center py-12">
                                    <Users size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 text-lg">{t('eventPage.participantsList.empty')}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {assignmentsList.map((assignment, index) => (
                                        <div
                                            key={`${assignment.assignmentId}-${index}`}
                                            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors group"
                                        >
                                            <div className="flex-1">
                                                <p className="text-gray-900 font-medium">
                                                    {assignment.userName}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {assignment.itemName}
                                                    {assignment.totalQuantity > 1 && (
                                                        <span className="font-semibold text-blue-600 mr-1">
                                                            {' '}({assignment.quantity}/{assignment.totalQuantity})
                                                        </span>
                                                    )}
                                                </p>
                                            </div>

                                            {isOrganizer && (
                                                <button
                                                    onClick={() => handleDelete(assignment)}
                                                    type="button"
                                                    className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                                    aria-label={`${t('eventPage.item.cancel')} - ${assignment.userName} - ${assignment.itemName}`}
                                                >
                                                    <Trash2 size={18} aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* Drivers Tab */}
                        {activeTab === 'drivers' && (
                            driversList.length === 0 ? (
                                <div className="text-center py-12">
                                    <Car size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 text-lg">אין נהגים רשומים</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Group by direction */}
                                    {['to_event', 'from_event'].map(direction => {
                                        const driversInDirection = driversList.filter(d => d.item.direction === direction);
                                        if (driversInDirection.length === 0) return null;

                                        return (
                                            <div key={direction}>
                                                <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                                                    {direction === 'to_event' ? '→ הלוך לאירוע' : '← חזור מהאירוע'}
                                                </h3>
                                                <div className="space-y-3">
                                                    {driversInDirection.map(driver => (
                                                        <div key={driver.item.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                                                            {/* Driver Header */}
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-gray-900 font-bold">{driver.item.creatorName}</p>
                                                                        {driver.hasOppositeDirection && (
                                                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                                                                ⭐ גם {direction === 'to_event' ? 'חוזר' : 'הולך'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    
                                                                    {/* Time and Flexibility */}
                                                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                                                        <span className="font-semibold">🕐 {driver.item.departureTime || 'לא צוין'}</span>
                                                                        {driver.item.timeFlexibility && (
                                                                            <span className="text-xs">({getFlexibilityText(driver.item.timeFlexibility)})</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Pickup Location */}
                                                                    {driver.item.pickupLocation && (
                                                                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                                                            <span>📍</span>
                                                                            <span>{driver.item.pickupLocation}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Seats Status */}
                                                                    <div className="mt-2 flex items-center gap-2">
                                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                            driver.availableSeats > 0
                                                                                ? 'bg-green-100 text-green-700'
                                                                                : 'bg-gray-100 text-gray-600'
                                                                        }`}>
                                                                            {driver.availableSeats > 0
                                                                                ? `${driver.availableSeats} מקומות פנויים`
                                                                                : 'רכב מלא'}
                                                                        </span>
                                                                        <span className="text-xs text-gray-500">
                                                                            ({driver.item.quantity - driver.availableSeats}/{driver.item.quantity} תפוס)
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* WhatsApp Button */}
                                                                {driver.item.phoneNumber && (
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <a
                                                                            href={`tel:${driver.item.phoneNumber}`}
                                                                            className="text-xs font-bold text-blue-600 hover:underline"
                                                                            dir="ltr"
                                                                        >
                                                                            {driver.item.phoneNumber}
                                                                        </a>
                                                                        <a
                                                                            href={getWhatsAppLink(driver.item.phoneNumber)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-green-600 hover:text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-xs font-medium"
                                                                        >
                                                                            <MessageCircle size={14} />
                                                                            WhatsApp
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Passengers */}
                                                            {driver.assignments.length > 0 && (
                                                                <div className="border-t pt-3">
                                                                    <p className="text-xs font-bold text-gray-400 uppercase mb-2">נוסעים:</p>
                                                                    <div className="space-y-2">
                                                                        {driver.assignments.map(assignment => (
                                                                            <div key={assignment.id} className="flex items-center justify-between text-sm bg-blue-50 rounded-lg p-2">
                                                                                <div className="flex-1">
                                                                                    <span className="text-gray-900 font-medium">{assignment.userName}</span>
                                                                                    {assignment.quantity > 1 && (
                                                                                        <span className="text-xs text-gray-500 mr-1">({assignment.quantity} מקומות)</span>
                                                                                    )}
                                                                                    {assignment.phoneNumber && (
                                                                                        <div className="flex items-center gap-2 mt-1">
                                                                                            <a href={`tel:${assignment.phoneNumber}`} className="text-xs text-blue-600 hover:underline" dir="ltr">
                                                                                                {assignment.phoneNumber}
                                                                                            </a>
                                                                                            <a
                                                                                                href={getWhatsAppLink(assignment.phoneNumber)}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="text-green-600 hover:text-green-700"
                                                                                            >
                                                                                                <MessageCircle size={12} />
                                                                                            </a>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {/* Passengers Tab */}
                        {activeTab === 'passengers' && (
                            passengersList.length === 0 ? (
                                <div className="text-center py-12">
                                    <UserSearch size={48} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500 text-lg">אין מחפשי טרמפ</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Group by direction */}
                                    {['to_event', 'from_event'].map(direction => {
                                        const passengersInDirection = passengersList.filter(p => p.item.direction === direction);
                                        if (passengersInDirection.length === 0) return null;

                                        return (
                                            <div key={direction}>
                                                <h3 className="text-sm font-bold text-gray-500 mb-3">
                                                    {direction === 'to_event' ? '→ הלוך' : '← חזור'}
                                                </h3>
                                                <div className="space-y-3">
                                                    {passengersInDirection.map(passenger => (
                                                        <div key={passenger.item.id} className={`border rounded-lg p-4 ${
                                                            passenger.hasDriver ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
                                                        }`}>
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-gray-900 font-bold">{passenger.item.creatorName}</p>
                                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                                            passenger.hasDriver
                                                                                ? 'bg-green-100 text-green-700'
                                                                                : 'bg-yellow-100 text-yellow-700'
                                                                        }`}>
                                                                            {passenger.hasDriver ? '✓ מסודר' : '❌ עדיין מחפש'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Time and Flexibility */}
                                                                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                                                                        <span className="font-semibold">🕐 {passenger.item.departureTime || 'לא צוין'}</span>
                                                                        {passenger.item.timeFlexibility && (
                                                                            <span className="text-xs">({getFlexibilityText(passenger.item.timeFlexibility)})</span>
                                                                        )}
                                                                    </div>

                                                                    {/* Pickup Location */}
                                                                    {passenger.item.pickupLocation && (
                                                                        <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                                                            <span>📍</span>
                                                                            <span>{passenger.item.pickupLocation}</span>
                                                                        </div>
                                                                    )}

                                                                    {/* Driver Info */}
                                                                    {passenger.driver && (
                                                                        <div className="mt-2 text-xs text-gray-600">
                                                                            <span className="font-semibold">נהג/ת: </span>
                                                                            <span>{passenger.driver.userName}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* WhatsApp Button */}
                                                                {passenger.item.phoneNumber && (
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <a
                                                                            href={`tel:${passenger.item.phoneNumber}`}
                                                                            className="text-xs font-bold text-blue-600 hover:underline"
                                                                            dir="ltr"
                                                                        >
                                                                            {passenger.item.phoneNumber}
                                                                        </a>
                                                                        <a
                                                                            href={getWhatsAppLink(passenger.item.phoneNumber)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-green-600 hover:text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 text-xs font-medium"
                                                                        >
                                                                            <MessageCircle size={14} />
                                                                            WhatsApp
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}
                    </div>

                    {/* Footer */}
                    {((activeTab === 'participants' && assignmentsList.length > 0) ||
                      (activeTab === 'drivers' && driversList.length > 0) ||
                      (activeTab === 'passengers' && passengersList.length > 0)) && (
                        <div className="border-t p-4 bg-gray-50">
                            <p className="text-sm text-gray-600 text-center">
                                {activeTab === 'participants' && t('eventPage.participantsList.total', { count: assignmentsList.length })}
                                {activeTab === 'drivers' && `סה"כ ${driversList.length} נהגים`}
                                {activeTab === 'passengers' && (
                                    <>
                                        סה"כ {passengersList.length} מחפשי טרמפ
                                        {' • '}
                                        <span className="text-yellow-600 font-semibold">
                                            {passengersList.filter(p => !p.hasDriver).length} עדיין מחפשים
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </FocusTrap>
        </div>
    );
};
