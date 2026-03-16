import _ from 'lodash';

import {
  definedOrUndefined,
  omitUndefinedValues,
  repository,
} from 'src/repository/repository';
import { splitCreatorField } from 'src/utils/normalizeCreators';
import {
  getItemsKnex,
  getFacetsKnex,
  FacetsResponse,
  generateColumnNames,
} from 'src/knex/queries/items';
import { Database } from 'src/dbconfig';
import { getDetailsKnex } from 'src/knex/queries/details';
import { Seen } from 'src/entity/seen';
import { UserRating } from 'src/entity/userRating';
import { NotificationsHistory } from 'src/entity/notificationsHistory';
import { TvEpisode, tvEpisodeColumns } from 'src/entity/tvepisode';
import { tvSeasonRepository } from 'src/repository/season';
import { tvEpisodeRepository } from 'src/repository/episode';
import {
  ExternalIds,
  MediaItemBase,
  MediaItemBaseWithSeasons,
  mediaItemColumns,
  MediaItemForProvider,
  MediaItemItemsResponse,
  MediaType,
} from 'src/entity/mediaItem';
import { isValid, parseISO, subDays, subMinutes } from 'date-fns';
import { TvSeason } from 'src/entity/tvseason';
import { ListItem } from 'src/entity/list';
import { logger } from 'src/logger';
import { getImageId } from 'src/utils';

export type MediaItemOrderBy =
  | 'title'
  | 'lastSeen'
  | 'unseenEpisodes'
  | 'releaseDate'
  | 'nextAiring'
  | 'lastAiring'
  | 'status'
  | 'progress'
  | 'mediaType'
  | 'recommended'
  | 'platformRecommended';
export type SortOrder = 'asc' | 'desc';

export type LastSeenAt = 'now' | 'release_date' | 'unknown' | 'custom_date';

