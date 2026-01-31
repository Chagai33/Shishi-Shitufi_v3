// src/components/Events/ParticipantsListModal.tsx

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2, Users } from 'lucide-react';
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

    // Create a flat list of all assignments with item details, sorted by item name and then by assignedAt
    const assignmentsList = useMemo<AssignmentDisplay[]>(() => {
        const list: AssignmentDisplay[] = [];

        assignments.forEach(assignment => {
            const menuItem = menuItems.find(item => item.id === assignment.menuItemId);
            if (menuItem) {
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 rounded-full p-2">
                            <Users size={24} className="text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-neutral-900">
                            {t('eventPage.participantsList.title')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-neutral-500 hover:text-neutral-700 transition-colors"
                        aria-label={t('common.close')}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {assignmentsList.length === 0 ? (
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
                                            className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"
                                            title={t('eventPage.item.cancel')}
                                            aria-label={t('eventPage.item.cancel')}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {assignmentsList.length > 0 && (
                    <div className="border-t p-4 bg-gray-50">
                        <p className="text-sm text-gray-600 text-center">
                            {t('eventPage.participantsList.total', { count: assignmentsList.length })}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
