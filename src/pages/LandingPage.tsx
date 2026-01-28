import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Users, CheckCircle, ArrowLeft } from 'lucide-react';
import LanguageSwitcher from '../components/Common/LanguageSwitcher';

const LandingPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col bg-white rtl text-gray-900">
      {/* Header */}
      <header className="py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 rounded-lg p-1.5">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">{t('header.title')}</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-orange-600 transition-colors px-4 py-2 rounded-md hover:bg-orange-50"
            >
              {t('landing.header.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        {/* CHANGED: Reduced bottom padding from pb-20 to pb-8 to fix wasted space */}
        <section className="pt-16 pb-8 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-orange-600 uppercase bg-orange-100 rounded-full">
              {t('landing.hero.badge')}
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
              {t('landing.hero.title')} <span className="text-orange-500">{t('landing.hero.titleHighlight')}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-orange-600 rounded-full hover:bg-orange-700 hover:shadow-lg hover:-translate-y-0.5"
            >
              {t('landing.hero.cta')}
              <ArrowLeft className="mr-2 w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Use Cases & Differentiator */}
        {/* CHANGED: Reduced top padding from py-20 to pt-8 pb-20 */}
        <section className="pt-8 pb-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">

              {/* Use Cases */}
              <div className="space-y-8 order-2 md:order-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('landing.useCases.title')}</h3>
                <ul className="space-y-6">
                  {(t('landing.useCases.items', { returnObjects: true }) as string[]).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="bg-teal-100 p-2 rounded-full text-teal-700 flex-shrink-0">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <span className="text-lg font-medium text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Differentiator Box */}
              <div className="order-1 md:order-2 bg-gradient-to-br from-orange-50 to-white border border-orange-100 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-lg shadow-orange-100/50">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-orange-200 rounded-full opacity-30 blur-3xl"></div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-sm mb-8">
                    <Users className="w-8 h-8 text-orange-600" />
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-6">
                    {t('landing.differentiator.title')}
                  </h3>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {t('landing.differentiator.text.part1')}
                    <br />
                    <strong className="text-orange-700 text-xl block mt-4 mb-2">
                      {t('landing.differentiator.text.highlight')}
                    </strong>
                    {t('landing.differentiator.text.part2')}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">{t('landing.story.title')}</h2>
            <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
              <div className="prose prose-lg mx-auto text-gray-700 rtl:text-right">
                <p>
                  {t('landing.story.p1')}
                </p>
                <p>
                  {t('landing.story.p2')}
                </p>
                <p className="font-bold text-orange-600">
                  {t('landing.story.p3')}
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default LandingPage;
