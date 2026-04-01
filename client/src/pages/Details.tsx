import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Plural, Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { parseISO } from 'date-fns';

import {
  AudibleCountryCode,
  MediaItemDetailsResponse,
  MediaItemItemsResponse,
  MediaTrailer,
  ParentalGuidanceCategory,
  ParentalGuidanceGuideItem,
  TvEpisode,
  TvSeason,
  UserRating,
} from 'mediatracker-api';
import { SelectSeenDate } from 'src/components/SelectSeenDate';
import { BadgeRating } from 'src/components/StarRating';
import { MetadataLocaleBadge } from 'src/components/MetadataLocaleBadge';
import {
  canMetadataBeUpdated,
  formatEpisodeNumber,
  hasBeenReleased,
  hasProgress,
  hasReleaseDate,
  isAudiobook,
  isBook,
  isMovie,
  isOnWatchlist,
  isTvShow,
  isVideoGame,
} from 'src/utils';
import {
  addToProgress,
  addToWatchlist,
  removeFromWatchlist,
  useDetails,
  useUpdateMetadata,
} from 'src/api/details';
import { isAgeRestrictedError } from 'src/api/api';
import { FormatDuration, RelativeTime } from 'src/components/date';
import { Poster } from 'src/components/Poster';
import { Modal } from 'src/components/Modal';
import { useOtherUser } from 'src/api/user';
import { SetProgressComponent } from 'src/components/SetProgress';
import { useConfiguration } from 'src/api/configuration';
import { AddToListButtonWithModal } from 'src/components/AddToListModal';
import {
  AddToSeenHistoryButton,
  RemoveFromSeenHistoryButton,
} from 'src/components/AddAndRemoveFromSeenHistoryButton';
import { hasBeenSeenAtLeastOnce } from 'src/mediaItem';
import { Button } from 'src/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from 'src/components/ui/collapsible';
import { DetailsRelatedContentSection } from 'src/components/DetailsRelatedContentSection';

/**
 * Determines whether there is any parental metadata worth rendering.
 * At least one of the rating fields or guidance fields must be present.
 */
function hasParentalMetadata(mediaItem: MediaItemDetailsResponse): boolean {
  return (
    mediaItem.contentRatingSystem != null ||
    mediaItem.contentRatingRegion != null ||
    mediaItem.contentRatingLabel != null ||
    (mediaItem.contentRatingDescriptors != null &&
      mediaItem.contentRatingDescriptors.length > 0) ||
    mediaItem.parentalGuidanceSummary != null ||
    (mediaItem.parentalGuidanceCategories != null &&
      mediaItem.parentalGuidanceCategories.length > 0)
  );
}

