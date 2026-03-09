import urljoin from 'url-join';
import axios from 'axios';

import { ExternalIds, MediaItemForProvider } from 'src/entity/mediaItem';
import { RequestQueue } from 'src/requestQueue';
import { MetadataProvider } from 'src/metadata/metadataProvider';
import { GlobalConfiguration } from 'src/repository/globalSettings';
import { logger } from 'src/logger';
import { SimilarItem } from 'src/metadata/types';

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

  public async search(query: string): Promise<MediaItemForProvider[]> {
    const result = await this.searchGames(query);

    return Promise.all(result.map((item) => this.mapGame(item)));
  }

  async details(mediaItem: ExternalIds): Promise<MediaItemForProvider> {
    const result = await this.game(mediaItem.igdbId);
    return result ? this.mapGame(result) : null;
  }

  async similar(ids: ExternalIds): Promise<SimilarItem[]> {
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
    return {
      needsDetails: false,
      source: this.name,
      mediaType: this.mediaType,
      igdbId: searchResult.id,
      releaseDate: searchResult.first_release_date
        ? new Date(searchResult.first_release_date * 1000).toISOString()
        : null,
      title: searchResult.name,
      overview: searchResult.summary,
      externalPosterUrl: searchResult.cover
        ? getPosterUrl(searchResult.cover.image_id)
        : null,
      genres: searchResult.genres
        ? searchResult.genres.map((genre) => genre.name)
        : null,
      url:
        searchResult.websites?.length > 0 ? searchResult.websites[0].url : null,
      developer: searchResult.involved_companies?.find((item) => item.developer)
        ?.company.name,
      publisher: searchResult.involved_companies
        ?.filter((item) => item.publisher)
        .map((item) => item.company.name)
        .join(', ') || undefined,
      platform: searchResult.platforms?.map((value) => value.name),
    };
  }

  private async game(gameId: number) {
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
        websites.url; 
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

    const result = await this.requestQueue.request(() =>
      axios.post(urljoin('https://api.igdb.com/v4/', endpoint), query, {
        headers: {
          Authorization: 'Bearer ' + this.token.access_token,
          'Client-ID': GlobalConfiguration.configuration.igdbClientId,
        },
      })
    );

    return result.data;
  }

  private async refreshToken() {
    if (
      this.tokenAcquiredAt?.getTime() + this.token?.expires_in * 1000 >
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

  private token: Token;
  private tokenAcquiredAt: Date;
  private readonly requestQueue = new RequestQueue({
    timeBetweenRequests: 250,
  });

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

interface Game {
  id: number;
  age_ratings?: number[];
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
