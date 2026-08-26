// src/components/Common/EmailVerificationNotice.tsx

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { MailWarning } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { FirebaseService } from '../../services/firebaseService';

/**
 * Says that nobody has yet proved this address belongs to the person using it.
 *
 * It blocks nothing. Whoever came here to organise an event can carry on doing
 * exactly that, which is the whole point of showing a line rather than a wall:
 * the friction of proving an address lands on the one day somebody is trying
 * the product for the first time, and that is the worst day to add it.
 *
 * It names the address out loud, because the person who mistyped their own is
 * the one who will never receive anything and will never otherwise find out.
 * See DOCS/PLANING/37-no-email-verification.md.
 */
const EmailVerificationNotice: React.FC = () => {
  const { t } = useTranslation();
  const [isVerified, setIsVerified] = useState(() => auth.currentUser?.emailVerified ?? true);
  const [isSending, setIsSending] = useState(false);
  const [wasSent, setWasSent] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        await user.reload();
      } catch (error) {
        // Swallowed, and deliberately without consequence. This same question
        // can fail with the very answer that means the account behind the
        // session is gone, and there is already one place in the product that
        // decides what to do about that, written carefully after a live person
        // was nearly thrown out over a request that did not come back. A strip
        // at the top of a screen does not get a second opinion on it. The worst
        // this costs is a notice that stays up one screen longer.
        console.warn('Could not refresh the address verification state:', error);
        return;
      }
      if (!cancelled) setIsVerified(auth.currentUser?.emailVerified ?? true);
    };

    refresh();

    // The link is opened somewhere else entirely: another tab, or a phone. The
    // browser here goes on believing the address is unverified until it is
    // told otherwise, so it is asked again whenever somebody comes back to
    // this window. Once the answer is yes the notice is gone and so is this.
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const handleResend = useCallback(async () => {
    setIsSending(true);
    try {
      await FirebaseService.sendEmailVerification();
      setWasSent(true);
      toast.success(t('account.emailVerification.sent'));
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      toast.error(
        code === 'auth/too-many-requests'
          ? t('account.emailVerification.tooMany')
          : t('account.emailVerification.error')
      );
    } finally {
      setIsSending(false);
    }
  }, [t]);

  if (isVerified) return null;

  const email = auth.currentUser?.email || '';
  if (!email) return null;

  return (
    <div className="mx-4 sm:mx-0 mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <MailWarning className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {t('account.emailVerification.title')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">
            {t('account.emailVerification.body', { email })}
          </p>
          {/* Locked after one send. The service turns away mail asked for too
              often, so three impatient presses produce an error instead of a
              mail. */}
          <button
            type="button"
            onClick={handleResend}
            disabled={isSending || wasSent}
            className="mt-3 text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700 disabled:no-underline disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSending
              ? t('account.emailVerification.sending')
              : wasSent
                ? t('account.emailVerification.resent')
                : t('account.emailVerification.resend')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationNotice;