const ParentalGuidanceCategoryRow: FunctionComponent<{
  category: ParentalGuidanceCategory;
}> = ({ category }) => {
  const [open, setOpen] = useState(false);
  const guideItems =
    category.guideItems != null && category.guideItems.length > 0
      ? category.guideItems
      : null;
  const hasDetails = guideItems != null || category.description != null;

  if (!hasDetails) {
    return (
      <div className="mt-2 rounded-md border border-zinc-200/80 p-3 dark:border-zinc-800">
        <div>
          <span className="font-semibold">{category.category}</span>
          {category.severity && (
            <span className="ml-1 text-zinc-600 dark:text-zinc-400">
              ({category.severity})
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="mt-2 rounded-md border border-zinc-200/80 dark:border-zinc-800"
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-900/60">
        <div>
          <span className="font-semibold">{category.category}</span>
          {category.severity && (
            <span className="ml-1 text-zinc-600 dark:text-zinc-400">
              ({category.severity})
            </span>
          )}
        </div>

        <span
          className="material-icons text-base text-zinc-500 transition-transform duration-200 dark:text-zinc-400"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          expand_more
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-zinc-200/80 px-3 pb-3 pt-3 dark:border-zinc-800">
        {guideItems && (
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {guideItems.map((item, index) => (
              <ParentalGuideItemRow
                key={`${category.category}-${index}`}
                item={item}
              />
            ))}
          </ul>
        )}

        {!guideItems && category.description && (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            {category.description}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

const ParentalGuideItemRow: FunctionComponent<{
  item: ParentalGuidanceGuideItem;
}> = ({ item }) => (
  <li className="leading-6">
    {item.isSpoiler && (
      <span className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
        <Trans>Spoiler</Trans>
      </span>
    )}
    <span className="whitespace-pre-wrap">{item.text}</span>
  </li>
);

/**
 * Renders the parental rating and guidance section for a details page.
 * Only rendered when at least one parental metadata field is present.
 */
export const ParentalRatingSection: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = ({ mediaItem }) => {
  if (!hasParentalMetadata(mediaItem)) {
    return null;
  }

  const hasRatingInfo =
    mediaItem.contentRatingSystem != null ||
    mediaItem.contentRatingRegion != null ||
    mediaItem.contentRatingLabel != null;

  const hasDescriptors =
    mediaItem.contentRatingDescriptors != null &&
    mediaItem.contentRatingDescriptors.length > 0;

  const hasGuidanceSummary = mediaItem.parentalGuidanceSummary != null;

  const hasCategories =
    mediaItem.parentalGuidanceCategories != null &&
    mediaItem.parentalGuidanceCategories.length > 0;

  return (
    <div className="mt-3" data-testid="parental-rating-section">
      <div className="font-bold text-base">
        <Trans>Parental guidance</Trans>
      </div>

      {hasRatingInfo && (
        <div className="mt-1">
          <span className="font-bold">
            <Trans>Rating</Trans>:{' '}
          </span>
          <span>
            {[
              mediaItem.contentRatingLabel,
              mediaItem.contentRatingSystem,
              mediaItem.contentRatingRegion,
            ]
              .filter(Boolean)
              .join(' \u2022 ')}
          </span>
        </div>
      )}

      {hasDescriptors && (
        <div className="mt-1">
          <span className="font-bold">
            <Trans>Descriptors</Trans>:{' '}
          </span>
          <span>{mediaItem.contentRatingDescriptors!.join(', ')}</span>
        </div>
      )}

      {hasGuidanceSummary && (
        <div className="mt-1">
          <span className="font-bold">
            <Trans>Guidance</Trans>:{' '}
          </span>
          <span className="whitespace-pre-wrap">
            {mediaItem.parentalGuidanceSummary}
          </span>
        </div>
      )}

      {hasCategories && (
        <div className="mt-1">
          <span className="font-bold">
            <Trans>Content categories</Trans>:
          </span>
          <div className="ml-2">
            {mediaItem.parentalGuidanceCategories!.map((cat, index) => (
              <ParentalGuidanceCategoryRow key={index} category={cat} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const TrailerSection: FunctionComponent<{
  trailers?: MediaTrailer[] | null;
}> = ({ trailers }) => {
  const primaryTrailer = trailers?.[0];
  const [selectedTrailer, setSelectedTrailer] = useState<MediaTrailer | null>(
    primaryTrailer ?? null
  );
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  useEffect(() => {
    setSelectedTrailer(primaryTrailer ?? null);
    setIsPlayerOpen(false);
  }, [primaryTrailer]);

  if (!primaryTrailer) {
    return null;
  }

  const alternateTrailers = trailers!.slice(1);

  return (
    <div
      className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
      data-testid="trailer-section"
    >
      <div className="text-base font-bold">
        <Trans>Trailers & previews</Trans>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-medium">{primaryTrailer.title}</span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {primaryTrailer.kind === 'preview' ? (
            <Trans>Preview</Trans>
          ) : (
            <Trans>Trailer</Trans>
          )}
        </span>
        {primaryTrailer.isOfficial && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
            <Trans>Official</Trans>
          </span>
        )}
        {primaryTrailer.language && (
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {primaryTrailer.language}
          </span>
        )}
      </div>

      <div className="mt-3">
        <Modal
          onBeforeClosed={() => {
            setIsPlayerOpen(false);
          }}
          onClosed={() => {
            setSelectedTrailer(primaryTrailer);
          }}
          openModal={(openModal) => (
            <Button
              variant="outline"
              size="sm"
              data-testid="open-trailer-modal"
              onClick={() => {
                setSelectedTrailer(primaryTrailer);
                setIsPlayerOpen(true);
                openModal();
              }}
            >
              {primaryTrailer.kind === 'preview' ? (
                <Trans>Play preview</Trans>
              ) : (
                <Trans>Play trailer</Trans>
              )}
            </Button>
          )}
        >
          {(closeModal) => (
            <div className="w-full rounded-xl bg-white p-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">
                    {selectedTrailer?.title ?? primaryTrailer.title}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {selectedTrailer?.language ?? primaryTrailer.language ?? ''}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => closeModal()}
                >
                  <Trans>Close</Trans>
                </Button>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg bg-black">
                {isPlayerOpen && selectedTrailer && (
                  <iframe
                    key={selectedTrailer.id}
                    title={selectedTrailer.title}
                    src={selectedTrailer.embedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="aspect-video w-full"
                  />
                )}
              </div>

              {alternateTrailers.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    <Trans>More options</Trans>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[primaryTrailer, ...alternateTrailers].map((trailer) => (
                      <Button
                        key={trailer.id}
                        variant="outline"
                        size="sm"
                        className={clsx(
                          selectedTrailer?.id === trailer.id &&
                            'border-green-500 text-green-600 dark:border-green-400 dark:text-green-300'
                        )}
                        onClick={() => {
                          setSelectedTrailer(trailer);
                          setIsPlayerOpen(true);
                        }}
                      >
                        {trailer.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

const Review: FunctionComponent<{ userRating: UserRating }> = (props) => {
  const { userRating } = props;
  const { user, isLoading } = useOtherUser(userRating.userId);

  if (isLoading) {
    return <></>;
  }

  if (!user) {
    return <></>;
  }

  const date = new Date(userRating.date).toLocaleString();
  const author = user.name;

  return (
    <>
      <div className="">
        <Trans>
          Review by{' '}
          <i>
            <strong>{author}</strong>
          </i>{' '}
          at {date}
        </Trans>
      </div>
      <div className="">{userRating.review}</div>
    </>
  );
};

const RatingAndReview: FunctionComponent<{
  userRating: UserRating;
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}> = (props) => {
  const { userRating, mediaItem, season, episode } = props;

  return (
    <>
      <div className="mt-3">
        <BadgeRating mediaItem={mediaItem} season={season} episode={episode} />
      </div>

      {userRating?.review && <Review userRating={userRating} />}
    </>
  );
};

/**
 * Renders an icon that opens an external URL in a new tab.
 *
 * Security: only `https:` and `http:` URIs are permitted. Any other scheme
 * (e.g. `javascript:`) is rejected and the component renders nothing.
 * The anchor `href` is always the literal `#` to prevent the browser from
 * following it directly; navigation is handled via an `onClick` that calls
 * `window.open` with the validated URL string, which fully eliminates the
 * XSS vector from a variable flowing into an `href` attribute.
 */
const IconWithLink: FunctionComponent<{
  href: string;
  src: string;
  whiteLogo?: boolean;
}> = (props) => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(props.href);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return null;
  }

  const safeHref = parsedUrl.toString();

  return (
    <a
      href="#"
      className="flex mr-2"
      rel="noopener noreferrer"
      onClick={(e) => {
        e.preventDefault();
        window.open(safeHref, '_blank', 'noopener,noreferrer');
      }}
    >
      <img
        src={props.src}
        className={clsx(props.whiteLogo && 'invert dark:invert-0')}
      />
    </a>
  );
};

const WhereToWatchComponent: FunctionComponent<{
  mediaItem: MediaItemItemsResponse;
}> = (props) => {
  const { mediaItem } = props;

  return (
    <div>
      <a
        className="underline"
        href={`https://www.themoviedb.org/${
          isTvShow(mediaItem) ? 'tv' : 'movie'
        }/${mediaItem.tmdbId}/watch`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Trans>Where to watch</Trans>
      </a>
    </div>
  );
};

const audibleLanguages: Record<AudibleCountryCode, string> = {
  au: 'au',
  ca: 'ca',
  de: 'de',
  fr: 'fr',
  in: 'in',
  it: 'it',
  es: 'es',
  jp: 'co.jp',
  uk: 'co.uk',
  us: 'com',
};

const ExternalLinks: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = (props) => {
  const { mediaItem } = props;
  const { configuration } = useConfiguration();
  const fallbackCountryCode = configuration?.audibleLang?.toLowerCase() as
    | AudibleCountryCode
    | undefined;
  const countryCode = mediaItem.audibleCountryCode ?? fallbackCountryCode;

  const audibleDomain =
    (countryCode ? audibleLanguages[countryCode] : undefined) || 'com';

  return (
    <div className="flex h-5">
      {mediaItem.imdbId && (
        <IconWithLink
          href={`https://www.imdb.com/title/${mediaItem.imdbId}`}
          src="logo/imdb.png"
        />
      )}

      {mediaItem.tmdbId && (
        <IconWithLink
          href={`https://www.themoviedb.org/${mediaItem.mediaType}/${mediaItem.tmdbId}`}
          src="logo/tmdb.svg"
        />
      )}

      {mediaItem.igdbId && (
        <IconWithLink
          href={`https://www.igdb.com/games/${mediaItem.title
            .toLowerCase()
            .replaceAll(' ', '-')}`}
          src="logo/igdb.png"
          whiteLogo={true}
        />
      )}

      {mediaItem.openlibraryId && (
        <IconWithLink
          href={`https://openlibrary.org${mediaItem.openlibraryId}`}
          src="logo/openlibrary.svg"
        />
      )}

      {mediaItem.audibleId && (
        <IconWithLink
          href={`https://audible.${audibleDomain}/pd/${mediaItem.audibleId}?overrideBaseCountry=true&ipRedirectOverride=true`}
          src="logo/audible.png"
        />
      )}
    </div>
  );
};

/**
 * Displayed when the server returns a 403 AGE_RESTRICTED error for a details
 * page. Purpose-built state that avoids rendering the raw error object.
 */
export const AgeRestrictedDetailsState: FunctionComponent = () => (
  <div className="flex flex-col items-center justify-center mt-16 px-4 text-center">
    <div className="text-5xl mb-4">🔒</div>
    <div className="text-2xl font-bold mb-2">
      <Trans>Content restricted</Trans>
    </div>
    <div className="text-zinc-600 dark:text-zinc-400">
      <Trans>
        This content is not available based on your age-based content filtering
        preferences.
      </Trans>
    </div>
  </div>
);

/**
 * Small badge that labels the media type (Movie, TV Show, Book, etc.).
 * Returns null for unknown media types so callers don't need to guard.
 */
const MediaTypeBadge: FunctionComponent<{ mediaType: string }> = ({ mediaType }) => {
  const labels: Record<string, React.ReactNode> = {
    movie: <Trans>Movie</Trans>,
    tv: <Trans>TV Show</Trans>,
    book: <Trans>Book</Trans>,
    audiobook: <Trans>Audiobook</Trans>,
    video_game: <Trans>Game</Trans>,
  };
  const label = labels[mediaType];
  if (!label) return null;
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
      {label}
    </span>
  );
};

type InfoField = { label: React.ReactNode; value: React.ReactNode };

/** Common fields present on all media types (dates, runtime, status, network, language, source). */
function buildCommonFields(mediaItem: MediaItemDetailsResponse): InfoField[] {
  const fields: InfoField[] = [];
  if (mediaItem.releaseDate) {
    fields.push({ label: <Trans>Release date</Trans>, value: parseISO(mediaItem.releaseDate).toLocaleDateString() });
  }
  if (mediaItem.runtime != null && mediaItem.runtime > 0) {
    fields.push({ label: <Trans>Runtime</Trans>, value: <FormatDuration milliseconds={mediaItem.runtime * 60 * 1000} /> });
  }
  if (mediaItem.totalRuntime != null && mediaItem.totalRuntime > 0) {
    fields.push({ label: <Trans>Total runtime</Trans>, value: <FormatDuration milliseconds={mediaItem.totalRuntime * 60 * 1000} /> });
  }
  if (mediaItem.status) {
    fields.push({ label: <Trans>Status</Trans>, value: mediaItem.status });
  }
  if (mediaItem.network) {
    fields.push({ label: <Trans>Network</Trans>, value: mediaItem.network });
  }
  if (mediaItem.language) {
    fields.push({ label: <Trans>Language</Trans>, value: mediaItem.language });
  }
  if (mediaItem.source) {
    fields.push({ label: <Trans>Source</Trans>, value: mediaItem.source });
  }
  return fields;
}

/** Media-type-specific fields (platform, TV episode counts, book/audiobook credits and pages). */
function buildMediaTypeFields(mediaItem: MediaItemDetailsResponse): InfoField[] {
  const fields: InfoField[] = [];
  if (mediaItem.platform) {
    fields.push({
      label: <Plural value={mediaItem.platform.length} one="Platform" other="Platforms" />,
      value: mediaItem.platform.sort().join(', '),
    });
  }
  if (isTvShow(mediaItem)) {
    if (mediaItem.numberOfSeasons != null) {
      fields.push({ label: <Trans>Seasons</Trans>, value: mediaItem.numberOfSeasons });
    }
    if (mediaItem.numberOfEpisodes != null) {
      fields.push({ label: <Trans>Episodes</Trans>, value: mediaItem.numberOfEpisodes });
    }
    if (mediaItem.unseenEpisodesCount != null && mediaItem.unseenEpisodesCount > 0) {
      fields.push({ label: <Trans>Unseen episodes</Trans>, value: mediaItem.unseenEpisodesCount });
    }
  }
  if (mediaItem.authors) {
    fields.push({
      label: <Plural value={mediaItem.authors.length} one="Author" other="Authors" />,
      value: mediaItem.authors.sort().join(', '),
    });
  }
  if (mediaItem.narrators) {
    fields.push({
      label: <Plural value={mediaItem.narrators.length} one="Narrator" other="Narrators" />,
      value: mediaItem.narrators.sort().join(', '),
    });
  }
  if (mediaItem.numberOfPages) {
    fields.push({ label: <Trans>Pages</Trans>, value: mediaItem.numberOfPages });
  }
  return fields;
}

/**
 * Builds the ordered list of label/value pairs shown in the info card.
 * Each field is only included when the underlying data is present and
 * non-empty, keeping the card compact for items with partial metadata.
 */
function buildInfoFields(mediaItem: MediaItemDetailsResponse): InfoField[] {
  return [...buildCommonFields(mediaItem), ...buildMediaTypeFields(mediaItem)];
}

/**
 * Renders the metadata panel — info card (dates, runtime, status, etc.),
 * trailer, parental guidance and external links.
 * Title, genres and overview have moved to DetailsPage hero strip.
 */
const DetailsMetadata: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = ({ mediaItem }) => {
  const infoFields = buildInfoFields(mediaItem);

  return (
    <div className="mt-4 space-y-4">
      {infoFields.length > 0 && (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {infoFields.map((field, index) => (
              <div key={index} className="contents">
                <dt className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                  {field.label}
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-100">{field.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <TrailerSection trailers={mediaItem.trailers} />

      <ParentalRatingSection mediaItem={mediaItem} />

      <div className="pt-1">
        <ExternalLinks mediaItem={mediaItem} />
      </div>
    </div>
  );
};

const sectionCard = 'rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40';
const sectionLabel = 'mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

/** Progress card — shown for non-TV items that have been released (or have no release date). */
const ProgressSection: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
  mediaItemRecordId: number;
}> = ({ mediaItem, mediaItemRecordId }) => (
  <div className={sectionCard}>
    <div className={sectionLabel}><Trans>Progress</Trans></div>
    <div className="flex flex-wrap gap-2">
      {!hasProgress(mediaItem) ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => addToProgress({ mediaItemId: mediaItemRecordId, progress: 0 })}
        >
          {isMovie(mediaItem) && <Trans>I am watching it</Trans>}
          {isBook(mediaItem) && <Trans>I am reading it</Trans>}
          {isAudiobook(mediaItem) && <Trans>I am listening it</Trans>}
          {isVideoGame(mediaItem) && <Trans>I am playing it</Trans>}
        </Button>
      ) : (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addToProgress({ mediaItemId: mediaItemRecordId, progress: 1 })}
          >
            {isMovie(mediaItem) && <Trans>I finished watching it</Trans>}
            {isBook(mediaItem) && <Trans>I finished reading it</Trans>}
            {isAudiobook(mediaItem) && <Trans>I finished listening it</Trans>}
            {isVideoGame(mediaItem) && <Trans>I finished playing it</Trans>}
          </Button>
          <SetProgressButton mediaItem={mediaItem} />
        </>
      )}
    </div>
    {hasProgress(mediaItem) && (
      <div className="mt-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-1.5 rounded-full bg-emerald-500"
            style={{ width: `${Math.round((mediaItem.progress ?? 0) * 100)}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {Math.round((mediaItem.progress ?? 0) * 100)}%
        </div>
      </div>
    )}
  </div>
);

/** History card — seen/listened/read/played history and links. */
const HistorySection: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = ({ mediaItem }) => (
  <div className={sectionCard}>
    <div className={sectionLabel}>
      {isAudiobook(mediaItem) && <Trans>Listen history</Trans>}
      {isBook(mediaItem) && <Trans>Read history</Trans>}
      {(isMovie(mediaItem) || isTvShow(mediaItem)) && <Trans>Watch history</Trans>}
      {isVideoGame(mediaItem) && <Trans>Play history</Trans>}
    </div>

    {(hasBeenReleased(mediaItem) || !hasReleaseDate(mediaItem)) && (
      <div className="flex flex-wrap gap-2">
        <AddToSeenHistoryButton mediaItem={mediaItem} />
        {hasBeenSeenAtLeastOnce(mediaItem) && (
          <RemoveFromSeenHistoryButton mediaItem={mediaItem} />
        )}
      </div>
    )}

    {mediaItem.lastSeenAt != null && mediaItem.lastSeenAt > 0 && (
      <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        {isAudiobook(mediaItem) && (
          <Trans>Last listened at {new Date(mediaItem.lastSeenAt!).toLocaleString()}</Trans>
        )}
        {isBook(mediaItem) && (
          <Trans>Last read at {new Date(mediaItem.lastSeenAt!).toLocaleString()}</Trans>
        )}
        {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
          <Trans>Last seen at {new Date(mediaItem.lastSeenAt!).toLocaleString()}</Trans>
        )}
        {isVideoGame(mediaItem) && (
          <Trans>Last played at {new Date(mediaItem.lastSeenAt!).toLocaleString()}</Trans>
        )}
      </div>
    )}

    {(mediaItem.seenHistory?.length ?? 0) > 0 && (
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">
          {isAudiobook(mediaItem) && (
            <Plural value={mediaItem.seenHistory!.length} one="Listened 1 time" other="Listened # times" />
          )}
          {isBook(mediaItem) && (
            <Plural value={mediaItem.seenHistory!.length} one="Read 1 time" other="Read # times" />
          )}
          {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
            <Plural value={mediaItem.seenHistory!.length} one="Seen 1 time" other="Seen # times" />
          )}
          {isVideoGame(mediaItem) && (
            <Plural value={mediaItem.seenHistory!.length} one="Played 1 time" other="Played # times" />
          )}
        </span>
        <Link to={`/seen-history/${mediaItem.id}`} className="text-xs text-blue-600 underline dark:text-blue-400">
          {isAudiobook(mediaItem) && <Trans>Listened history</Trans>}
          {isBook(mediaItem) && <Trans>Read history</Trans>}
          {(isMovie(mediaItem) || isTvShow(mediaItem)) && <Trans>Seen history</Trans>}
          {isVideoGame(mediaItem) && <Trans>Played history</Trans>}
        </Link>
      </div>
    )}
  </div>
);

/** TV episodes card — upcoming and first unwatched episode. */
const TvEpisodesSection: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = ({ mediaItem }) => (
  <div className={sectionCard}>
    <div className={sectionLabel}><Trans>Episodes</Trans></div>
    {mediaItem.upcomingEpisode && (
      <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        <span className="text-zinc-500 dark:text-zinc-400"><Trans>Next episode</Trans>{' '}</span>
        {mediaItem.upcomingEpisode.releaseDate && (
          <RelativeTime to={parseISO(mediaItem.upcomingEpisode.releaseDate)} />
        )}
        {': '}
        {formatEpisodeNumber(mediaItem.upcomingEpisode)}{' '}
        {mediaItem.upcomingEpisode.title}
      </div>
    )}
    {mediaItem.firstUnwatchedEpisode && (
      <div className={clsx('flex items-center gap-1 text-sm font-medium text-zinc-800 dark:text-zinc-200', mediaItem.upcomingEpisode && 'mt-2')}>
        <span className="text-zinc-500 dark:text-zinc-400"><Trans>First unwatched</Trans>{': '}</span>
        {formatEpisodeNumber(mediaItem.firstUnwatchedEpisode)}{' '}
        {mediaItem.firstUnwatchedEpisode.title}
        <MarkAsSeenFirstUnwatchedEpisode mediaItem={mediaItem} />
      </div>
    )}
  </div>
);

/**
 * Renders all action controls and history information for a media item.
 * Watchlist and list-membership buttons have moved to the DetailsPage hero
 * strip — this component handles: metadata refresh, progress, seen history,
 * episode info, where-to-watch, and rating/review.
 */
const DetailsActions: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
  mediaItemRecordId: number;
}> = ({ mediaItem, mediaItemRecordId }) => {
  const isReleased = hasBeenReleased(mediaItem) || !hasReleaseDate(mediaItem);

  return (
    <div className="mt-4 space-y-4">
      {canMetadataBeUpdated(mediaItem) && (
        <div><UpdateMetadataButton mediaItem={mediaItem} /></div>
      )}

      {isReleased && !isTvShow(mediaItem) && (
        <ProgressSection mediaItem={mediaItem} mediaItemRecordId={mediaItemRecordId} />
      )}

      <HistorySection mediaItem={mediaItem} />

      {(mediaItem.upcomingEpisode || mediaItem.firstUnwatchedEpisode) && (
        <TvEpisodesSection mediaItem={mediaItem} />
      )}

      {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
        <div><WhereToWatchComponent mediaItem={mediaItem} /></div>
      )}

      {isReleased && mediaItem.userRating && (
        <div className={sectionCard}>
          <div className={sectionLabel}><Trans>Your rating</Trans></div>
          <RatingAndReview userRating={mediaItem.userRating} mediaItem={mediaItem} />
        </div>
      )}
    </div>
  );
};

export const DetailsPage: FunctionComponent = () => {
  const { mediaItemId: routeMediaItemId } = useParams();
  const { mediaItem, isLoading, error } = useDetails(Number(routeMediaItemId));
  const { i18n } = useLingui();

  if (isLoading) {
    return (
      <>
        <Trans>Loading</Trans>
      </>
    );
  }

  if (error) {
    if (isAgeRestrictedError(error)) {
      return <AgeRestrictedDetailsState />;
    }
    return <>{String(error)}</>;
  }

  if (!mediaItem || mediaItem.id == null) {
    return <Trans>Loading</Trans>;
  }

  const mediaItemRecordId = mediaItem.id;

  return (
    <div className="pb-8">
      {/* Hero strip: compact poster + title/year/type/genres */}
      <div className="mt-2 flex items-start gap-3">
        <div className="w-24 shrink-0">
          <Poster
            src={mediaItem.poster ?? undefined}
            mediaType={mediaItem.mediaType}
            itemMediaType={mediaItem.mediaType}
          />
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <h1 className="text-2xl font-bold leading-tight">
            {mediaItem.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            {mediaItem.releaseDate && (
              <span>{parseISO(mediaItem.releaseDate).getFullYear()}</span>
            )}
            <MediaTypeBadge mediaType={mediaItem.mediaType} />
            {mediaItem.metadataLanguage && (
              <MetadataLocaleBadge
                metadataLanguage={mediaItem.metadataLanguage}
                userLocale={i18n.locale}
              />
            )}
          </div>
          {mediaItem.genres && mediaItem.genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mediaItem.genres.sort().map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Overview */}
      {mediaItem.overview && (
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
          {mediaItem.overview}
        </p>
      )}

      {/* Primary CTA row */}
      <div className="mt-4 flex flex-wrap gap-2">
        {isOnWatchlist(mediaItem) ? (
          <RemoveFromWatchlistButton mediaItem={mediaItem} />
        ) : (
          <AddToWatchlistButton mediaItem={mediaItem} />
        )}
        <AddToListButtonWithModal mediaItemId={mediaItemRecordId} />
        {mediaItem.mediaType === 'tv' && (
          <Button asChild variant="outline" className="text-green-600 dark:text-green-400">
            <Link to={`/seasons/${mediaItemRecordId}`}>
              <Trans>Episodes page</Trans>
            </Link>
          </Button>
        )}
      </div>

      <DetailsMetadata mediaItem={mediaItem} />
      <DetailsActions mediaItem={mediaItem} mediaItemRecordId={mediaItemRecordId} />
      <DetailsRelatedContentSection relatedContent={mediaItem.relatedContent} />
    </div>
  );
};

export const AddToWatchlistButton: FunctionComponent<{
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}> = (props) => {
  const { mediaItem, season, episode } = props;

  return (
    <Button
      variant="default"
      size="sm"
      onClick={() =>
        addToWatchlist({
          mediaItem,
          season,
          episode,
        })
      }
    >
      <Trans>Add to watchlist</Trans>
    </Button>
  );
};

export const RemoveFromWatchlistButton: FunctionComponent<{
  mediaItem: MediaItemItemsResponse;
  season?: TvSeason;
  episode?: TvEpisode;
}> = (props) => {
  const { mediaItem, season, episode } = props;

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={() =>
        removeFromWatchlist({
          mediaItem,
          season,
          episode,
        })
      }
    >
      <Trans>Remove from watchlist</Trans>
    </Button>
  );
};

const UpdateMetadataButton: FunctionComponent<{
  mediaItem: MediaItemItemsResponse;
}> = (props) => {
  const { mediaItem } = props;

  const { updateMetadata, isLoading, isError } = useUpdateMetadata(
    mediaItem.id!
  );

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => updateMetadata()}
      disabled={isLoading}
    >
      <Trans>Update metadata</Trans>
    </Button>
  );
};

const SetProgressButton: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = (props) => {
  const { mediaItem } = props;

  return (
    <Modal
      openModal={(openModal) => (
        <Button variant="outline" size="sm" className="text-green-500" onClick={() => openModal()}>
          <Trans>Set progress</Trans>
        </Button>
      )}
    >
      {(closeModal) => (
        <SetProgressComponent mediaItem={mediaItem} closeModal={closeModal} />
      )}
    </Modal>
  );
};

const MarkAsSeenFirstUnwatchedEpisode: FunctionComponent<{
  mediaItem: MediaItemDetailsResponse;
}> = (props) => {
  const { mediaItem } = props;

  return (
    <Modal
      openModal={(openModal) => (
        <span
          className="ml-1 font-bold cursor-pointer select-none material-icons text-emerald-800"
          onClick={() => openModal()}
        >
          check
        </span>
      )}
    >
      {(closeModal) => (
        <SelectSeenDate
          mediaItem={mediaItem}
          episode={mediaItem.firstUnwatchedEpisode ?? undefined}
          closeModal={closeModal}
        />
      )}
    </Modal>
  );
};
