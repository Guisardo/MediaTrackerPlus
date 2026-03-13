import type { LinguiConfig } from '@lingui/conf';

const config: LinguiConfig = {
  sourceLocale: 'en',
  locales: [
    'af', 'ar', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi',
    'fr', 'he', 'hu', 'it', 'ja', 'ko', 'nl', 'no', 'pl', 'pt',
    'ro', 'ru', 'sr', 'sv', 'tr', 'uk', 'vi', 'zh',
  ],
  catalogs: [
    {
      path: 'src/i18n/locales/{locale}/translation',
      include: ['src'],
    },
  ],
  fallbackLocales: {
    default: 'en',
  },
  format: 'po',
  compileNamespace: 'ts',
};

export default config;
