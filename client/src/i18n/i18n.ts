import { i18n } from '@lingui/core';
import { detect, fromNavigator } from '@lingui/detect-locale';

import { messages as af } from 'src/i18n/locales/af/translation';
import { messages as ar } from 'src/i18n/locales/ar/translation';
import { messages as ca } from 'src/i18n/locales/ca/translation';
import { messages as cs } from 'src/i18n/locales/cs/translation';
import { messages as da } from 'src/i18n/locales/da/translation';
import { messages as de } from 'src/i18n/locales/de/translation';
import { messages as el } from 'src/i18n/locales/el/translation';
import { messages as en } from 'src/i18n/locales/en/translation';
import { messages as es } from 'src/i18n/locales/es/translation';
import { messages as es419 } from 'src/i18n/locales/es-419/translation';
import { messages as fi } from 'src/i18n/locales/fi/translation';
import { messages as fr } from 'src/i18n/locales/fr/translation';
import { messages as he } from 'src/i18n/locales/he/translation';
import { messages as hu } from 'src/i18n/locales/hu/translation';
import { messages as it } from 'src/i18n/locales/it/translation';
import { messages as ja } from 'src/i18n/locales/ja/translation';
import { messages as ko } from 'src/i18n/locales/ko/translation';
import { messages as nl } from 'src/i18n/locales/nl/translation';
import { messages as no } from 'src/i18n/locales/no/translation';
import { messages as pl } from 'src/i18n/locales/pl/translation';
import { messages as pt } from 'src/i18n/locales/pt/translation';
import { messages as ro } from 'src/i18n/locales/ro/translation';
import { messages as ru } from 'src/i18n/locales/ru/translation';
import { messages as sr } from 'src/i18n/locales/sr/translation';
import { messages as sv } from 'src/i18n/locales/sv/translation';
import { messages as tr } from 'src/i18n/locales/tr/translation';
import { messages as uk } from 'src/i18n/locales/uk/translation';
import { messages as vi } from 'src/i18n/locales/vi/translation';
import { messages as zh } from 'src/i18n/locales/zh/translation';

const DEFAULT_LOCALE = 'en';

const allMessages = {
  af,
  ar,
  ca,
  cs,
  da,
  de,
  el,
  en,
  es,
  'es-419': es419,
  fi,
  fr,
  he,
  hu,
  it,
  ja,
  ko,
  nl,
  no,
  pl,
  pt,
  ro,
  ru,
  sr,
  sv,
  tr,
  uk,
  vi,
  zh,
};

export const resolveSupportedLocale = (detectedLocale?: string | null) => {
  const normalizedLocale = detectedLocale?.toLowerCase();

  if (!normalizedLocale) {
    return DEFAULT_LOCALE;
  }

  if (normalizedLocale in allMessages) {
    return normalizedLocale;
  }

  const baseLocale = normalizedLocale.split('-')[0];

  if (baseLocale in allMessages) {
    return baseLocale;
  }

  return DEFAULT_LOCALE;
};

export const setupI18n = () => {
  const detectedLocale = detect(fromNavigator(), DEFAULT_LOCALE);
  const locale = resolveSupportedLocale(detectedLocale);

  i18n.load(allMessages);
  i18n.activate(locale);
};
