import { MenuItem } from '../types';

export interface DriverGroup {
  id: string; // Composite ID for keys
  creatorId: string;
  creatorName: string;
  outbound?: MenuItem;
  returnRide?: MenuItem;
  // If a driver has multiple unconnected rides, or non-ride items, we might need to handle them.
  // For simplicity, we'll try to pair the first "to_event" with the first "from_event" found.
  // Any extra rides will remain as ungrouped items? Or we group all? 
  // Let's stick to simple pairing for now.
}

export type DisplayItem =
  | { type: 'single'; item: MenuItem }
  | { type: 'group'; group: DriverGroup };

export const groupItemsByDriver = (items: MenuItem[]): DisplayItem[] => {
  const rides = items.filter(item =>
    item.category === 'ride_offers' ||
    item.category === 'ride_requests' ||
    item.category === 'trempim' ||
    item.category === 'rides'
  );

  // Non-ride items are passed through as singles
  const nonRides = items.filter(item => !rides.includes(item));

  const displayItems: DisplayItem[] = nonRides.map(item => ({ type: 'single', item }));

  // Processing rides
  const ridesByCreator: Record<string, MenuItem[]> = {};

  rides.forEach(ride => {
    if (!ride.creatorId) {
      // Should not happen for valid rides, but safe fallback
      displayItems.push({ type: 'single', item: ride });
      return;
    }
    if (!ridesByCreator[ride.creatorId]) {
      ridesByCreator[ride.creatorId] = [];
    }
    ridesByCreator[ride.creatorId].push(ride);
  });

  Object.values(ridesByCreator).forEach(creatorRides => {
    // We try to form pairs
    const toEvent = creatorRides.find(r => r.direction === 'to_event');
    const fromEvent = creatorRides.find(r => r.direction === 'from_event');

    // If we have ONE To and ONE From -> Group!
    // What if we have 2 'to_event' for same driver? (Rare, allowing multiple cars?)
    // For this version, we'll take the first of each and group them. 
    // Any leftovers become singles.

    const usedIds = new Set<string>();

    if (toEvent && fromEvent) {
      // Match found
      displayItems.push({
        type: 'group',
        group: {
          id: `group_${toEvent.creatorId}`,
          creatorId: toEvent.creatorId,
          creatorName: toEvent.creatorName,
          outbound: toEvent,
          returnRide: fromEvent
        }
      });
      usedIds.add(toEvent.id);
      usedIds.add(fromEvent.id);
    }

    // Add remaining creator items as singles
    creatorRides.forEach(ride => {
      if (!usedIds.has(ride.id)) {
        displayItems.push({ type: 'single', item: ride });
      }
    });
  });

  // We might want to maintain some sort of order? 
  // Currently this pushes non-rides first, then grouped rides.
  // If the original list was sorted by time, we might lose that strict order across categories.
  // Ideally, we respect the original sort as much as possible.
  // But since we are grouping, we can't respect two different timestamps perfectly.
  // Let's sort the result by the time of the PRIMARY element (outbound or single item).

  return displayItems.sort((a, b) => {
    const timeA = getDisplayTime(a);
    const timeB = getDisplayTime(b);
    return timeA.localeCompare(timeB);
  });
};

const getDisplayTime = (d: DisplayItem): string => {
  if (d.type === 'single') return d.item.departureTime || '99:99';
  // For group, use outbound time, or return time if outbound missing (unlikely in this logic but safe)
  return d.group.outbound?.departureTime || d.group.returnRide?.departureTime || '99:99';
};
