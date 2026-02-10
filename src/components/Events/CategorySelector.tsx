import React, { useMemo } from 'react';
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
  showLimit?: boolean;
  onOfferRide?: () => void; // New prop for ride offers
  onRideRequest?: () => void; // NEW prop for ride requests
}

const RideSplitCard: React.FC<{
  onSelect: (id: string) => void;
  offerProgress: { assigned: number; total: number };
  requestProgress: { assigned: number; total: number };
  showOffers: boolean;
  showRequests: boolean;
}> = ({ onSelect, offerProgress, requestProgress, showOffers, showRequests }) => {
  return (
    <div className="group relative category-card-2025 rounded-xl overflow-hidden w-full flex h-full shadow-sm hover:shadow-md transition-all border border-gray-100 min-h-[160px]">
      {/* Offers Half */}
      {showOffers && (
        <button
          onClick={() => onSelect('ride_offers')}
          className={`relative flex-1 p-4 flex flex-col items-center justify-center transition-colors hover:bg-rides-bg group/offer ${showRequests ? 'border-l border-gray-100' : ''}`}
          type="button"
        >
          <div className="relative z-10 flex flex-col items-center">
            <img
              src="/Icons/car.gif"
              alt="Offer Ride"
              className="w-14 h-14 mb-2 object-contain transition-transform group-hover/offer:scale-110"
            />
            <h3 className="text-base font-bold text-neutral-800">מציע טרמפ</h3>
            <p className="text-[10px] text-neutral-500 mt-1 font-medium bg-rides-bg text-rides-primary px-2 py-0.5 rounded-full">
              {offerProgress.total - offerProgress.assigned} מושבים פנויים
            </p>
          </div>
          <div className="absolute inset-0 bg-rides-bg/20 opacity-0 group-hover/offer:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Requests Half */}
      {showRequests && (
        <button
          onClick={() => onSelect('ride_requests')}
          className="relative flex-1 p-4 flex flex-col items-center justify-center transition-colors hover:bg-rides-bg group/request"
          type="button"
        >
          <div className="relative z-10 flex flex-col items-center">
            <img
              src="/Icons/car.gif"
              alt="Request Ride"
              className="w-14 h-14 mb-2 object-contain transition-transform group-hover/request:scale-110 brightness-110 hue-rotate-15 contrast-125"
              style={{ transform: 'scaleX(-1)' }}
            />
            <h3 className="text-base font-bold text-neutral-800">צריך טרמפ</h3>
            <p className="text-[10px] text-neutral-500 mt-1 font-medium bg-rides-bg text-rides-primary px-2 py-0.5 rounded-full">
              {requestProgress.total - requestProgress.assigned} נוסעים ללא טרמפ
            </p>
          </div>
          <div className="absolute inset-0 bg-rides-bg/20 opacity-0 group-hover/request:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
};

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  menuItems,
  assignments,
  categories,
  onSelectCategory,
  onAddItem,
  canAddMoreItems,
  userCreatedItemsCount,
  MAX_USER_ITEMS,
  showLimit = true,
  onOfferRide,
  onRideRequest,
}) => {
  // Filter out ride categories from the main loop
  const standardCategories = categories.filter(c => c.id !== 'ride_offers' && c.id !== 'ride_requests');
  const rideOffersCategory = categories.find(c => c.id === 'ride_offers');
  const rideRequestsCategory = categories.find(c => c.id === 'ride_requests');

  // 🚀 OPTIMIZATION: Calculate ALL category progress in one pass (memoized)
  // Reduces O(n²) complexity to O(n) - previously recalculated on every render
  const categoryProgressMap = useMemo(() => {
    const map = new Map<string, { assigned: number; total: number }>();

    categories.forEach(category => {
      const itemsInCategory = menuItems.filter(item => item.category === category.id);
      const isRide = category.id === 'ride_offers' || category.id === 'ride_requests' ||
        category.id === 'trempim' || category.rowType === 'offers';

      if (isRide) {
        let totalQuantity = 0;
        let assignedQuantity = 0;

        itemsInCategory.forEach(item => {
          const isRequest = item.rowType === 'needs' || item.category === 'ride_requests';
          const itemAssignments = assignments.filter(a => a.menuItemId === item.id);
          const filled = itemAssignments.reduce((sum, a) => sum + (a.quantity || 0), 0);

          if (isRequest) {
            totalQuantity += 1;
            if (filled > 0) assignedQuantity += 1;
          } else {
            totalQuantity += item.quantity;
            assignedQuantity += filled;
          }
        });

        map.set(category.id, { assigned: assignedQuantity, total: totalQuantity });
      } else {
        const assignedItemsInCategory = itemsInCategory.filter(item =>
          assignments.some(a => a.menuItemId === item.id)
        );
        map.set(category.id, { assigned: assignedItemsInCategory.length, total: itemsInCategory.length });
      }
    });

    return map;
  }, [menuItems, assignments, categories]);

  const offerProgress = categoryProgressMap.get('ride_offers') || { assigned: 0, total: 0 };
  const requestProgress = categoryProgressMap.get('ride_requests') || { assigned: 0, total: 0 };

  // We show the split card if either category exists OR if the action buttons are enabled
  const shouldShowSplitCard = (!!rideOffersCategory || !!rideRequestsCategory || !!onOfferRide || !!onRideRequest);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Render Split Card First if applicable */}
        {shouldShowSplitCard && (
          <RideSplitCard
            onSelect={onSelectCategory}
            offerProgress={offerProgress}
            requestProgress={requestProgress}
            showOffers={!!rideOffersCategory || !!onOfferRide}
            showRequests={!!rideRequestsCategory || !!onRideRequest}
          />
        )}

        {standardCategories.map((category) => {
          const progress = categoryProgressMap.get(category.id) || { assigned: 0, total: 0 };

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
              <div className="aurora-glow" style={{ backgroundColor: category.color + '40' }}></div>

              <div className="relative z-10 flex flex-col items-center h-full">
                <img
                  src={`/Icons/${category.icon}`}
                  alt={category.name}
                  className="w-20 h-20 mx-auto mb-3 object-contain transition-transform duration-300 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/Icons/general.png';
                  }}
                />
                <h3 className="text-xl font-bold text-neutral-800 mb-2">{category.name}</h3>

                <div className="flex-grow"></div>

                <div className="w-full">
                  <p className="text-center text-neutral-500 text-sm mb-4">
                    {category.id === 'ride_offers' || category.id === 'trempim'
                      ? `${progress.total - progress.assigned} מושבים פנויים`
                      : category.id === 'ride_requests'
                        ? `${progress.total - progress.assigned} נוסעים ללא טרמפ`
                        : `${progress.assigned} / ${progress.total} שובצו`
                    }
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
          className="w-full flex items-center justify-center text-white font-semibold py-3 px-2 sm:px-6 rounded-lg shadow-lg transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-accent bg-accent-dark hover:bg-accent-dark/90 disabled:bg-neutral-400 disabled:cursor-not-allowed"
        >
          <Plus size={20} className="ml-2 flex-shrink-0" />
          <span className="truncate">הוסף פריט {showLimit && `(${userCreatedItemsCount}/${MAX_USER_ITEMS})`}</span>
        </button>
      </div>
    </div>
  );
};
