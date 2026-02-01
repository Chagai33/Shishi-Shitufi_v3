import React from 'react';
import { Plus } from 'lucide-react';
import { MenuItem, Assignment } from '../../types';
import { useTranslation } from 'react-i18next';

// Define design details for each category (names removed, will use t())
const categoryDetails: { [key: string]: { icon: string; color: string; glowClass: string } } = {
  starter: { icon: '/Icons/2.gif', color: '#3498db', glowClass: 'glow-starter' },
  main: { icon: '/Icons/1.gif', color: '#009688', glowClass: 'glow-main' },
  dessert: { icon: '/Icons/3.gif', color: '#9b59b6', glowClass: 'glow-dessert' },
  drink: { icon: '/Icons/4.gif', color: '#2ecc71', glowClass: 'glow-drink' },
  equipment: { icon: '/Icons/6.gif', color: '#2ecc71', glowClass: 'glow-drink' },
  other: { icon: '/Icons/5.gif', color: '#95a5a6', glowClass: 'glow-other' },
};

interface CategorySelectorProps {
  menuItems: MenuItem[];
  assignments: Assignment[];
  onSelectCategory: (category: string) => void;
  onAddItem: () => void;
  canAddMoreItems: boolean;
  userCreatedItemsCount: number;
  MAX_USER_ITEMS: number;
  showLimit?: boolean;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  menuItems,
  assignments,
  onSelectCategory,
  onAddItem,
  canAddMoreItems,
  userCreatedItemsCount,
  MAX_USER_ITEMS,
  showLimit = true,
}) => {
  const { t } = useTranslation();

  // Helper function to calculate status and progress for each category
  const getCategoryProgress = (category: string) => {
    const itemsInCategory = menuItems.filter(item => item.category === category);

    // Count items as "completed" only if ALL their units are assigned
    const completedItems = itemsInCategory.filter(item => {
      const itemAssignments = assignments.filter(a => a.menuItemId === item.id);

      if (itemAssignments.length === 0) return false;

      // For splittable items, check if total assigned >= quantity
      if (item.isSplittable || item.quantity > 1) {
        const totalAssigned = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);
        return totalAssigned >= item.quantity;
      }

      // For non-splittable items, any assignment means completed
      return true;
    });

    return {
      assigned: completedItems.length,
      total: itemsInCategory.length,
    };
  };

  const categoriesOrder = ['starter', 'main', 'dessert', 'drink', 'equipment', 'other'];

  return (
    <div>
      {/* Categories grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoriesOrder.map(categoryKey => {
          const progress = getCategoryProgress(categoryKey);

          // Show category only if it has items
          if (progress.total === 0) {
            return null;
          }

          const details = categoryDetails[categoryKey];
          const percentage = progress.total > 0 ? (progress.assigned / progress.total) * 100 : 0;
          const categoryName = t(`categories.${categoryKey}`);

          return (
            <button
              key={categoryKey}
              type="button"
              onClick={() => onSelectCategory(categoryKey)}
              aria-label={`${categoryName}, ${progress.assigned} ${t('eventPage.stats.assigned')} ${progress.total}`}
              className="group relative category-card-2025 p-6 rounded-xl cursor-pointer text-center overflow-hidden w-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {/* Glow element activated on hover */}
              <div className={`aurora-glow ${details.glowClass}`}></div>

              {/* Card content */}
              <div className="relative z-10 flex flex-col items-center h-full">
                <img
                  src={details.icon}
                  alt=""
                  aria-hidden="true"
                  className="w-20 h-20 mx-auto mb-3 object-contain transition-transform duration-300 group-hover:scale-110"
                />
                <h3 className="text-xl font-bold text-neutral-800 mb-2">{categoryName}</h3>

                <div className="flex-grow"></div> {/* Spacer to push progress bar to bottom */}

                <div className="w-full">
                  <p className="text-center text-neutral-500 text-sm mb-4">
                    {progress.assigned} / {progress.total} {t('eventPage.stats.assigned')}
                  </p>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: details.color,
                        transition: 'width 0.5s ease-in-out'
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Add item button */}
      <div className="mt-8">
        <button
          onClick={onAddItem}
          type="button"
          disabled={!canAddMoreItems}
          title={canAddMoreItems ? t('eventPage.category.addItemTooltip') : t('eventPage.category.limitReached', { limit: MAX_USER_ITEMS })}
          aria-label={`${t('eventPage.category.addItem')} ${showLimit ? `(${userCreatedItemsCount}/${MAX_USER_ITEMS})` : ''}`}
          className={`w-full flex items-center justify-center text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-green-500
            ${!canAddMoreItems
              ? 'bg-neutral-400 cursor-not-allowed'
              : 'bg-success hover:bg-success/90'
            }`}
        >
          <Plus size={20} className="ml-2" aria-hidden="true" />
          {t('eventPage.category.addItem')} {showLimit && `(${userCreatedItemsCount}/${MAX_USER_ITEMS})`}
        </button>
      </div>
    </div>
  );
};
