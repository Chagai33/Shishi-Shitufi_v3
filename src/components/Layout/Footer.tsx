import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';

export function Footer() {
  const toggleDeleteAccountModal = useStore(state => state.toggleDeleteAccountModal);
  
  // Adding call to user state
  const { user } = useStore();
  const isRegisteredUser = user && user.email;

  return (
    <footer className="bg-neutral-100 border-t border-neutral-200 mt-auto py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-neutral-500">
        <div className="flex justify-center items-center space-x-4 rtl:space-x-reverse">
          <Link to="/terms" className="hover:text-neutral-700 transition-colors">
            תנאי שימוש
          </Link>
          <span>|</span>
          <Link to="/privacy" className="hover:text-neutral-700 transition-colors">
            מדיניות פרטיות
          </Link>
           <span>|</span>
          {/* "Feedback" button that is always displayed */}
          <button
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfoHsGWZj4ehj8YHwEQ2gpME5LAEtGRv8iuxkV7ioFIEw1AhA/viewform?usp=header', '_blank')}
            className="text-neutral-500 hover:text-neutral-700 transition-colors font-medium"
          >
            משוב
          </button>
          {/* Adding condition for displaying the button */}
          {isRegisteredUser && (
            <>
              <span>|</span>
              <button
                onClick={toggleDeleteAccountModal}
                className="text-error hover:text-error/80 transition-colors font-medium"
              >
                מחק חשבון
              </button>
              
            </>
          )}

        </div>
        <div className="mt-2">
          <p>
            פותח ע"י{' '}
            <a
              href="https://www.linkedin.com/in/chagai-yechiel/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-600 hover:text-primary transition-colors"
            >
              חגי יחיאל
            </a>
          </p>
          <p className="mt-1">
            אייקונים באדיבות{' '}
            <a
              href="https://www.flaticon.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-neutral-600 hover:text-primary transition-colors"
            >
              Flaticon.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}