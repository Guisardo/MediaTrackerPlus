import React, { FunctionComponent } from 'react';
import { useLingui } from '@lingui/react';
import { formatDistance, formatDuration, intervalToDuration } from 'date-fns';
import * as locale from 'date-fns/locale';

const resolveDateFnsLocale = (localeCode: string) => {
  const baseLocale = localeCode.toLowerCase().split('-')[0];

  return (
    locale[localeCode as keyof typeof locale] ||
    locale[baseLocale as keyof typeof locale] ||
    locale.enUS
  );
};

export const RelativeTime: FunctionComponent<{ to: Date }> = (props) => {
  const { to } = props;
  const lingui = useLingui();

  return (
    <>
      {formatDistance(to, new Date(), {
        locale: resolveDateFnsLocale(lingui.i18n.locale),
        addSuffix: true,
      })}
    </>
  );
};

export const FormatDuration: FunctionComponent<{ milliseconds: number }> = (
  props
) => {
  const { milliseconds } = props;
  const lingui = useLingui();

  return (
    <>
      {formatDuration(
        intervalToDuration({
          start: 0,
          end: milliseconds,
        }),
        {
          delimiter: ', ',
          locale: resolveDateFnsLocale(lingui.i18n.locale),
        }
      )}
    </>
  );
};
