import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Calendar, Users, CheckCircle, ArrowLeft, Zap } from 'lucide-react';
import LanguageSwitcher from '../components/Common/LanguageSwitcher';

// Screenshots of the product, not drawings of it. This is a visual product and
// the page used to describe it in words only, which asked a stranger to imagine
// the one thing a single picture explains.
// See DOCS/PLANING/107-the-landing-page-never-shows-the-product.md
//
// The board comes in two crops on purpose. The wide one is a desktop screen and
// would shrink to unreadable text on a phone, so a phone is served a portrait
// crop of the same board instead. Each screen downloads one of them, never both.
import boardWide from '../assets/landing/event-board-wide.webp';
import boardNarrow from '../assets/landing/event-board-narrow.webp';
import smartImportShot from '../assets/landing/smart-import.webp';
import rideOfferShot from '../assets/landing/ride-offer.webp';

const LandingPage = () => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col bg-white rtl text-gray-900">
      {/* Skip Link */}
      <a
        href="#main-content"
        className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-accent-dark focus:text-white focus:rounded-md focus:shadow-lg"
      >
        {t('common.skipToContent')}
      </a>

      {/* Header */}
      <header className="py-4 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label={t('landing.nav.main')} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="bg-accent rounded-lg p-1.5" aria-hidden="true">
                <Calendar className="w-5 h-5 text-white" aria-hidden="true" />
              </div>
              <span className="font-bold text-xl tracking-tight">{t('header.title')}</span>
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher />
              <Link
                to="/login"
                className="text-sm font-medium text-gray-600 hover:text-accent transition-colors px-4 py-2 rounded-md hover:bg-accent/10"
              >
                {t('landing.header.login')}
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-grow">
        {/* Hero Section */}
        {/* CHANGED: Reduced bottom padding from pb-20 to pb-8 to fix wasted space */}
        <section aria-labelledby="hero-heading" className="pt-16 pb-8 px-4 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-accent uppercase bg-accent/10 rounded-full">
              {t('landing.hero.badge')}
            </div>
            <h1 id="hero-heading" className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
              {t('landing.hero.title')} <span className="text-accent">{t('landing.hero.titleHighlight')}</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white transition-all duration-200 bg-accent-dark rounded-full hover:bg-accent-dark/90 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
            >
              {t('landing.hero.cta')}
              <ArrowLeft className="mr-2 w-5 h-5" aria-hidden="true" />
            </Link>

            {/* Below the button and not above it. Above it the button would drop
                off a phone screen, and the button being large and above the fold
                is one of the things this page already got right. */}
            <picture>
              <source media="(min-width: 768px)" srcSet={boardWide} width={1500} height={1073} />
              <img
                src={boardNarrow}
                width={756}
                height={1186}
                alt={t('landing.hero.boardAlt')}
                className="mt-12 mx-auto w-full max-w-sm md:max-w-4xl h-auto rounded-2xl shadow-xl ring-1 ring-gray-900/5"
              />
            </picture>
          </div>
        </section>

        {/* Core Features Section */}
        <section aria-labelledby="core-features-heading" className="py-16 px-4 bg-gray-50 border-t border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <h2 id="core-features-heading" className="text-3xl font-bold text-gray-900 mb-12 text-center">
              {t('landing.features.title')}
            </h2>
            <div className="grid md:grid-cols-3 gap-8 items-start">
              {/* Smart Import. The icon here was a generic robot; what convinces
                  is the messy message an organiser already has in hand, and the
                  list that comes out of it. */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col text-center transition-transform hover:-translate-y-1 hover:shadow-md duration-300">
                <img
                  src={smartImportShot}
                  width={700}
                  height={897}
                  loading="lazy"
                  decoding="async"
                  alt={t('landing.features.smartImport.alt')}
                  className="w-full h-auto border-b border-gray-100"
                />
                <div className="p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{t('landing.features.smartImport.title')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.features.smartImport.description')}</p>
                </div>
              </div>

              {/* Carpooling. The one thing here no comparable product does. */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col text-center transition-transform hover:-translate-y-1 hover:shadow-md duration-300">
                <img
                  src={rideOfferShot}
                  width={720}
                  height={581}
                  loading="lazy"
                  decoding="async"
                  alt={t('landing.features.carpooling.alt')}
                  className="w-full h-auto border-b border-gray-100"
                />
                <div className="p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{t('landing.features.carpooling.title')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('landing.features.carpooling.description')}</p>
                </div>
              </div>

              {/* No Registration */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center transition-transform hover:-translate-y-1 hover:shadow-md duration-300">
                <div className="bg-teal-100 p-4 rounded-full text-teal-600 mb-6">
                  <Zap className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{t('landing.features.noRegistration.title')}</h3>
                <p className="text-gray-600 leading-relaxed">{t('landing.features.noRegistration.description')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases & Differentiator */}
        {/* CHANGED: Reduced top padding from py-20 to pt-8 pb-20 */}
        <section aria-labelledby="features-heading" className="pt-8 pb-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">

              {/* Use Cases */}
              <div className="space-y-8 order-2 md:order-1">
                <h2 id="features-heading" className="text-2xl font-bold text-gray-900 mb-6">{t('landing.useCases.title')}</h2>
                <ul className="space-y-6">
                  {(t('landing.useCases.items', { returnObjects: true }) as string[]).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                      <div className="bg-teal-100 p-2 rounded-full text-teal-700 flex-shrink-0" aria-hidden="true">
                        <CheckCircle className="w-5 h-5" aria-hidden="true" />
                      </div>
                      <span className="text-lg font-medium text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Differentiator Box */}
              <div className="order-1 md:order-2 bg-gradient-to-br from-accent/10 to-white border border-accent/20 rounded-3xl p-8 md:p-12 relative overflow-hidden shadow-lg shadow-accent/10">
                <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-accent/40 rounded-full opacity-30 blur-3xl" aria-hidden="true"></div>
                <div className="relative z-10">
                  <div className="inline-flex items-center justify-center p-3 bg-white rounded-xl shadow-sm mb-8" aria-hidden="true">
                    <Users className="w-8 h-8 text-accent" aria-hidden="true" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-6">
                    {t('landing.differentiator.title')}
                  </h2>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {t('landing.differentiator.text.part1')}
                    <br />
                    <strong className="text-accent/90 text-xl block mt-4 mb-2">
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
        <section aria-labelledby="story-heading" className="py-20 bg-gray-50">
          <div className="max-w-3xl mx-auto px-4">
            <h2 id="story-heading" className="text-3xl font-bold text-gray-900 mb-10 text-center">{t('landing.story.title')}</h2>
            <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-gray-100">
              <div className="prose prose-lg mx-auto text-gray-700 rtl:text-right">
                <p>
                  {t('landing.story.p1')}
                </p>
                <p>
                  {t('landing.story.p2')}
                </p>
                <p className="font-bold text-accent">
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
