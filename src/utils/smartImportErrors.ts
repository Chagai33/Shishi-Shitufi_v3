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

    case 'functions/unavailable':
      return i18n.t('importModal.smart.errors.unavailable');

    case 'functions/internal':
      return i18n.t('importModal.smart.errors.internal');
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
