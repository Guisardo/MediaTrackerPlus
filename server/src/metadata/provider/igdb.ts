import urljoin from 'url-join';
import axios from 'axios';

import { ExternalIds, MediaItemForProvider } from 'src/entity/mediaItem';
import { RequestQueue } from 'src/requestQueue';
import { MetadataProvider } from 'src/metadata/metadataProvider';
import { GlobalConfiguration } from 'src/repository/globalSettings';
import { logger } from 'src/logger';
import { SimilarItem } from 'src/metadata/types';
import { definedOrUndefined } from 'src/repository/repository';
import {
  normalizeStrictestCertification,
  ProviderCertification,
} from 'src/metadata/parentalMetadata';

const getPosterUrl = (path: string, size: CoverSize = 't_original') => {
  return urljoin(
    'https://images.igdb.com/igdb/image/upload/',
    size,
    path + '.jpg'
  );
};

export class IGDB extends MetadataProvider {
  readonly name = 'IGDB';
  readonly mediaType = 'video_game';

  public override async search(query: string): Promise<MediaItemForProvider[]> {
    const result = await this.searchGames(query);

    return Promise.all(result.map((item) => this.mapGame(item)));
  }

  override async details(mediaItem: ExternalIds): Promise<MediaItemForProvider> {
    if (!mediaItem.igdbId) {
      throw new Error('IGDB.details requires an igdbId');
    }

    const result = await this.game(mediaItem.igdbId);

    if (!result) {
      throw new Error(`IGDB.details: no game found for igdbId=${mediaItem.igdbId}`);
    }

    return this.mapGame(result);
  }

  override async fetchGameLocalizations(
    ids: ExternalIds
  ): Promise<Array<{ regionId: number; name: string }>> {
    if (!ids.igdbId) {
      logger.warn(
        `IGDB.fetchGameLocalizations: no igdbId provided — returning empty results`
      );
      return [];
    }

    const query = `fields name, region; where game = ${ids.igdbId};`;
    const results = (await this.get('game_localizations', query)) as IgdbGameLocalization[];

    if (!results || results.length === 0) {
      logger.debug(
        `IGDB.fetchGameLocalizations: no localizations found for igdbId=${ids.igdbId}`
      );
      return [];
    }

    logger.debug(
      `IGDB: no localized description available, storing title only`
    );

    return results
      .filter((loc) => loc.region != null && loc.name)
      .map((loc) => ({
        regionId: loc.region,
        name: loc.name,
      }));
  }

  override async similar(ids: ExternalIds): Promise<SimilarItem[]> {
    if (!ids.igdbId) {
      logger.warn(`IGDB.similar: no igdbId provided — returning empty results`);
      return [];
    }

    const similarGameIds = await this.fetchSimilarGameIds(ids.igdbId);

    if (similarGameIds.length === 0) {
      logger.debug(`IGDB.similar: no similar games found for igdbId=${ids.igdbId}`);
      return [];
    }

    const gameDetails = await this.fetchSimilarGameDetails(similarGameIds);
    return this.mapGamesToSimilarItems(gameDetails);
  }

  private async fetchSimilarGameIds(igdbId: number): Promise<number[]> {
    const query = `fields similar_games; where id = ${igdbId};`;
    const results = (await this.get('games', query)) as IgdbGameSimilar[];

    if (!results || results.length === 0) {
      return [];
    }

    return results[0].similar_games ?? [];
  }

  private async fetchSimilarGameDetails(
    gameIds: number[]
  ): Promise<IgdbGameDetail[]> {
    const idList = gameIds.join(',');
    const query = `fields name,total_rating,total_rating_count; where id = (${idList});`;
    const results = (await this.get('games', query)) as IgdbGameDetail[];
    return results ?? [];
  }

