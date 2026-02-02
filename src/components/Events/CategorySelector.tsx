import React from 'react';
import { Plus } from 'lucide-react';
import { MenuItem, Assignment, CategoryConfig } from '../../types';

interface CategorySelectorProps {
  menuItems: MenuItem[];
  assignments: Assignment[];
  categories: CategoryConfig[]; // NEW prop
  onSelectCategory: (categoryId: string) => void;
  onAddItem: () => void;
  canAddMoreItems: boolean;
  userCreatedItemsCount: number;
  MAX_USER_ITEMS: number;
  showLimit?: boolean;  // Kept from original to avoid breaking usage if passed, though not in user snippet explicit props but likely needed for backward compat or usage in parent
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  menuItems,
  assignments,
  categories,
  onSelectCategory,
  onAddItem,
  canAddMoreItems,
  userCreatedItemsCount,
  MAX_USER_ITEMS,
  showLimit = true, // Defaulting if needed
}) => {
  // Helper to calculate progress
  const getCategoryProgress = (categoryId: string) => {
    // Note: strict check might fail if types are mixed, but valid for string comparison
    const itemsInCategory = menuItems.filter(item => item.category === categoryId);

    // Count items as "completed" using the same logic as before if needed, or simplified as per user snippet
    // User snippet logic:
    const assignedItemsInCategory = itemsInCategory.filter(item =>
      assignments.some(a => a.menuItemId === item.id)
    );

    // Ideally we should use the robust logic from previous version regarding splittable items, 
    // but the user provided specific logic in the snippet: "assignedItemsInCategory.length"
    // I will stick to the user's snippet logic for now to follow "Full File Rewrite Required" instructions strictly,
    // assuming they simplified it or want this specific behavior.

    return {
      assigned: assignedItemsInCategory.length,
      total: itemsInCategory.length,
    };
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => {
          const progress = getCategoryProgress(category.id);

          // Hide empty categories to keep the UI clean (Legacy Behavior)
          if (progress.total === 0) return null;

          const percentage = progress.total > 0 ? (progress.assigned / progress.total) * 100 : 0;

          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className="group relative category-card-2025 p-6 rounded-xl cursor-pointer text-center overflow-hidden w-full transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              type="button"
            >
              <div className="aurora-glow" style={{ backgroundColor: category.color + '40' }}></div> {/* Low opacity glow */}

              <div className="relative z-10 flex flex-col items-center h-full">
                <img
                  src={`/Icons/${category.icon}`}
                  alt={category.name}
                  className="w-20 h-20 mx-auto mb-3 object-contain transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => {
                    // Fallback if image fails
                    (e.target as HTMLImageElement).src = '/Icons/general.png';
                  }}
                />
                <h3 className="text-xl font-bold text-neutral-800 mb-2">{category.name}</h3>

                <div className="flex-grow"></div>

                <div className="w-full">
                  <p className="text-center text-neutral-500 text-sm mb-4">
                    {progress.assigned} / {progress.total} שובצו
                  </p>
                  <div className="w-full bg-neutral-200 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: category.color,
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

      <div className="mt-8">
        <button
          onClick={onAddItem}
          type="button"
          disabled={!canAddMoreItems}
          title={canAddMoreItems ? "הוסף פריט חדש" : "לא ניתן להוסיף פריטים נוספים"}
          className={`w-full flex items-center justify-center text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-green-500
            ${!canAddMoreItems
              ? 'bg-neutral-400 cursor-not-allowed'
              : 'bg-success hover:bg-success/90'
            }`}
        >
          <Plus size={20} className="ml-2" />
          הוסף פריט משלך {showLimit && `(${userCreatedItemsCount}/${MAX_USER_ITEMS})`}
        </button>
      </div>
    </div>
  );
};
