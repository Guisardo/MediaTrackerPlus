import '@testing-library/jest-dom';
import { setupI18n } from 'src/i18n/i18n';

// Lingui v5 requires i18n to be activated before any translation function can be called.
// This ensures all tests have access to the translation context.
setupI18n();
