import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
    className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
    const { i18n } = useTranslation();

    const handleLanguageChange = () => {
        const currentLang = i18n.language;
        // Toggle only between Hebrew and English
        const nextLang = currentLang === 'he' ? 'en' : 'he';
        i18n.changeLanguage(nextLang);
    };

    return (
        <button
            onClick={handleLanguageChange}
            className={`text-gray-600 hover:text-gray-900 transition-colors focus:outline-none p-1 rounded-full hover:bg-gray-100 ${className}`}
            title={i18n.language === 'he' ? 'Switch to English' : 'החלף לעברית'}
        >
            <Globe size={20} />
        </button>
    );
};

export default LanguageSwitcher;