  private mapGamesToSimilarItems(games: IgdbGameDetail[]): SimilarItem[] {
    return games
      .map((game): SimilarItem | null => {
        if (!game.name) {
          return null;
        }

        let externalRating: number | null = null;

        if (
          game.total_rating !== undefined &&
          game.total_rating !== null &&
          game.total_rating !== 0
        ) {
          externalRating = game.total_rating / 10;
        }

        if (
          externalRating !== null &&
          (externalRating < 0 || externalRating > 10)
        ) {
          externalRating = null;
        }

        return {
          externalId: String(game.id),
          mediaType: 'video_game',
          title: game.name,
          externalRating,
        };
      })
      .filter((item): item is SimilarItem => item !== null);
  }

  private mapGame(searchResult: Game): MediaItemForProvider {
    const website = searchResult.websites?.[0]?.url;
    const parentalData = mapIgdbAgeRatings(searchResult.age_ratings);

    return {
      needsDetails: false,
      source: this.name,
      mediaType: this.mediaType,
      igdbId: searchResult.id,
      releaseDate: searchResult.first_release_date
        ? new Date(searchResult.first_release_date * 1000).toISOString()
        : undefined,
      title: searchResult.name,
      overview: definedOrUndefined(searchResult.summary),
      externalPosterUrl: searchResult.cover
        ? getPosterUrl(searchResult.cover.image_id)
        : undefined,
      genres: searchResult.genres
        ? searchResult.genres.map((genre) => genre.name)
        : undefined,
      url: definedOrUndefined(website),
      developer: searchResult.involved_companies?.find((item) => item.developer)
        ?.company.name,
      publisher: searchResult.involved_companies
        ?.filter((item) => item.publisher)
        .map((item) => item.company.name)
        .join(', ') || undefined,
      platform: searchResult.platforms?.map((value) => value.name),
      ...parentalData,
    };
  }

  private async game(gameId: number): Promise<Game | undefined> {
    const res = (await this.get(
      'games',
      `fields
        name,
        first_release_date,
        summary,
        cover.image_id,
        involved_companies.company.name,
        involved_companies.developer,
        involved_companies.publisher,
        platforms.name,
        platforms.platform_logo.id,
        genres.name,
        platforms.id,
        release_dates.date,
        release_dates.platform,
        websites.url,
        age_ratings.category,
        age_ratings.rating,
        age_ratings.content_descriptions.description;
      where id = ${gameId} & version_parent = null;`
    )) as Game[];
    if (res?.length > 0) {
      return res[0];
    }
  }

  private async searchGames(query: string) {
    return (await this.get(
      'games',
      `fields 
        name,
        first_release_date,
        summary,
        cover.image_id, 
        involved_companies.company.name,
        involved_companies.developer,
        involved_companies.publisher,
        platforms.name, 
        platforms.platform_logo.id, 
        genres.name, 
        platforms.id,
        release_dates.date,
        release_dates.platform,
        websites.url; 
      search "${query}"; 
      where version_parent = null; 
      limit 50;`
    )) as Game[];
  }

  private async get(endpoint: string, query: string) {
    await this.refreshToken();
    const token = this.token;

    if (!token) {
      throw new Error('IGDB token was not initialized');
    }

    const result = await this.requestQueue.request(() =>
      axios.post(urljoin('https://api.igdb.com/v4/', endpoint), query, {
        headers: {
          Authorization: 'Bearer ' + token.access_token,
          'Client-ID': GlobalConfiguration.configuration.igdbClientId,
        },
      })
    );

    return result.data;
  }

  private async refreshToken() {
    if (
      this.token &&
      this.tokenAcquiredAt &&
      this.tokenAcquiredAt.getTime() + this.token.expires_in * 1000 >
      new Date().getTime()
    ) {
      return;
    }

    const result = await this.requestQueue.request(() =>
      axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: GlobalConfiguration.configuration.igdbClientId,
          client_secret: GlobalConfiguration.configuration.igdbClientSecret,
          grant_type: 'client_credentials',
        },
      })
    );

    if (result.status === 200) {
      this.token = result.data as Token;
      this.tokenAcquiredAt = new Date();
    }
  }

  private token?: Token;
  private tokenAcquiredAt?: Date;
  private readonly requestQueue = new RequestQueue({
    timeBetweenRequests: 250,
  });

}

