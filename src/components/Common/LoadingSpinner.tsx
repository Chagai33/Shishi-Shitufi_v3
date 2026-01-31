// src/components/Common/LoadingSpinner.tsx

import React from 'react';

import { useTranslation } from 'react-i18next';

const LoadingSpinner: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500"></div>
      <p className="mt-4 text-lg text-gray-600">{t('common.loadingApp')}</p>
    </div>
  );
};
export default LoadingSpinner;