export type Pagination<T> = {
  data: T[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
};

export type GetItemsArgs = {
  userId: number;
  mediaType?: MediaType;
  orderBy?: MediaItemOrderBy;
  sortOrder?: SortOrder;
  /**
   * @description Return only items with title including this phrase
   */
  filter?: string;
  /**
   * @description Return only items on watchlist
   */
  onlyOnWatchlist?: boolean;
  /**
   * @description Return only seen items
   */
  onlySeenItems?: boolean;
  /**
   * @description
   */
  onlyWithNextEpisodesToWatch?: boolean;
  /**
   * @description Return only items with upcoming episode with release date, or unreleased other media with release date
   */

  onlyWithNextAiring?: boolean;
  /**
   * @description Return only items with user rating
   */
  onlyWithUserRating?: boolean;
  /**
   * @description Return only items without user rating
   */
  onlyWithoutUserRating?: boolean;
  /**
   * @description Selects a random Item
   */
  selectRandom?: boolean;
  /**
   * @description Filter by Year
   */
  year?: string;
  /**
   * @description Filter by Genre
   */
  genre?: string;

  /**
   * @description Filter by multiple genres (comma-separated, OR logic within dimension)
   */
  genres?: string;

  /**
   * @description Filter by multiple languages (comma-separated language codes, OR logic)
   */
  languages?: string;

  /**
   * @description Filter by multiple creators (comma-separated names, OR logic)
   */
  creators?: string;

  /**
   * @description Filter by multiple publishers (comma-separated names, OR logic)
   */
  publishers?: string;

  /**
   * @description Filter by multiple media types (comma-separated, OR logic)
   */
  mediaTypes?: string;

  /**
   * @description Filter by minimum release year (inclusive)
   */
  yearMin?: number;

  /**
   * @description Filter by maximum release year (inclusive)
   */
  yearMax?: number;

  /**
   * @description Filter by minimum TMDB rating (inclusive, 0-10)
   */
  ratingMin?: number;

  /**
   * @description Filter by maximum TMDB rating (inclusive, 0-10)
   */
  ratingMax?: number;

  /**
   * @description Filter by status keys (comma-separated: rated, unrated, watchlist, seen)
   * Maps to: rated -> onlyWithUserRating, unrated -> onlyWithoutUserRating, watchlist -> onlyOnWatchlist, seen -> onlySeenItems
   */
  status?: string;

  onlyWithProgress?: boolean;

  page?: number;
  mediaItemIds?: number[];

  /**
   * @description When provided with orderBy === 'platformRecommended', scopes the sort
   * to use the group's cached platform rating (groupPlatformRating) instead of the
   * global mediaItem.platformRating. Ignored for all other sort modes.
   */
  groupId?: number;

  /**
   * @description When provided, overlays localized metadata (title, overview, genres)
   * from the mediaItemTranslation table for the given language code.
   * Sets metadataLanguage on each result indicating which language was applied.
   */
  language?: string | null;
};

export type FacetQueryArgs = {
  userId: number;
  mediaType?: MediaType;
  /**
   * @description Return only items with title including this phrase
   */
  filter?: string;
  /**
   * @description Filter by multiple genres (comma-separated, OR logic within dimension)
   */
  genres?: string;
  /**
   * @description Filter by multiple languages (comma-separated language codes, OR logic)
   */
  languages?: string;
  /**
   * @description Filter by multiple creators (comma-separated names, OR logic)
   */
  creators?: string;
  /**
   * @description Filter by multiple publishers (comma-separated names, OR logic)
   */
  publishers?: string;
  /**
   * @description Filter by multiple media types (comma-separated, OR logic)
   */
  mediaTypes?: string;
  /**
   * @description Filter by minimum release year (inclusive)
   */
  yearMin?: number;
  /**
   * @description Filter by maximum release year (inclusive)
   */
  yearMax?: number;
  /**
   * @description Filter by minimum TMDB rating (inclusive, 0-10)
   */
  ratingMin?: number;
  /**
   * @description Filter by maximum TMDB rating (inclusive, 0-10)
   */
  ratingMax?: number;
  /**
   * @description Filter by status keys (comma-separated: rated, unrated, watchlist, seen)
   */
  status?: string;
  /**
   * @description Return only items on watchlist
   */
  onlyOnWatchlist?: boolean;
  /**
   * @description Return only seen items
   */
  onlySeenItems?: boolean;
  /**
   * @description Return only items with upcoming episode or release
   */
  onlyWithNextAiring?: boolean;
  /**
   * @description Return only TV shows with next episodes to watch
   */
  onlyWithNextEpisodesToWatch?: boolean;
  /**
   * @description Return only items with user rating
   */
  onlyWithUserRating?: boolean;
  /**
   * @description Return only items without user rating
   */
  onlyWithoutUserRating?: boolean;
  onlyWithProgress?: boolean;
  /**
   * @description Sort order key — when 'platformRecommended', facets are computed
   * across all users' lists rather than only the current user's watchlist.
   */
  orderBy?: MediaItemOrderBy;

  /**
   * @description When provided with orderBy === 'platformRecommended', scopes the
   * facet counts to use group-scoped exclusion (majority-watched threshold) instead
   * of global exclusion. Ignored for all other sort modes.
   */
  groupId?: number;
};

class MediaItemRepository extends repository<MediaItemBase>({
  tableName: 'mediaItem',
  columnNames: mediaItemColumns,
  primaryColumnName: 'id',
  booleanColumnNames: ['needsDetails'],
}) {
  public items(
    args: GetItemsArgs & { page: number }
  ): Promise<Pagination<MediaItemItemsResponse>>;
  public items(
    args: GetItemsArgs & { random: boolean }
  ): Promise<MediaItemItemsResponse[]>;
  public items(
    args: Omit<GetItemsArgs, 'page'>
  ): Promise<MediaItemItemsResponse[]>;
  public items(args: never): Promise<unknown> {
    return getItemsKnex(args);
  }

  public facets(args: FacetQueryArgs): Promise<FacetsResponse> {
    return getFacetsKnex(args);
  }

  public async details(params: {
    mediaItemId: number;
    userId: number;
    language?: string | null;
  }) {
    return getDetailsKnex(params);
  }

  public override deserialize(value: Partial<MediaItemBase>): MediaItemBase {
    return super.deserialize({
      ...value,
      genres: definedOrUndefined((value.genres as unknown as string)?.split(',')),
      narrators: splitCreatorField((value.narrators as unknown as string) || null),
      authors: splitCreatorField((value.authors as unknown as string) || null),
      platform: value.platform
        ? JSON.parse(value.platform as unknown as string)
        : undefined,
    });
  }

  public override serialize(value: Partial<MediaItemBase>) {
    const serializedValue = {
      ...value,
      genres: value.genres?.join(','),
      authors: value.authors?.join(','),
      narrators: value.narrators?.join(','),
      platform: value.platform ? JSON.stringify(value.platform) : null,
    } as unknown as Partial<MediaItemBase>;

    return super.serialize(serializedValue) as Record<string, unknown>;
  }

  public override async delete(where?: { id: number }) {
    if (!where?.id) {
      return 0;
    }

    const mediaItemId = where.id;

    return await Database.knex.transaction(async (trx) => {
      await trx<NotificationsHistory>('notificationsHistory')
        .delete()
        .where('mediaItemId', mediaItemId);
      await trx<TvEpisode>('episode').delete().where('tvShowId', mediaItemId);
      await trx<TvSeason>('season').delete().where('tvShowId', mediaItemId);
      return await trx<MediaItemBase>(this.tableName)
        .delete()
        .where('id', mediaItemId);
    });
  }

  public override async update(
    mediaItem: MediaItemBaseWithSeasons
  ): Promise<MediaItemBaseWithSeasons> {
    if (!mediaItem.id) {
      throw new Error('mediaItem.id filed is required');
    }

    if (!mediaItem.externalPosterUrl) {
      mediaItem.posterId = null;
    }

    if (!mediaItem.externalBackdropUrl) {
      mediaItem.backdropId = null;
    }

    return await Database.knex.transaction(async (trx) => {
      if (mediaItem.externalPosterUrl && !mediaItem.posterId) {
        mediaItem.posterId = getImageId();
      }

      if (mediaItem.externalBackdropUrl && !mediaItem.backdropId) {
        mediaItem.backdropId = getImageId();
      }

      const result = {
        ..._.cloneDeep(mediaItem),
        lastTimeUpdated: mediaItem.lastTimeUpdated
          ? mediaItem.lastTimeUpdated
          : new Date().getTime(),
      };

      const serializedMediaItem = this.serialize(
        this.stripValue({
          ...mediaItem,
          posterId: mediaItem.externalPosterUrl ? mediaItem.posterId : undefined,
          backdropId: mediaItem.externalBackdropUrl
            ? mediaItem.backdropId
            : undefined,
        })
      );

      if (!mediaItem.externalPosterUrl) {
        serializedMediaItem.posterId = null;
      }

      if (!mediaItem.externalBackdropUrl) {
        serializedMediaItem.backdropId = null;
      }

      await trx(this.tableName)
        .update(serializedMediaItem)
        .where({
          id: mediaItem.id,
        });

      if (result.seasons) {
        await Promise.all(
          result.seasons.map(async (season) => {
            let updated = false;

            season.numberOfEpisodes =
              season.numberOfEpisodes || season.episodes?.length || 0;
            season.tvShowId = mediaItem.id;

            if (!season.externalPosterUrl) {
              season.posterId = null;
            }

            if (season.externalPosterUrl && !season.posterId) {
              season.posterId = getImageId();
            }

            const newSeason = omitUndefinedValues(
              tvSeasonRepository.stripValue(
                tvSeasonRepository.serialize(season) as Partial<TvSeason>
              )
            );

            if (season.id) {
              const res = await trx('season')
                .update(newSeason)
                .where({ id: season.id });

              updated = res === 1;
            }

            if (!updated) {
              season.id = (
                await trx('season').insert(newSeason).returning('id')
              ).at(0).id;
            }

            if (season.episodes) {
              for (const episode of season.episodes) {
                let updated = false;

                episode.seasonAndEpisodeNumber =
                  episode.seasonNumber * 1000 + episode.episodeNumber;
                episode.seasonId = season.id;
                episode.tvShowId = mediaItem.id;

                const newEpisode = omitUndefinedValues(
                  tvEpisodeRepository.stripValue(
                    tvEpisodeRepository.serialize(episode) as Partial<TvEpisode>
                  )
                );

                if (episode.id) {
                  const res = await trx<TvEpisode>('episode')
                    .update(newEpisode)
                    .where({ id: episode.id });

                  updated = res === 1;
                }
                if (!updated) {
                  episode.id = (
                    await trx('episode').insert(newEpisode).returning('id')
                  ).at(0).id;
                }
              }
            }
          })
        );
      }

      return result;
    });
  }

  public override async create(mediaItem: MediaItemBaseWithSeasons) {
    if (mediaItem.releaseDate && !isValid(parseISO(mediaItem.releaseDate))) {
      logger.error(`Invalid date format for ${mediaItem.id}`);
      mediaItem.releaseDate = undefined;
    }

    if (mediaItem.externalPosterUrl) {
      mediaItem.posterId = getImageId();
    }

    if (mediaItem.externalBackdropUrl) {
      mediaItem.backdropId = getImageId();
    }

    return await Database.knex.transaction(async (trx) => {
      const result = {
        ..._.cloneDeep(mediaItem),
        lastTimeUpdated: mediaItem.lastTimeUpdated
          ? mediaItem.lastTimeUpdated
          : new Date().getTime(),
      };

      const res = await trx(this.tableName)
        .insert(this.serialize(omitUndefinedValues(this.stripValue(mediaItem))))
        .returning(this.primaryColumnName);

      result.id = res.at(0)[this.primaryColumnName];

      result.seasons = result.seasons?.map((season) => ({
        ...season,
        numberOfEpisodes:
          season.numberOfEpisodes || season.episodes?.length || 0,
        tvShowId: result.id,
        posterId: season.externalPosterUrl ? getImageId() : null,
      }));

      result.seasons?.forEach((season) => {
        if (season.releaseDate && !isValid(parseISO(season.releaseDate))) {
          logger.error(`Invalid date format for season ${season.id}`);
          season.releaseDate = undefined;
        }
      });

      const seasons = result.seasons ?? [];

      if (seasons.length > 0) {
        const seasonsId = await Database.knex
          .batchInsert(
            'season',
            seasons.map((season) => _.omit(season, 'episodes')),
            30
          )
          .transacting(trx)
          .returning('id');

        result.seasons = _.merge(seasons, seasonsId);

        for (const season of result.seasons) {
          const episodes = season.episodes ?? [];

          if (episodes.length > 0) {
            season.episodes = episodes.map((episode) => ({
              ...episode,
              tvShowId: result.id,
              seasonId: season.id,
              seasonAndEpisodeNumber:
                episode.seasonNumber * 1000 + episode.episodeNumber,
            }));

            season.episodes?.forEach((episode) => {
              if (
                episode.releaseDate &&
                !isValid(parseISO(episode.releaseDate))
              ) {
                logger.error(`Invalid date format for episode ${episode.id}`);
                episode.releaseDate = undefined;
              }
            });

            const episodesId = await Database.knex
              .batchInsert('episode', season.episodes, 30)
              .transacting(trx)
              .returning('id');

            season.episodes = _.merge(season.episodes, episodesId);
          }
        }
      }

      return result;
    });
  }

  public override async createMany(values: Partial<MediaItemBase>[]) {
    const createdItems = await Promise.all(
      (values as MediaItemBaseWithSeasons[]).map((mediaItem) =>
        this.create(mediaItem)
      )
    );

    return createdItems.map((mediaItem) => mediaItem.id);
  }

  public async seasonsWithEpisodes(mediaItem: MediaItemBase) {
    const seasons = await tvSeasonRepository.find({
      tvShowId: Number(mediaItem.id),
    });

    const episodes = await tvEpisodeRepository.find({
      tvShowId: Number(mediaItem.id),
    });

    const groupedEpisodes = _.groupBy(episodes, (episode) => episode.seasonId);

    seasons.forEach((season) => {
      if (season.id != null) {
        season.episodes = groupedEpisodes[season.id];
      }
    });

    return seasons;
  }

  public async findByExternalIds(params: {
    tmdbId?: number[];
    imdbId?: string[];
    tvmazeId?: number[];
    igdbId?: number[];
    openlibraryId?: number[];
    audibleId?: string[];
    goodreadsId?: number[];
    traktId?: number[];
    tvdbId?: number[];
    mediaType: MediaType;
  }) {
    const totalNumberOfIds = externalIdColumnNames.reduce(
      (sum, id) => sum + (params[id]?.length ?? 0),
      0
    );

    if (totalNumberOfIds < 100) {
      return (
        await Database.knex<MediaItemBase>(this.tableName)
          .where({ mediaType: params.mediaType })
          .andWhere((qb) => {
            externalIdColumnNames.forEach((id) => {
              const values = params[id];

              if (values && values.length > 0) {
                qb.orWhereIn(id, values);
              }
            });
          })
      ).map((item) => this.deserialize(item));
    }

    const splittedExternalIds = externalIdColumnNames.reduce<
      Array<{ columnName: (typeof externalIdColumnNames)[number]; values: Array<string | number> }>
    >((items, id) => {
      const values = params[id];

      if (!values || values.length === 0) {
        return items;
      }

      values.forEach(() => undefined);
      items.push(
        ..._.chunk(values as Array<string | number>, 100).map((chunk) => ({
          columnName: id,
          values: chunk,
        }))
      );

      return items;
    }, []);

    return (
      await Database.knex.transaction(async (trx) => {
        return _.flatten(
          await Promise.all(
            splittedExternalIds.map(
              async (item) =>
                await trx<MediaItemBase>(this.tableName)
                  .where({
                    mediaType: params.mediaType,
                  })
                  .whereIn(item.columnName, item.values)
            )
          )
        );
      })
    ).map((item) => this.deserialize(item));
  }

  public async findByExternalId(params: ExternalIds, mediaType: MediaType) {
    const res = await Database.knex<MediaItemBase>(this.tableName)
      .where({ mediaType: mediaType })
      .andWhere((qb) => {
        if (params.tmdbId) {
          qb.orWhere('tmdbId', params.tmdbId);
        }
        if (params.imdbId) {
          qb.orWhere('imdbId', params.imdbId);
        }
        if (params.tvmazeId) {
          qb.orWhere('tvmazeId', params.tvmazeId);
        }
        if (params.igdbId) {
          qb.orWhere('igdbId', params.igdbId);
        }
        if (params.openlibraryId) {
          qb.orWhere('openlibraryId', params.openlibraryId);
        }
        if (params.audibleId) {
          qb.orWhere('audibleId', params.audibleId);
        }
        if (params.goodreadsId) {
          qb.orWhere('goodreadsId', params.goodreadsId);
        }
        if (params.traktId) {
          qb.orWhere('traktId', params.traktId);
        }

        if (params.tvdbId) {
          qb.orWhere('tvdbId', params.tvdbId);
        }
      })
      .first();

    if (res) {
      return this.deserialize(res);
    }
  }

  public async findByTitle(params: {
    mediaType: MediaType;
    title: string;
    releaseYear?: number;
  }): Promise<MediaItemBase | undefined> {
    if (typeof params.title !== 'string') {
      return undefined;
    }

    const qb = Database.knex<MediaItemBase>(this.tableName)
      .select(
        '*',
        Database.knex.raw(`LENGTH(title) - ${params.title.length} AS rank`)
      )
      .where('mediaType', params.mediaType)
      .where((qb) =>
        qb
          .where('title', 'LIKE', `%${params.title}%`)
          .orWhere('originalTitle', 'LIKE', `%${params.title}%`)
      )
      .orderBy('rank', 'asc');

    if (params.releaseYear) {
      qb.whereBetween('releaseDate', [
        new Date(params.releaseYear, 0, 1).toISOString(),
        new Date(params.releaseYear, 11, 31).toISOString(),
      ]);
    }

    const result = await qb.first();

    return result ? this.deserialize(result) : undefined;
  }

  public async findByExactTitle(params: {
    mediaType: MediaType;
    title: string;
    releaseYear?: number;
  }): Promise<MediaItemBase | undefined> {
    if (typeof params.title !== 'string') {
      return undefined;
    }

    const qb = Database.knex<MediaItemBase>(this.tableName)
      .where('mediaType', params.mediaType)
      .where((qb) =>
        qb
          .where('title', 'LIKE', params.title)
          .orWhere('originalTitle', 'LIKE', params.title)
      );

    if (params.releaseYear) {
      qb.whereBetween('releaseDate', [
        new Date(params.releaseYear, 0, 1).toISOString(),
        new Date(params.releaseYear, 11, 31).toISOString(),
      ]);
    }

    const res = await qb.first();

    if (res) {
      return this.deserialize(res);
    }
  }

  public async itemsToPossiblyUpdate(): Promise<MediaItemBase[]> {
    return await Database.knex<MediaItemBase>('mediaItem')
      .select('mediaItem.*')
      .leftJoin<Seen>('seen', 'seen.mediaItemId', 'mediaItem.id')
      .leftJoin<ListItem>('listItem', 'listItem.mediaItemId', 'mediaItem.id')
      .leftJoin<UserRating>(
        'userRating',
        'userRating.mediaItemId',
        'mediaItem.id'
      )
      .where((q) =>
        q
          .whereNotNull('seen.id')
          .orWhereNotNull('listItem.id')
          .orWhereNotNull('userRating.id')
      )
      .whereNot('source', 'user')
      .whereNot('source', 'goodreads')
      .groupBy('mediaItem.id');
  }

  public async itemsToNotify(from: Date, to: Date): Promise<MediaItemBase[]> {
    const res: MediaItemBase[] = await Database.knex<MediaItemBase>(
      this.tableName
    )
      .select('mediaItem.*')
      .select('notificationsHistory.mediaItemId')
      .select('notificationsHistory.id AS notificationsHistory.id')
      .leftJoin<NotificationsHistory>(
        'notificationsHistory',
        'notificationsHistory.mediaItemId',
        'mediaItem.id'
      )
      .where((qb) =>
        qb
          .whereBetween('mediaItem.releaseDate', [
            from.toISOString(),
            to.toISOString(),
          ])
          .orWhereBetween('mediaItem.releaseDate', [
            subMinutes(from, new Date().getTimezoneOffset()).toISOString(),
            subMinutes(to, new Date().getTimezoneOffset()).toISOString(),
          ])
      )
      .whereNot('mediaType', 'tv')
      .whereNull('notificationsHistory.id');

    return _(res)
      .uniqBy('id')
      .filter((item) => {
        if (!item.releaseDate) {
          return false;
        }

        const releaseDate = parseISO(item.releaseDate);
        return releaseDate > from && releaseDate < to;
      })
      .value();
  }

  public async episodesToNotify(from: Date, to: Date) {
    const res = await Database.knex<TvEpisode>('episode')
      .select(generateColumnNames('episode', tvEpisodeColumns))
      .select(generateColumnNames('mediaItem', mediaItemColumns))
      .select('notificationsHistory.mediaItemId')
      .select('notificationsHistory.id AS notificationsHistory.id')
      .leftJoin<NotificationsHistory>(
        'notificationsHistory',
        'notificationsHistory.episodeId',
        'episode.id'
      )
      .leftJoin<MediaItemBase>('mediaItem', 'mediaItem.id', 'episode.tvShowId')
      .where((qb) =>
        qb
          .whereBetween('episode.releaseDate', [
            from.toISOString(),
            to.toISOString(),
          ])
          .orWhereBetween('episode.releaseDate', [
            subMinutes(from, new Date().getTimezoneOffset()).toISOString(),
            subMinutes(to, new Date().getTimezoneOffset()).toISOString(),
          ])
      )
      .where('episode.isSpecialEpisode', false)
      .whereNull('notificationsHistory.id');

    return _(res)
      .uniqBy('episode.id')
      .filter((item) => {
        const releaseDate = parseISO(item['episode.releaseDate']);
        return releaseDate > from && releaseDate < to;
      })
      .map((row) =>
        _(row)
          .pickBy((value, column) => column.startsWith('episode.'))
          .mapKeys((value, key) => key.substring('episode.'.length))
          .set(
            'tvShow',
            _(row)
              .pickBy((value, column) => column.startsWith('mediaItem.'))
              .mapKeys((value, key) => key.substring('mediaItem.'.length))
              .value()
          )
          .value()
      )
      .value() as (TvEpisode & { tvShow: MediaItemBase })[];
  }

  public async lock(mediaItemId: number) {
    const res = await Database.knex<MediaItemBase>(this.tableName)
      .update({ lockedAt: new Date().getTime() })
      .where('id', mediaItemId)
      .where('lockedAt', null);

    if (res === 0) {
      throw new Error(`MediaItem ${mediaItemId} is locked`);
    }
  }

  public async unlock(mediaItemId: number) {
    await Database.knex<MediaItemBase>(this.tableName)
      .update({ lockedAt: Database.knex.raw('NULL') })
      .where('id', mediaItemId);
  }

  public async mergeSearchResultWithExistingItems(
    searchResult: MediaItemForProvider[],
    mediaType: MediaType
  ) {
    return await Promise.all(
      searchResult
        .filter(
          (item) =>
            externalIdColumnNames
              .map((columnName) => item[columnName])
              .filter(Boolean).length > 0
        )
        .map(async (item) => {
          return await Database.knex.transaction(async (trx) => {
            const existingItem = await trx<MediaItemBase>('mediaItem')
              .where({ mediaType: mediaType })
              .andWhere((qb) => {
                externalIdColumnNames.map((columnName) => {
                  if (item[columnName]) {
                    qb.orWhere(columnName, item[columnName]);
                  }
                });
              })
              .first();

            if (existingItem) {
              return existingItem;
            }

            const [res] = await trx<MediaItemBase>('mediaItem')
              .insert({
                ...this.serialize(omitUndefinedValues(this.stripValue(item))),
                posterId: item.externalPosterUrl ? getImageId() : undefined,
                backdropId: item.externalBackdropUrl ? getImageId() : undefined,
                lastTimeUpdated: Date.now(),
              })
              .returning('*');

            return res;
          });
        })
    );
  }

  /**
   * Recalculates the platformRating cache for a single mediaItem.
   *
   * Computes the average across ALL applicable rating signals for the item:
   *   1. Explicit user ratings from the userRating table (item-level only — episode
   *      and season ratings are excluded because platformRating represents the item
   *      as a whole, not individual episode quality).
   *   2. AI-estimated ratings stored in listItem.estimatedRating (set by the
   *      recommendation pipeline for items that have not yet been explicitly rated).
   *
   * Combining both sources allows the cache to reflect community consensus when
   * users have rated the item directly, while also capturing AI-derived estimates
   * for items that are on lists but have not yet accumulated explicit ratings.
   *
   * When neither source provides any non-null values, AVG() returns NULL, which
   * clears any stale cached value — correctly representing "no data."
   *
   * This must be called via setImmediate() so it executes after the HTTP
   * response is sent and does not affect endpoint latency.
   *
   * @param mediaItemId - The ID of the mediaItem whose cache should be refreshed.
   */
  public async recalculatePlatformRating(mediaItemId: number): Promise<void> {
    await Database.knex<MediaItemBase>(this.tableName)
      .update({
        platformRating: Database.knex.raw(
          `(SELECT AVG(r) FROM (
            SELECT "rating" AS r FROM "userRating"
            WHERE "mediaItemId" = ?
              AND "rating" IS NOT NULL
              AND "episodeId" IS NULL
              AND "seasonId" IS NULL
            UNION ALL
            SELECT "estimatedRating" AS r FROM "listItem"
            WHERE "mediaItemId" = ?
              AND "estimatedRating" IS NOT NULL
          ) AS combined_ratings)`,
          [mediaItemId, mediaItemId]
        ),
      })
      .where('id', mediaItemId);
  }

  public async unlockLockedMediaItems() {
    return await Database.knex<MediaItemBase>(this.tableName)
      .update('lockedAt', null)
      .where('lockedAt', '<=', subDays(new Date(), 1).getTime());
  }
}

export const mediaItemRepository = new MediaItemRepository();

const externalIdColumnNames = <const>[
  'openlibraryId',
  'imdbId',
  'tmdbId',
  'igdbId',
  'tvmazeId',
  'audibleId',
  'traktId',
  'goodreadsId',
  'tvdbId',
];

const groupByExternalId = <T extends MediaItemForProvider>(items: T[]) => {
  return _(externalIdColumnNames)
    .keyBy()
    .mapValues((externalIdColumnName) =>
      _(items)
        .filter((item) => Boolean(item[externalIdColumnName]))
        .groupBy(externalIdColumnName)
        .value()
    )
    .value();
};
