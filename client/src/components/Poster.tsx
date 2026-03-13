import clsx from 'clsx';
import React, {
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { MediaType } from 'mediatracker-api';

const PosterCss: FunctionComponent<{
  src?: string;
  href?: string;
  mediaType?: MediaType;
  itemMediaType?: MediaType;
  children?: React.ReactNode;
}> = (props) => {
  const { src, href, mediaType, itemMediaType, children } = props;

  const [imageLoaded, setImageLoaded] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!src) {
      setTimeout(() => setImageLoaded(true), 50);
    }
  }, [src]);

  const content = (
    <>
      {src && (
        <img
          ref={imgRef}
          src={src}
          draggable="false"
          onChange={() => console.log('image changed')}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(false)}
          className={clsx(
            'w-full h-full transition-all duration-300 rounded',
            imageLoaded ? 'opacity-100' : 'opacity-0 blur-2xl'
          )}
        />
      )}
      <div
        className={clsx(
          'absolute top-0 left-0 flex items-center transition-all duration-300 w-full h-full text-zinc-900 rounded overflow-clip bg-amber-800',
          (src ? imageLoaded : !imageLoaded)
            ? 'opacity-0 blur-2xl text-sm'
            : 'opacity-100 text-9xl'
        )}
      >
        <div className="w-full text-center select-none">?</div>
      </div>
    </>
  );

  return (
    <>
      <div
        className={clsx(
          'flex items-end w-full',
          tailwindcssAspectRatioForMediaType(mediaType)
        )}
      >
        <div
          className={clsx(
            'relative w-full h-full transition-shadow duration-100 rounded shadow-md overflow-clip shadow-black ',
            href && 'hover:shadow-black hover:shadow-lg',
            tailwindcssAspectRatioForMediaType(itemMediaType)
          )}
        >
          {href ? (
            <>
              <a href={href} className="block w-full h-full hover:no-underline">
                {content}
              </a>
            </>
          ) : (
            <>{content}</>
          )}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {children}
          </div>
        </div>
      </div>
    </>
  );
};

const tailwindcssAspectRatioForMediaType = (mediaType?: MediaType) => {
  if (mediaType === 'audiobook') {
    return 'aspect-[1/1]';
  }

  if (mediaType === 'video_game') {
    return 'aspect-[3/4]';
  }

  return 'aspect-[2/3]';
};

const aspectRatioForMediaType = (mediaType?: MediaType) => {
  if (mediaType === 'audiobook') {
    return 1 / 1;
  }

  if (mediaType === 'video_game') {
    return 3 / 4;
  }

  return 2 / 3;
};

export { PosterCss as Poster };
