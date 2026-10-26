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
/**
 * The code for a failure that happened on this device, before anything was
 * sent anywhere.
 *
 * There is one so far: the browser could not open the picture the organiser
 * chose. It is thrown at the call point and read here, so that the sentence and
 * the code that reaches it stay in the one file, which is what this file is
 * for. It cannot collide with a code from the client library, since every one
 * of those is prefixed with functions/.
 */
export const IMAGE_PREP_FAILED = 'smartImport/image-prep-failed';

export function getSmartImportErrorMessage(error: any): string {
  const details = error?.details || {};

  switch (error?.code) {
    // Nothing was sent, so nothing here is about the model or the list. The
    // picture is being resized and re-encoded in the browser before it goes,
    // and that is what failed: a format this browser cannot open, which a
    // phone can hand over without either of them doing anything unusual.
    //
    // It used to fall through to the general sentence, "reading the list
    // failed, try again". That named a list that had never been sent and sent
    // the organiser off to reword text that was not the problem, while the one
    // thing that would have worked, choosing another picture, was never
    // mentioned.
    case IMAGE_PREP_FAILED:
      return i18n.t('importModal.smart.errors.image');

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

    // The service on the other end is switched off, in one of several ways.
    //
    // This is what a spending ceiling looks like from here: when billing on the
    // project is stopped the function stops being served, and the client sees a
    // 404 or a 403 depending on how it was stopped, never anything we wrote.
    // The same three arrive when it has not been deployed yet, or when it is
    // being deployed right now.
    //
    // The function also answers this way on purpose, in two cases where it did
    // run: the counter could not be reached, and the account behind the model
    // is out of prepaid credit. The second is marked CREDIT_DEPLETED, which is
    // read in the log and nowhere else. It is deliberately not the quota
    // sentence: a quota comes back within the hour and credit does not come
    // back until somebody pays, so "try again later" is the wrong advice.
    // See DOCS/PLANING/121-the-smart-import-is-down-the-credits-ran-out.md.
    //
    // So they say the service is not available and that items can be added by
    // hand, rather than "try again": trying again does not help while the thing
    // on the other end is switched off, and an organiser who is told to retry
    // will sit there retrying.
    case 'functions/unavailable':
    case 'functions/not-found':
    case 'functions/permission-denied':
      return i18n.t('importModal.smart.errors.unavailable');

    // Two unrelated things arrive under this one code, and the error itself
    // cannot tell them apart: the request never left the device, and the
    // function on the other end threw.
    //
    // Measured in the client library on 26/10/2026. codeForHTTPStatus maps
    // status 0 to internal, and its own comment on that line says "This can
    // happen if the server returns 500". The line that catches a failed fetch
    // says the same in words: there is no way to know, because an unhandled
    // error on the backend fails to set the CORS header and is therefore seen
    // by fetch as a network error.
    //
    // So the distinction has to come from somewhere other than the error, and
    // it is only taken in the direction that is worth anything. A browser
    // saying it has no connection is right about that. A browser saying it has
    // one proves nothing about whether this request reached anything, which is
    // why the sentence this code has always had stays the default and the
    // connection sentence is the exception.
    case 'functions/internal':
      return browserSaysOffline()
        ? i18n.t('importModal.smart.errors.network')
        : i18n.t('importModal.smart.errors.internal');

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

  return i18n.t('importModal.smart.errors.general');
}

/**
 * Whether the browser says this device has no way out at all.
 *
 * The connection sentence used to be reached by asking whether the error
 * message contained the word network, and it was never once shown: no message
 * the function writes contains that word, so the branch was dead from the day
 * it was written. Measured 26/10/2026, record 127. It is not worth putting
 * back, because the server cannot know about the organiser's connection and the
 * message it sends is not evidence about it either way.
 *
 * This is trustworthy in one direction only, which is why the caller uses it to
 * replace a sentence and never to keep one. False means the browser has no
 * route out and is right about it. True means an interface is up, which says
 * nothing about whether anything was reached.
 */
function browserSaysOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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
