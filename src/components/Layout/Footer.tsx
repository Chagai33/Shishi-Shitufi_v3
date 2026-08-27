import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { useTranslation } from 'react-i18next';

interface FooterProps {
  // Whether the person reading this page is signed in without an account -
  // somebody who opened an invitation link. They have no user record to read
  // this from, by design, so the app tells the footer instead.
  // See DOCS/PLANING/26-anonymous-visitors-leave-empty-profiles.md.
  isAnonymousVisitor?: boolean;
}

export function Footer({ isAnonymousVisitor = false }: FooterProps) {
  const { t, i18n } = useTranslation();
  const toggleDeleteAccountModal = useStore(state => state.toggleDeleteAccountModal);

  // Adding call to user state
  const { user } = useStore();
  const isRegisteredUser = user && user.email;

  // The button used to be offered only to people with an email address, which
  // meant the group whose data is almost all of the data in the database could
  // not ask for any of it back: 358 of the 359 rows on the participant lists
  // belong to guests. The server never had that restriction - it asks only
  // that the caller be signed in, and a guest is - so this was a button
  // missing from a screen, not a capability missing from the product.
  // See DOCS/PLANING/24-anonymous-visitor-cannot-delete-account.md.
  const canDeleteOwnData = isRegisteredUser || isAnonymousVisitor;

  return (
    <footer className="bg-neutral-100 border-t border-neutral-200 mt-auto py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-neutral-600">
        {/* The row wraps to a second line on a phone. It used to be forbidden
            to wrap, so once the links stopped fitting each one shrank instead
            and its words stacked up: at 375px the row grew from one line to
            three of broken words. It was already happening in English before
            the fifth link was added here.
            gap replaces space-x because space-x puts its margin on every child
            but the first, which lands in the wrong place once a line wraps,
            and because gap needs no right-to-left reversal. */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1">
          <Link to="/terms" className="hover:text-neutral-900 transition-colors">
            {t('footer.terms')}
          </Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-neutral-900 transition-colors">
            {t('footer.privacy')}
          </Link>
          <span>|</span>
          {/* "Feedback" button that is always displayed */}
          <button
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfoHsGWZj4ehj8YHwEQ2gpME5LAEtGRv8iuxkV7ioFIEw1AhA/viewform?usp=header', '_blank')}
            className="text-neutral-600 hover:text-neutral-900 transition-colors font-medium"
            aria-label={`${t('footer.feedback')} (${t('common.opensInNewTab')})`}
          >
            {t('footer.feedback')}
          </button>
          <span>|</span>
          {/* The only entrance to the page that says what changed in the
              product. The product owner decided it lives here and nowhere
              else: not in the menu, not in the header.
              See DOCS/PLANING/61-whats-new-page.md. */}
          <Link to="/updates" className="hover:text-neutral-900 transition-colors">
            {t('footer.whatsNew')}
          </Link>
          {/* Adding condition for displaying the button */}
          {canDeleteOwnData && (
            <>
              <span>|</span>
              <button
                onClick={toggleDeleteAccountModal}
                className="text-error hover:text-error/80 transition-colors font-medium"
              >
                {/* A guest has no account to delete, so calling it that would
                    be describing something they do not have. What they have is
                    a name and a phone number sitting in events. */}
                {isRegisteredUser ? t('footer.deleteAccount') : t('footer.deleteMyData')}
              </button>

            </>
          )}

        </div>
        <div className="mt-2">
          <p>
            {t('footer.developedBy')}{' '}
            <a
              href="https://www.linkedin.com/in/chagai-yechiel/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-700 hover:text-primary transition-colors"
              aria-label={i18n.language === 'en' ? 'Chagai Yechiel (opens in a new tab)' : 'חגי יחיאל (נפתח בכרטיסייה חדשה)'}
            >
              {i18n.language === 'en' ? 'Chagai Yechiel' : 'חגי יחיאל'}
            </a>
          </p>
          <p className="mt-1">
            {t('footer.iconsBy')}{' '}
            <a
              href="https://www.flaticon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-700 hover:text-primary transition-colors"
              aria-label="Flaticon.com (opens in a new tab)"
            >
              Flaticon.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}