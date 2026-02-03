import React from 'react';
import { Calendar, Clock, MapPin, Users, ChefHat } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ShishiEvent, MenuItem } from '../../types';
import { formatDate, formatTime, isEventPast, isEventFinished } from '../../utils/dateUtils';

interface EventCardProps {
  event: ShishiEvent;
  menuItems: MenuItem[];
  onViewDetails: (event: ShishiEvent) => void;
}

export function EventCard({ event, menuItems, onViewDetails }: EventCardProps) {
  const { t } = useTranslation();
  const eventMenuItems = menuItems.filter(item => item.eventId === event.id);
  const assignedItems = eventMenuItems.filter(item => item.assignedTo);
  const totalItems = eventMenuItems.length;
  const assignmentPercentage = totalItems > 0 ? (assignedItems.length / totalItems) * 100 : 0;

  const isPast = isEventPast(event.details.date, event.details.time);
  const isFinished = isEventFinished(event.details.date, event.details.time);

  return (
    <div
      className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border-r-4 ${isPast
        ? 'border-gray-400 opacity-75'
        : event.details.isActive
          ? 'border-orange-500 hover:scale-[1.02]'
          : 'border-gray-300'
        } cursor-pointer`}
      onClick={() => onViewDetails(event)}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {event.details.title}
          </h3>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${isPast
            ? 'bg-gray-100 text-gray-600'
            : isFinished
              ? 'bg-yellow-100 text-yellow-700'
              : event.details.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
            {isPast
              ? 'הסתיים'
              : isFinished
                ? 'בעיצומו'
                : event.details.isActive
                  ? 'פעיל'
                  : 'לא פעיל'
            }
          </div>
        </div>

        {/* Event Details */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 ml-2" />
            <span className="text-sm">{formatDate(event.details.date)}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 ml-2" />
            <span className="text-sm">{formatTime(event.details.time)}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <MapPin className="h-4 w-4 ml-2" />
            <span className="text-sm truncate">{event.details.location}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Users className="h-4 w-4 ml-2" />
            <span className="text-sm">מארח: {event.organizerName}</span>
          </div>
        </div>

        {/* Assignment Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-gray-600">
              <ChefHat className="h-4 w-4 ml-2" />
              <span className="text-sm">{t('dashboard.eventCard.stats.progress')}</span>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {totalItems > 0 ? (
                `${assignedItems.length}/${totalItems}`
              ) : (
                <span className="text-xs text-gray-500">{t('dashboard.eventCard.stats.noItems')}</span>
              )}
            </span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${assignmentPercentage === 100
                ? 'bg-green-500'
                : assignmentPercentage >= 50
                  ? 'bg-blue-500'
                  : 'bg-orange-500'
                }`}
              style={{ width: `${assignmentPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Description */}
        {event.details.description && (
          <p className="text-gray-600 text-sm line-clamp-2 mb-4">
            {event.details.description}
          </p>
        )}

        {/* Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(event);
          }}
          className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${isPast
            ? 'bg-gray-100 text-gray-600 cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          disabled={isPast}
        >
          {isPast ? 'האירוע הסתיים' : 'צפה בפרטים'}
        </button>
      </div>
    </div>
  );
}