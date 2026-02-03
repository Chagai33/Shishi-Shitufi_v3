import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface BaseCardProps {
  title: string;
  categoryDisplayName: string;
  cardStyles: string;
  tagColor: string;
  onEdit?: () => void;
  onDelete?: () => void;
  showEdit?: boolean;
  showDelete?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const BaseCard: React.FC<BaseCardProps> = ({
  title,
  categoryDisplayName,
  cardStyles,
  tagColor,
  onEdit,
  onDelete,
  showEdit,
  showDelete,
  children,
  footer
}) => {
  const { t } = useTranslation();

  return (
    <div className={`rounded-xl border flex flex-col transition-all duration-300 hover:shadow-md ${cardStyles}`}>
      <div className="p-4 flex-grow">
        <div className="flex justify-between items-start mb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-gray-900 text-lg tracking-tight leading-tight">{title}</h4>
              {showDelete && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                  title={t('common.delete')}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            {showEdit && onEdit && (
              <button
                onClick={onEdit}
                className="text-xs text-blue-600 hover:text-blue-700 underline flex items-center gap-1 mt-0.5 w-fit"
                title={t('eventPage.item.editItem')}
              >
                <Edit size={12} />
                {t('eventPage.item.editItem')}
              </button>
            )}
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${tagColor}`}>
            {categoryDisplayName}
          </span>
        </div>

        {children}
      </div>

      {footer && (
        <div className="border-t border-gray-100/50 p-3 bg-gray-50/50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};
