import i18n from '../i18n';

export const getErrorMessage = (error: any): string => {
    if (!error) return i18n.t('errors.general');

    // Firebase Auth Errors
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                return i18n.t('errors.auth.userNotFound');
            case 'auth/wrong-password':
                return i18n.t('errors.auth.wrongPassword');
            case 'auth/email-already-in-use':
                return i18n.t('errors.auth.emailInUse');
            case 'auth/too-many-requests':
                return i18n.t('errors.auth.tooManyRequests');
            case 'permission-denied':
                return i18n.t('errors.auth.permissionDenied');
            default:
                // Fallback to error message if no translation key found, or general error
                return i18n.exists(`errors.firebase.${error.code}`)
                    ? i18n.t(`errors.firebase.${error.code}`)
                    : error.message || i18n.t('errors.general');
        }
    }

    // General Error Objects
    if (error.message) {
        return error.message;
    }

    return i18n.t('errors.general');
};
