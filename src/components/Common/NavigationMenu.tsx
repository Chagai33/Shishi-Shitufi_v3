import React, { useState, useRef, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// --- Brand Icons ---
// --- Brand Icons (Modern & Consistent) ---
interface NavigationMenuProps {
    location: string;
}

const NavigationMenu: React.FC<NavigationMenuProps> = ({ location }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const encodedLocation = encodeURIComponent(location);

    const navigationOptions = [
        {
            name: t('navigation.waze'),
            url: `https://waze.com/ul?q=${encodedLocation}&navigate=yes`,
            icon: "/Icons/waze.png",
            bgColor: "bg-[#33CCFF]/10 hover:bg-[#33CCFF]/20"
        },
        {
            name: t('navigation.googleMaps'),
            url: `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`,
            icon: "/Icons/google-maps.png",
            bgColor: "bg-red-50 hover:bg-red-100"
        },
        {
            name: t('navigation.appleMaps'),
            url: `http://maps.apple.com/?q=${encodedLocation}`,
            icon: "/Icons/apple.png",
            bgColor: "bg-gray-100 hover:bg-gray-200"
        }
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-block" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center hover:text-blue-600 hover:underline transition-colors group text-sm text-neutral-600"
                title={t('eventPage.details.navigate')}
            >
                <MapPin size={14} className="ml-1.5 flex-shrink-0 group-hover:text-blue-500" />
                {location}
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 animate-fadeIn flex items-center gap-3 min-w-[200px] justify-center">
                    {/* Arrow */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white transform rotate-45 border-l border-t border-gray-100"></div>

                    {navigationOptions.map((option) => (
                        <a
                            key={option.name}
                            href={option.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 group relative ${option.bgColor}`}
                            onClick={() => setIsOpen(false)}
                            title={option.name}
                        >
                            <div className="transform transition-transform group-hover:scale-110 group-active:scale-95">
                                <img
                                    src={option.icon}
                                    alt={option.name}
                                    className="w-10 h-10 object-contain"
                                />
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
};

export default NavigationMenu;
