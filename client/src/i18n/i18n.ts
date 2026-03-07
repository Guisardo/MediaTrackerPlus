import { i18n } from '@lingui/core';
import * as plurals from 'make-plural/plurals';
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

export const setupI18n = () => {
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

  const supportedLanguages = Object.keys(allMessages);

  const detectedLocale = detect(fromNavigator(), 'en').split('-')?.at(0);

  const locale = supportedLanguages.includes(detectedLocale)
    ? detectedLocale
    : 'en';

  i18n.loadLocaleData({ [locale]: { plurals: plurals[locale] } });
  i18n.load(allMessages);
  i18n.activate(locale);
};
