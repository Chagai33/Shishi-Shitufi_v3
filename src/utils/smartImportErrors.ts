import i18n from '../i18n';

/**
 * What a screen says when a call to the smart import fails.
 *
 * One place, because there are three call points on the same function and they
 * used to answer for it in three different ways: one mapped the error codes to
 * Hebrew, one showed a single sentence for every failure whatever it was, and
 * one printed error.message, which arrives from the server in English. The same
 * failure had three faces depending on which button had been pressed.
 *
 * The rule this file exists to hold: nothing the server wrote is ever put on
 * screen. Server messages are written for logs, in English, and they name things
 * a person using this product has no reason to know about. An error nobody here
 * recognises gets the general sentence, not a passed-through string.
 *
 * See DOCS/PLANING/53-ai-limits-and-costs.md.
 */
export function getSmartImportErrorMessage(error: any): string {
  const details = error?.details || {};

  switch (error?.code) {
    case 'functions/resource-exhausted':
      // Two different things arrive under this one code: this caller has used
      // their own allowance up, or the model's quota is gone for everybody.
      // They call for different sentences, so the function marks which it is.
      if (details.originalError === 'RATE_LIMITED') {
        return whenFreeAgain(details.retryAfterMinutes);
      }
      return i18n.t('importModal.smart.errors.quota');

    case 'functions/invalid-argument':
      // The screens stop an over long list before it is sent, so this only
      // arrives when a screen is older than the function it is talking to.
      return details.originalError === 'TEXT_TOO_LONG'
        ? i18n.t('importModal.smart.errors.tooLong')
        : i18n.t('importModal.smart.errors.invalidInput');

    case 'functions/failed-precondition':
      return i18n.t('importModal.smart.errors.safety');

    case 'functions/data-loss':
      return i18n.t('importModal.smart.errors.parse');

    // The function is not answering at all, and none of our code ran.
    //
    // This is what a spending ceiling looks like from here: when billing on the
    // project is stopped the function stops being served, and the client sees a
    // 404 or a 403 depending on how it was stopped, never anything we wrote.
    // The same three arrive when it has not been deployed yet, or when it is
    // being deployed right now.
    //
    // So they say the service is not available and that items can be added by
    // hand, rather than "try again": trying again does not help while the thing
    // on the other end is switched off, and an organiser who is told to retry
    // will sit there retrying.
    case 'functions/unavailable':
    case 'functions/not-found':
    case 'functions/permission-denied':
      return i18n.t('importModal.smart.errors.unavailable');

    case 'functions/internal':
      return i18n.t('importModal.smart.errors.internal');

    // The caller's own sign-in is gone. Everybody here is signed in, most of
    // them anonymously and without ever being asked, so this is a session that
    // expired rather than a person who has to make an account.
    case 'functions/unauthenticated':
      return i18n.t('importModal.smart.errors.signedOut');

    // Ran out of time rather than failed. A photograph of a handwritten list is
    // the way to reach this, so the advice is about size and not about retrying.
    case 'functions/deadline-exceeded':
      return i18n.t('importModal.smart.errors.tooSlow');
  }

  if (typeof error?.message === 'string' && error.message.includes('network')) {
    return i18n.t('importModal.smart.errors.network');
  }

  return i18n.t('importModal.smart.errors.general');
}

/**
 * How long the caller has to wait, said in a way that reads properly.
 *
 * Never one of anything, which is the whole reason this is written out rather
 * than handed to Intl.RelativeTimeFormat: Hebrew has a separate form for one and
 * for two, and the platform's own Hebrew rendering of a single hour is
 * "בעוד שעה (1)", brackets and all. Rounding up to at least two of a unit costs
 * the caller under a minute of accuracy and always reads as a sentence. It also
 * errs towards waiting slightly too long rather than too little, which is the
 * harmless direction.
 */
function whenFreeAgain(minutes: unknown): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return i18n.t('importModal.smart.errors.rateLimitedLater');
  }

  return minutes < 90
    ? i18n.t('importModal.smart.errors.rateLimitedMinutes', { minutes: Math.max(2, Math.ceil(minutes)) })
    : i18n.t('importModal.smart.errors.rateLimitedHours', { hours: Math.max(2, Math.ceil(minutes / 60)) });
}
