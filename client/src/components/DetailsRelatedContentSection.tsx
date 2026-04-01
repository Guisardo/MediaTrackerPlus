import React, { FunctionComponent } from 'react';
import { Trans } from '@lingui/macro';
import { Link } from 'react-router-dom';
import { RelatedContentItem } from 'mediatracker-api';

import { Poster } from 'src/components/Poster';

const formatReleaseYear = (releaseDate?: string | null): number | null => {
  if (!releaseDate) {
    return null;
  }

  const year = Number(releaseDate.slice(0, 4));
  return Number.isNaN(year) ? null : year;
};

const RelatedContentMediaTypeLabel: FunctionComponent<{
  mediaType: RelatedContentItem['mediaType'];
}> = ({ mediaType }) => {
  if (mediaType === 'movie') {
    return <Trans>Movie</Trans>;
  }

  if (mediaType === 'tv') {
    return <Trans>Tv</Trans>;
  }

  if (mediaType === 'book') {
    return <Trans>Book</Trans>;
  }

  return <Trans>Video game</Trans>;
};

const RelatedContentCard: FunctionComponent<{
  item: RelatedContentItem;
}> = ({ item }) => {
  const releaseYear = formatReleaseYear(item.releaseDate);

  return (
    <Link
      to={`/details/${item.id}`}
      className="group block rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm transition-colors duration-200 hover:border-emerald-500 hover:no-underline hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400"
      data-testid={`related-content-link-${item.id}`}
    >
      <Poster
        src={item.posterSmall ?? undefined}
        mediaType={item.mediaType}
        itemMediaType={item.mediaType}
      />

      <div className="mt-3">
        <div className="h-10 overflow-hidden text-sm font-semibold leading-5 text-zinc-900 transition-colors duration-200 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-300">
          {item.title}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          {releaseYear != null && <span>{releaseYear}</span>}
          <span className="rounded-full bg-zinc-100 px-2 py-1 dark:bg-zinc-800">
            <RelatedContentMediaTypeLabel mediaType={item.mediaType} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export const DetailsRelatedContentSection: FunctionComponent<{
  relatedContent?: RelatedContentItem[] | null;
}> = ({ relatedContent }) => {
  if (!relatedContent || relatedContent.length === 0) {
    return null;
  }

  return (
    <section className="mt-8" data-testid="related-content-section">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xl font-bold">
          <Trans>Related content</Trans>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {relatedContent.map((item) => (
          <RelatedContentCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
};
