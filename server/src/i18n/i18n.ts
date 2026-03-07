import { i18n } from '@lingui/core';
import { t } from '@lingui/macro';
import * as plurals from 'make-plural/plurals';

import { logger } from 'src/logger';
import { GlobalConfiguration } from 'src/repository/globalSettings';

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

export const setupI18n = (locale: string) => {
  i18n.loadLocaleData({
    af: { plurals: plurals.af },
    ar: { plurals: plurals.ar },
    ca: { plurals: plurals.ca },
    cs: { plurals: plurals.cs },
    da: { plurals: plurals.da },
    de: { plurals: plurals.de },
    el: { plurals: plurals.el },
    en: { plurals: plurals.en },
    es: { plurals: plurals.es },
    fi: { plurals: plurals.fi },
    fr: { plurals: plurals.fr },
    he: { plurals: plurals.he },
    hu: { plurals: plurals.hu },
    it: { plurals: plurals.it },
    ja: { plurals: plurals.ja },
    ko: { plurals: plurals.ko },
    nl: { plurals: plurals.nl },
    no: { plurals: plurals.no },
    pl: { plurals: plurals.pl },
    pt: { plurals: plurals.pt },
    ro: { plurals: plurals.ro },
    ru: { plurals: plurals.ru },
    sr: { plurals: plurals.sr },
    sv: { plurals: plurals.sv },
    tr: { plurals: plurals.tr },
    uk: { plurals: plurals.uk },
    vi: { plurals: plurals.vi },
    zh: { plurals: plurals.zh },
  });
  i18n.load({
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
  });
  i18n.activate(locale);

  GlobalConfiguration.subscribe('serverLang', (lng) => {
    if (i18n.locale === lng || !lng) {
      return;
    }

    logger.info(t`Changing server language to ${lng}`);
    i18n.activate(lng);
  });
};
