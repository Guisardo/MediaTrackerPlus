import React, { FunctionComponent, useEffect, useState } from 'react';
import { t, Trans } from '@lingui/macro';
import { useConfiguration } from 'src/api/configuration';
import { CheckboxWithTitleAndDescription } from 'src/components/Checkbox';
import { SettingsSegment } from 'src/components/SettingsSegment';
import { AudibleCountryCode, ServerLang, TmdbLang } from 'mediatracker-api';
import { Button } from 'src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';

export const SettingsConfigurationPage: FunctionComponent = () => {
  const { configuration, update, isLoading } = useConfiguration();

  return (
    <>
      {isLoading ? (
        <></>
      ) : (
        <>
          <SettingsSegment title={t`General`}>
            <CheckboxWithTitleAndDescription
              title={t`Enable registration`}
              checked={configuration.enableRegistration}
              onChange={(value) => update({ enableRegistration: value })}
            />
          </SettingsSegment>

          <div className="mt-3" />

          <SettingsSegment title={t`Server language`}>
            <Select
              value={configuration.serverLang || 'en'}
              onValueChange={(value) =>
                update({ serverLang: value as ServerLang })
              }
            >
              <SelectTrigger aria-label={t`Server language`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="da">Danish</SelectItem>
                <SelectItem value="de">German</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
                <SelectItem value="pt">Portuguese</SelectItem>
              </SelectContent>
            </Select>
          </SettingsSegment>

          <div className="mt-3" />

          <SettingsSegment title={t`Audible language`}>
            <Select
              value={configuration.audibleLang?.toLowerCase() || 'us'}
              onValueChange={(value) =>
                update({
                  audibleLang: value as AudibleCountryCode,
                })
              }
            >
              <SelectTrigger aria-label={t`Audible language`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="au">Australia (English)</SelectItem>
                <SelectItem value="ca">Canada (English)</SelectItem>
                <SelectItem value="de">Deutschland (Deutsch)</SelectItem>
                <SelectItem value="es">España (Castellano)</SelectItem>
                <SelectItem value="fr">France (Français)</SelectItem>
                <SelectItem value="in">India (English)</SelectItem>
                <SelectItem value="it">Italia (Italiano)</SelectItem>
                <SelectItem value="uk">UK (English)</SelectItem>
                <SelectItem value="us">United States (English)</SelectItem>
                <SelectItem value="jp">日本 (日本語)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsSegment>

          <div className="mt-3" />

          <SettingsSegment title={t`TMDB language`}>
            <Select
              value={configuration.tmdbLang || 'en'}
              onValueChange={(value) =>
                update({ tmdbLang: value as TmdbLang })
              }
            >
              <SelectTrigger aria-label={t`TMDB language`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(languagesCodes).map(([code, language]) => (
                  <SelectItem key={code} value={code}>
                    {language}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsSegment>

          <div className="mt-3" />

          <IGDBcredentialsComponent />
        </>
      )}
    </>
  );
};

const IGDBcredentialsComponent: FunctionComponent = () => {
  const { configuration, update } = useConfiguration();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    setClientId(configuration.igdbClientId);
    setClientSecret(configuration.igdbClientSecret);
  }, [configuration.igdbClientId, configuration.igdbClientSecret]);

  return (
    <SettingsSegment title={t`IGDB credentials`}>
      <form
        className="pb-2"
        onSubmit={(e) => {
          e.preventDefault();

          update({
            igdbClientId: clientId,
            igdbClientSecret: clientSecret,
          });
        }}
      >
        <a
          href="https://api-docs.igdb.com/#account-creation"
          className="block mb-2 underline"
        >
          <Trans>API keys can be acquired here</Trans>
        </a>
        <label>
          <Trans>Client ID</Trans>
          <input
            className="block mb-2 w-60"
            value={clientId}
            onChange={(e) => setClientId(e.currentTarget.value)}
          />
        </label>
        <label>
          <Trans>Client Secret</Trans>
          <input
            className="block w-60"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.currentTarget.value)}
          />
        </label>

        <Button variant="outline" className="block mt-2">
          <Trans>Save</Trans>
        </Button>
      </form>
    </SettingsSegment>
  );
};

const languagesCodes = {
  om: '(Afan) Oromo',
  ab: 'Abkhazian',
  aa: 'Afar',
  af: 'Afrikaans',
  sq: 'Albanian',
  am: 'Amharic',
  ar: 'Arabic',
  hy: 'Armenian',
  as: 'Assamese',
  ay: 'Aymara',
  az: 'Azerbaijani',
  ba: 'Bashkir',
  eu: 'Basque',
  bn: 'Bengali',
  dz: 'Bhutani',
  bh: 'Bihari',
  bi: 'Bislama',
  br: 'Breton',
  bg: 'Bulgarian',
  my: 'Burmese',
  be: 'Byelorussian',
  km: 'Cambodian',
  ca: 'Catalan',
  zh: 'Chinese',
  co: 'Corsican',
  hr: 'Croatian',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  eo: 'Esperanto',
  et: 'Estonian',
  fo: 'Faeroese',
  fj: 'Fiji',
  fi: 'Finnish',
  fr: 'French',
  fy: 'Frisian',
  gl: 'Galician',
  ka: 'Georgian',
  de: 'German',
  el: 'Greek',
  kl: 'Greenlandic',
  gn: 'Guarani',
  gu: 'Gujarati',
  ha: 'Hausa',
  he: 'Hebrew (former iw)',
  hi: 'Hindi',
  hu: 'Hungarian',
  is: 'Icelandic',
  id: 'Indonesian (former in)',
  ia: 'Interlingua',
  ie: 'Interlingue',
  ik: 'Inupiak',
  iu: 'Inuktitut (Eskimo)',
  ga: 'Irish',
  it: 'Italian',
  ja: 'Japanese',
  jw: 'Javanese',
  kn: 'Kannada',
  ks: 'Kashmiri',
  kk: 'Kazakh',
  rw: 'Kinyarwanda',
  ky: 'Kirghiz',
  rn: 'Kirundi',
  ko: 'Korean',
  ku: 'Kurdish',
  lo: 'Laothian',
  la: 'Latin',
  lv: 'Latvian, Lettish',
  ln: 'Lingala',
  lt: 'Lithuanian',
  mk: 'Macedonian',
  mg: 'Malagasy',
  ms: 'Malay',
  ml: 'Malayalam',
  mt: 'Maltese',
  mi: 'Maori',
  mr: 'Marathi',
  mo: 'Moldavian',
  mn: 'Mongolian',
  na: 'Nauru',
  ne: 'Nepali',
  no: 'Norwegian',
  oc: 'Occitan',
  or: 'Oriya',
  ps: 'Pashto, Pushto',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  pa: 'Punjabi',
  qu: 'Quechua',
  rm: 'Rhaeto-Romance',
  ro: 'Romanian',
  ru: 'Russian',
  sm: 'Samoan',
  sg: 'Sangro',
  sa: 'Sanskrit',
  gd: 'Scots Gaelic',
  sr: 'Serbian',
  sh: 'Serbo-Croatian',
  st: 'Sesotho',
  tn: 'Setswana',
  sn: 'Shona',
  sd: 'Sindhi',
  si: 'Singhalese',
  ss: 'Siswati',
  sk: 'Slovak',
  sl: 'Slovenian',
  so: 'Somali',
  es: 'Spanish',
  su: 'Sudanese',
  sw: 'Swahili',
  sv: 'Swedish',
  tl: 'Tagalog',
  tg: 'Tajik',
  ta: 'Tamil',
  tt: 'Tatar',
  te: 'Tegulu',
  th: 'Thai',
  bo: 'Tibetan',
  ti: 'Tigrinya',
  to: 'Tonga',
  ts: 'Tsonga',
  tr: 'Turkish',
  tk: 'Turkmen',
  tw: 'Twi',
  ug: 'Uigur',
  uk: 'Ukrainian',
  ur: 'Urdu',
  uz: 'Uzbek',
  vi: 'Vietnamese',
  vo: 'Volapuk',
  cy: 'Welch',
  wo: 'Wolof',
  xh: 'Xhosa',
  yi: 'Yiddish (former ji)',
  yo: 'Yoruba',
  za: 'Zhuang',
  zu: 'Zulu',
};
