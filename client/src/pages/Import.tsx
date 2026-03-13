import React, { FunctionComponent } from 'react';
import { Trans } from '@lingui/macro';

import { Link } from 'react-router-dom';
import { Button } from 'src/components/ui/button';
import { useDarkMode } from 'src/hooks/darkMode';

const LinkComponent: FunctionComponent<{
  path: string;
  imgSrc: string;
}> = (params) => {
  const { path, imgSrc } = params;

  return (
    <Button asChild variant="default" className="mt-4">
      <Link to={path}>
        <Trans>Import from</Trans>{' '}
        <img src={imgSrc} className="inline-block h-8 ml-2" />
      </Link>
    </Button>
  );
};

export const ImportPage: FunctionComponent = () => {
  const { darkMode } = useDarkMode();

  return (
    <div className="flex flex-col items-center justify-center mt-4">
      <LinkComponent
        path="trakttv"
        imgSrc={darkMode ? 'logo/trakt-white.svg' : 'logo/trakt-black.svg'}
      />

      <LinkComponent path="goodreads" imgSrc="logo/goodreads.svg" />
    </div>
  );
};
