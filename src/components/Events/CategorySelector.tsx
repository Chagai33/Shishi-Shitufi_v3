import React from 'react';
import { Plus } from 'lucide-react';
import { MenuItem, Assignment } from '../../types'; // Make sure the path to types files is correct

// Define design details for each category
const categoryDetails: { [key: string]: { name: string; icon: string; color: string; glowClass: string } } = {
  starter: { name: 'מנות ראשונות', icon: '/Icons/2.gif', color: '#3498db', glowClass: 'glow-starter' },
  main: { name: 'מנות עיקריות', icon: '/Icons/1.gif', color: '#009688', glowClass: 'glow-main' },
  dessert: { name: 'קינוחים', icon: '/Icons/3.gif', color: '#9b59b6', glowClass: 'glow-dessert' },
  drink: { name: 'שתייה', icon: '/Icons/4.gif', color: '#2ecc71', glowClass: 'glow-drink' },
  equipment: { name: 'ציוד כללי', icon: '/Icons/6.gif', color: '#2ecc71', glowClass: 'glow-drink' },
  other: { name: 'אחר', icon: '/Icons/5.gif', color: '#95a5a6', glowClass: 'glow-other' },
};

// Definition of Props that the component receives
interface CategorySelectorProps {
  menuItems: MenuItem[];
  assignments: Assignment[];
  onSelectCategory: (category: string) => void;
  onAddItem: () => void;
  canAddMoreItems: boolean;
  userCreatedItemsCount: number;
  MAX_USER_ITEMS: number;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  menuItems,
  assignments,
  onSelectCategory,
  onAddItem,
  canAddMoreItems,
  userCreatedItemsCount,
  MAX_USER_ITEMS,
}) => {

  // Helper function to calculate status and progress for each category
  const getCategoryProgress = (category: string) => {
    const itemsInCategory = menuItems.filter(item => item.category === category);
    const assignedItemsInCategory = itemsInCategory.filter(item =>
      assignments.some(a => a.menuItemId === item.id)
    );
    return {
      assigned: assignedItemsInCategory.length,
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

          return (
            <button
              key={categoryKey}
              type="button"
              onClick={() => onSelectCategory(categoryKey)}
              aria-label={`קטגוריה ${details.name}, ${progress.assigned} מתוך ${progress.total} פריטים שובצו`}
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
                <h3 className="text-xl font-bold text-neutral-800 mb-2">{details.name}</h3>

                <div className="flex-grow"></div> {/* Spacer to push progress bar to bottom */}

                <div className="w-full">
                  <p className="text-center text-neutral-500 text-sm mb-4">
                    {progress.assigned} / {progress.total} שובצו
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
          disabled={!canAddMoreItems}
          title={canAddMoreItems ? "הוסף פריט חדש לארוחה" : "לא ניתן להוסיף פריטים נוספים"}
          className={`w-full flex items-center justify-center text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-green-500
            ${!canAddMoreItems
              ? 'bg-neutral-400 cursor-not-allowed'
              : 'bg-success hover:bg-success/90'
            }`}
        >
          <Plus size={20} className="ml-2" />
          הוסף פריט משלך ({userCreatedItemsCount}/{MAX_USER_ITEMS})
        </button>
      </div>
    </div>
  );
};