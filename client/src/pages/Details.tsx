import React, { FunctionComponent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { Plural, Trans } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { parseISO } from 'date-fns';

import {
  AudibleCountryCode,
  MediaItemDetailsResponse,
  MediaItemItemsResponse,
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

const IconWithLink: FunctionComponent<{
  href: string;
  src: string;
  whiteLogo?: boolean;
}> = (props) => {
  return (
    <a href={props.href} className="flex mr-2" target="_blank" rel="noopener noreferrer">
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
    <div>
      <div className="flex flex-col mt-2 mb-4 md:flex-row">
        <div className="self-center w-64 shrink-0 md:self-start">
          <Poster
            src={mediaItem.poster ?? undefined}
            mediaType={mediaItem.mediaType}
            itemMediaType={mediaItem.mediaType}
          />
        </div>
        <div className="md:ml-4">
          <div className="mt-2 text-4xl font-bold md:mt-0">
            {mediaItem.title}
            {mediaItem.metadataLanguage && (
              <div className="mt-1">
                <MetadataLocaleBadge
                  metadataLanguage={mediaItem.metadataLanguage}
                  userLocale={i18n.locale}
                />
              </div>
            )}
          </div>

          {mediaItem.releaseDate && (
            <div>
              <span className="font-bold">
                <Trans>Release date</Trans>:{' '}
              </span>
              <span>
                {parseISO(mediaItem.releaseDate).toLocaleDateString()}
              </span>
            </div>
          )}

          {mediaItem.runtime != null && mediaItem.runtime > 0 && (
            <div>
              <span className="font-bold">
                <Trans>Runtime</Trans>:{' '}
              </span>
              <span>
                <FormatDuration milliseconds={mediaItem.runtime! * 60 * 1000} />
              </span>
            </div>
          )}

          {mediaItem.totalRuntime != null && mediaItem.totalRuntime > 0 && (
            <div>
              <span className="font-bold">
                <Trans>Total runtime</Trans>:{' '}
              </span>
              <span>
                <FormatDuration
                  milliseconds={mediaItem.totalRuntime! * 60 * 1000}
                />
              </span>
            </div>
          )}

          {mediaItem.platform && (
            <div>
              <span className="font-bold">
                <Plural
                  value={mediaItem.platform.length}
                  one="Platform"
                  other="platforms"
                />
                :{' '}
              </span>
              <span>{mediaItem.platform.sort().join(', ')}</span>
            </div>
          )}

          {mediaItem.network && (
            <div>
              <span className="font-bold">
                <Trans>Network</Trans>:{' '}
              </span>
              <span>{mediaItem.network}</span>
            </div>
          )}

          {mediaItem.status && (
            <div>
              <span className="font-bold">
                <Trans>Status</Trans>:{' '}
              </span>
              <span>{mediaItem.status}</span>
            </div>
          )}

          {mediaItem.genres && (
            <div>
              <span className="font-bold">
                <Plural
                  value={mediaItem.genres.length}
                  one="Genre"
                  other="Genres"
                />
                :{' '}
              </span>
              {mediaItem.genres.sort().map((genre, index) => (
                <span key={genre}>
                  <span className="italic">{genre}</span>

                  {index < mediaItem.genres!.length - 1 && (
                    <span className="mx-1 text-zinc-600">|</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {mediaItem.overview && (
            <div>
              <span className="font-bold">
                <Trans>Overview</Trans>:{' '}
              </span>
              <span className="whitespace-pre-wrap">{mediaItem.overview}</span>
            </div>
          )}

          {mediaItem.language && (
            <div>
              <span className="font-bold">
                <Trans>Language</Trans>:{' '}
              </span>
              <span>{mediaItem.language}</span>
            </div>
          )}

          {mediaItem.authors && (
            <div>
              <span className="font-bold">
                <Plural
                  value={mediaItem.authors.length}
                  one="Author"
                  other="Authors"
                />
                :{' '}
              </span>
              {mediaItem.authors.sort().join(', ')}
            </div>
          )}

          {mediaItem.narrators && (
            <div>
              <span className="font-bold">
                <Plural
                  value={mediaItem.narrators.length}
                  one="Narrator"
                  other="Narrators"
                />
                :{' '}
              </span>
              {mediaItem.narrators.sort().join(',')}
            </div>
          )}
          {mediaItem.numberOfPages && (
            <div>
              <span className="font-bold">
                <Trans>Number of pages</Trans>:{' '}
              </span>
              {mediaItem.numberOfPages}
            </div>
          )}

          <ParentalRatingSection mediaItem={mediaItem} />

          {isTvShow(mediaItem) && (
            <>
              <div>
                <span className="font-bold">
                  <Trans>Seasons</Trans>:{' '}
                </span>
                {mediaItem.numberOfSeasons}
              </div>

              <div>
                <span className="font-bold">
                  <Trans>Episodes</Trans>:{' '}
                </span>
                {mediaItem.numberOfEpisodes}
              </div>

              {mediaItem.unseenEpisodesCount != null && mediaItem.unseenEpisodesCount > 0 && (
                <div>
                  <span className="font-bold">
                    <Trans>Unseen episodes</Trans>:{' '}
                  </span>
                  {mediaItem.unseenEpisodesCount}
                </div>
              )}
            </>
          )}

          <div>
            <span className="font-bold">
              <Trans>Source</Trans>:{' '}
            </span>
            <span>{mediaItem.source}</span>
          </div>

          <div className="pt-3">
            <ExternalLinks mediaItem={mediaItem} />
          </div>
        </div>
      </div>

      {canMetadataBeUpdated(mediaItem) && (
        <div className="pt-3">
          <UpdateMetadataButton mediaItem={mediaItem} />
        </div>
      )}

      <div className="mt-3">
        {isOnWatchlist(mediaItem) ? (
          <RemoveFromWatchlistButton mediaItem={mediaItem} />
        ) : (
          <AddToWatchlistButton mediaItem={mediaItem} />
        )}
      </div>

      <div className="mt-3">
        <AddToListButtonWithModal mediaItemId={mediaItemRecordId} />
      </div>

      <div className="mt-3">
        {(hasBeenReleased(mediaItem) || !hasReleaseDate(mediaItem)) && (
          <>
            <AddToSeenHistoryButton mediaItem={mediaItem} />

            {hasBeenSeenAtLeastOnce(mediaItem) && (
              <div className="mt-3">
                <RemoveFromSeenHistoryButton mediaItem={mediaItem} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-3"></div>

      {mediaItem.mediaType === 'tv' && (
        <Button asChild variant="outline" className="mt-3 text-green-600 dark:text-green-400">
          <Link to={`/seasons/${mediaItemRecordId}`}>
            <Trans>Episodes page</Trans>
          </Link>
        </Button>
      )}

      {(hasBeenReleased(mediaItem) || !hasReleaseDate(mediaItem)) &&
        !isTvShow(mediaItem) && (
          <>
            {!hasProgress(mediaItem) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={async () => {
                  addToProgress({
                    mediaItemId: mediaItemRecordId,
                    progress: 0,
                  });
                }}
              >
                {isMovie(mediaItem) && <Trans>I am watching it</Trans>}
                {isBook(mediaItem) && <Trans>I am reading it</Trans>}
                {isAudiobook(mediaItem) && <Trans>I am listening it</Trans>}
                {isVideoGame(mediaItem) && <Trans>I am playing it</Trans>}
              </Button>
            )}

            {hasProgress(mediaItem) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={async () => {
                    addToProgress({
                      mediaItemId: mediaItemRecordId,
                      progress: 1,
                    });
                  }}
                >
                  {isMovie(mediaItem) && <Trans>I finished watching it</Trans>}
                  {isBook(mediaItem) && <Trans>I finished reading it</Trans>}
                  {isAudiobook(mediaItem) && (
                    <Trans>I finished listening it</Trans>
                  )}
                  {isVideoGame(mediaItem) && (
                    <Trans>I finished playing it</Trans>
                  )}
                </Button>

                <div className="mt-3">
                  <Trans>Progress</Trans>:{' '}
                  {Math.round((mediaItem.progress ?? 0) * 100)}%
                </div>
              </>
            )}

            <div className="mt-3">
              <SetProgressButton mediaItem={mediaItem} />
            </div>
          </>
        )}

      {mediaItem.upcomingEpisode && (
        <>
          <div className="mt-3 font-bold">
            <Trans>Next episode</Trans>{' '}
            {mediaItem.upcomingEpisode.releaseDate && (
              <RelativeTime
                to={parseISO(mediaItem.upcomingEpisode.releaseDate)}
              />
            )}
            : {formatEpisodeNumber(mediaItem.upcomingEpisode)}{' '}
            {mediaItem.upcomingEpisode.title}
          </div>
        </>
      )}
      {mediaItem.firstUnwatchedEpisode && (
        <div className="flex mt-3 font-bold">
          <Trans>First unwatched episode</Trans>:{' '}
          {formatEpisodeNumber(mediaItem.firstUnwatchedEpisode)}{' '}
          {mediaItem.firstUnwatchedEpisode.title}
          <MarkAsSeenFirstUnwatchedEpisode mediaItem={mediaItem} />
        </div>
      )}
      {mediaItem.lastSeenAt != null && mediaItem.lastSeenAt > 0 && (
        <div className="mt-3">
          {isAudiobook(mediaItem) && (
            <Trans>
              Last listened at {new Date(mediaItem.lastSeenAt!).toLocaleString()}
            </Trans>
          )}

          {isBook(mediaItem) && (
            <Trans>
              Last read at {new Date(mediaItem.lastSeenAt!).toLocaleString()}
            </Trans>
          )}

          {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
            <Trans>
              Last seen at {new Date(mediaItem.lastSeenAt!).toLocaleString()}
            </Trans>
          )}

          {isVideoGame(mediaItem) && (
            <Trans>
              Last played at {new Date(mediaItem.lastSeenAt!).toLocaleString()}
            </Trans>
          )}
        </div>
      )}
      {(mediaItem.seenHistory?.length ?? 0) > 0 && (
        <div className="mt-3">
          <div>
            {isAudiobook(mediaItem) && (
              <Plural
                value={mediaItem.seenHistory!.length}
                one="Listened 1 time"
                other="Listened # times"
              />
            )}

            {isBook(mediaItem) && (
              <Plural
                value={mediaItem.seenHistory!.length}
                one="Read 1 time"
                other="Read # times"
              />
            )}

            {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
              <Plural
                value={mediaItem.seenHistory!.length}
                one="Seen 1 time"
                other="Seen # times"
              />
            )}

            {isVideoGame(mediaItem) && (
              <Plural
                value={mediaItem.seenHistory!.length}
                one="Played 1 time"
                other="Played # times"
              />
            )}
          </div>
          <Link to={`/seen-history/${mediaItem.id}`} className="underline">
            {isAudiobook(mediaItem) && <Trans>Listened history</Trans>}

            {isBook(mediaItem) && <Trans>Read history</Trans>}

            {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
              <Trans>Seen history</Trans>
            )}

            {isVideoGame(mediaItem) && <Trans>Played history</Trans>}
          </Link>
        </div>
      )}

      {(isMovie(mediaItem) || isTvShow(mediaItem)) && (
        <div className="pt-3">
          <WhereToWatchComponent mediaItem={mediaItem} />
        </div>
      )}

      {/* Rating */}
      {(hasBeenReleased(mediaItem) || !hasReleaseDate(mediaItem)) &&
        mediaItem.userRating && (
        <RatingAndReview
          userRating={mediaItem.userRating}
          mediaItem={mediaItem}
        />
      )}
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