interface IgdbGameLocalization {
  id: number;
  name: string;
  region: number;
}

interface IgdbGameSimilar {
  id: number;
  similar_games?: number[];
}

interface IgdbGameDetail {
  id: number;
  name: string;
  total_rating?: number;
  total_rating_count?: number;
}

interface Token {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * IGDB AgeRating object returned when `age_ratings` is expanded inline.
 */
interface IgdbAgeRating {
  id: number;
  /** 1=ESRB, 2=PEGI, 3=CERO, 4=USK, 5=GRAC */
  category: number;
  /** Provider-specific rating integer (see IGDB_RATING_MAP). */
  rating: number;
  content_descriptions?: Array<{ description: string }>;
}

/**
 * Map IGDB age_ratings category+rating pairs to canonical rating system labels.
 *
 * Category enum: 1=ESRB, 2=PEGI, 3=CERO, 4=USK, 5=GRAC
 *
 * ESRB rating enum: 6=EC, 7=E, 8=E10+, 9=T, 10=M, 11=AO
 * PEGI rating enum: 1=3, 2=7, 3=12, 4=16, 5=18
 * CERO rating enum: 1=A, 2=B, 3=C, 4=D, 5=Z
 * USK rating enum:  1=0, 2=6, 3=12, 4=16, 5=18
 * GRAC rating enum: 1=ALL, 2=12, 3=15, 4=18, 5=TESTING
 */
const IGDB_CATEGORY_MAP: Record<number, string> = {
  1: 'ESRB',
  2: 'PEGI',
  3: 'CERO',
  4: 'USK',
  5: 'GRAC',
};

const IGDB_ESRB_LABEL_MAP: Record<number, string> = {
  6: 'EC',
  7: 'E',
  8: 'E10+',
  9: 'T',
  10: 'M',
  11: 'AO',
};

const IGDB_PEGI_LABEL_MAP: Record<number, string> = {
  1: '3',
  2: '7',
  3: '12',
  4: '16',
  5: '18',
};

const IGDB_CERO_LABEL_MAP: Record<number, string> = {
  1: 'A',
  2: 'B',
  3: 'C',
  4: 'D',
  5: 'Z',
};

const IGDB_USK_LABEL_MAP: Record<number, string> = {
  1: '0',
  2: '6',
  3: '12',
  4: '16',
  5: '18',
};

const IGDB_GRAC_LABEL_MAP: Record<number, string> = {
  1: 'ALL',
  2: '12',
  3: '15',
  4: '18',
};

const IGDB_RATING_LABEL_MAPS: Record<number, Record<number, string>> = {
  1: IGDB_ESRB_LABEL_MAP,
  2: IGDB_PEGI_LABEL_MAP,
  3: IGDB_CERO_LABEL_MAP,
  4: IGDB_USK_LABEL_MAP,
  5: IGDB_GRAC_LABEL_MAP,
};

/**
 * IGDB region codes by category (for canonical region field).
 * ESRB=US, PEGI=GB (representative for EU), CERO=JP, USK=DE, GRAC=KR.
 */
const IGDB_CATEGORY_REGION: Record<number, string> = {
  1: 'US',
  2: 'GB',
  3: 'JP',
  4: 'DE',
  5: 'KR',
};

/**
 * Convert IGDB inline age_ratings to ProviderCertification[] and normalize
 * using the strictest-certification strategy (highest minimumAge wins).
 *
 * IGDB may return multiple rating systems per game (e.g. ESRB + PEGI).
 * Unknown category/rating combinations are silently skipped.
 * When no age_ratings are present all parental fields remain null.
 */
const mapIgdbAgeRatings = (
  ageRatings: IgdbAgeRating[] | undefined
): ReturnType<typeof normalizeStrictestCertification> => {
  if (!ageRatings || ageRatings.length === 0) {
    return normalizeStrictestCertification([]);
  }

  const certifications: ProviderCertification[] = [];

  for (const ar of ageRatings) {
    const system = IGDB_CATEGORY_MAP[ar.category];
    if (!system) {
      continue;
    }
    const labelMap = IGDB_RATING_LABEL_MAPS[ar.category];
    if (!labelMap) {
      continue;
    }
    const label = labelMap[ar.rating];
    if (!label) {
      continue;
    }
    const region = IGDB_CATEGORY_REGION[ar.category] ?? 'US';
    const descriptors = ar.content_descriptions
      ? ar.content_descriptions.map((d) => d.description).filter(Boolean)
      : undefined;

    certifications.push({
      region,
      system,
      label,
      descriptors: descriptors && descriptors.length > 0 ? descriptors : undefined,
    });
  }

  return normalizeStrictestCertification(certifications);
};

interface Game {
  id: number;
  age_ratings?: IgdbAgeRating[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  alternative_names?: number[];
  artworks?: number[];
  category: number;
  collection?: Collection;
  cover?: Image;
  created_at: number;
  expansions?: number[];
  external_games?: number[];
  first_release_date?: number;
  follows?: number;
  franchises?: Franchise[];
  game_engines?: number[];
  game_modes?: number[];
  genres?: Genre[];
  hypes?: number;
  involved_companies?: InvolvedCompany[];
  keywords?: number[];
  name: string;
  platforms?: Platform[];
  player_perspectives?: number[];
  rating?: number;
  rating_count?: number;
  release_dates?: number[];
  screenshots?: number[];
  similar_games?: number[];
  slug: string;
  storyline?: string;
  summary?: string;
  tags?: number[];
  themes?: number[];
  total_rating?: number;
  total_rating_count?: number;
  updated_at: number;
  url: string;
  videos?: number[];
  websites?: Website[];
  checksum: string;
  version_parent?: number;
  version_title?: string;
  parent_game?: number;
}

interface Platform {
  id: number;
  abbreviation: string;
  alternative_name?: string;
  category: number;
  created_at: number;
  name: string;
  platform_logo: Image;
  slug: string;
  updated_at: number;
  url: string;
  versions: number[];
  websites: number[];
  checksum: string;
  generation?: number;
  platform_family?: number;
  summary?: string;
}

interface Genre {
  id: number;
  created_at: number;
  name: string;
  slug: string;
  updated_at: number;
  url: string;
  checksum: string;
}

interface Image {
  id: number;
  alpha_channel: boolean;
  animated: boolean;
  game: number;
  height: number;
  image_id: string;
  url: string;
  width: number;
  checksum: string;
}

interface Collection {
  id: number;
  created_at: number;
  games: number[];
  name: string;
  slug: string;
  updated_at: number;
  url: string;
  checksum: string;
}

interface Franchise {
  id: number;
  created_at: number;
  games: number[];
  name: string;
  slug: string;
  updated_at: number;
  url: string;
  checksum: string;
}

interface InvolvedCompany {
  id: number;
  company: Company;
  created_at: number;
  developer: boolean;
  game: number;
  porting: boolean;
  publisher: boolean;
  supporting: boolean;
  updated_at: number;
  checksum: string;
}

interface Company {
  id: number;
  change_date_category: number;
  country: number;
  created_at: number;
  description?: string;
  developed?: number[];
  logo?: number;
  name: string;
  parent?: number;
  published?: number[];
  slug: string;
  start_date?: number;
  start_date_category: number;
  updated_at: number;
  url: string;
  websites?: number[];
  checksum: string;
}

interface Website {
  id: number;
  category: number;
  game: number;
  trusted: boolean;
  url: string;
  checksum: string;
}

type CoverSize =
  | 't_cover_big'
  | 't_thumb'
  | 't_720p'
  | 't_1080p'
  | 't_original';
