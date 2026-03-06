/**
 * IGDB Similar Games Client for the recommendations service.
 *
 * Fetches similar games via the two-step IGDB query pattern:
 *  Step 1: Retrieve similar_games IDs for a given game
 *  Step 2: Batch-fetch name, total_rating, total_rating_count for those IDs
 *
 * MUST use the shared RequestQueue instance from the IGDB metadata provider to
 * ensure the combined request rate never exceeds 4 req/sec (250ms spacing).
 *
 * OAuth2 client-credentials tokens are managed internally — the 60-second expiry
 * buffer ensures pre-emptive refresh before any call fails.
 */

import axios, { AxiosInstance } from 'axios';
import urljoin from 'url-join';

import { logger } from 'src/logger';
import { RequestQueue } from 'src/requestQueue';
import { SimilarItem } from 'src/services/recommendations/types';

const IGDB_API_BASE = 'https://api.igdb.com/v4/';
const IGDB_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

/** Minimum buffer (ms) before token expiry to trigger a proactive refresh. */
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

/**
 * Minimal representation of the Twitch/IGDB OAuth2 token response.
 */
interface IgdbOAuthToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Shape of a game returned by the IGDB API when requesting
 * similar_games, name, total_rating, and total_rating_count fields.
 */
interface IgdbGameSimilar {
  id: number;
  similar_games?: number[];
}

/**
 * Shape of a game returned by the IGDB API when requesting
 * name, total_rating, and total_rating_count detail fields.
 */
interface IgdbGameDetail {
  id: number;
  name: string;
  total_rating?: number;
  total_rating_count?: number;
}

/**
 * Dependencies required by IgdbSimilarClient, injected via constructor
 * for testability and to enforce use of the shared RequestQueue.
 *
 * @property requestQueue - The shared RequestQueue instance that ALL IGDB requests
 *   (metadata provider + similarity client) must flow through.
 * @property clientId - Twitch/IGDB client ID for OAuth2 and API headers.
 * @property clientSecret - Twitch/IGDB client secret for OAuth2 token acquisition.
 * @property axiosInstance - Optional axios instance override for testing.
 */
export interface IgdbSimilarClientDeps {
  requestQueue: RequestQueue;
  clientId: string;
  clientSecret: string;
  axiosInstance?: AxiosInstance;
}

/**
 * Client that fetches similar games from the IGDB API using the two-step
 * query pattern.
 *
 * Responsibilities:
 * - Step 1: POST /v4/games to retrieve similar_games IDs for a source game
 * - Step 2: POST /v4/games to batch-fetch details (name, total_rating,
 *   total_rating_count) for all similar game IDs in a single call
 * - Rate-limit all requests through the shared RequestQueue (250ms spacing)
 * - Manage OAuth2 tokens with 60-second expiry buffer for proactive refresh
 * - Normalize total_rating (0–100) to externalRating (0–10) by dividing by 10
 * - Validate externalRating is null or within [0.0, 10.0]
 */
export class IgdbSimilarClient {
  private readonly requestQueue: RequestQueue;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly axiosInstance: AxiosInstance;

  private token: IgdbOAuthToken | null = null;
  private tokenAcquiredAt: Date | null = null;

  constructor(deps: IgdbSimilarClientDeps) {
    this.requestQueue = deps.requestQueue;
    this.clientId = deps.clientId;
    this.clientSecret = deps.clientSecret;
    this.axiosInstance = deps.axiosInstance ?? axios;
  }

  /**
   * Fetch similar games from IGDB for a given game ID.
   *
   * Two-step process:
   *  1. Query the source game to get its similar_games ID array
   *  2. Batch-query all similar game IDs for name and rating details
   *
   * @param igdbId - The IGDB numeric game ID.
   * @returns Array of SimilarItem records. Empty when the source game has no
   *   similar_games or when all results fail validation.
   */
  async fetchSimilar(igdbId: number): Promise<SimilarItem[]> {
    // Step 1: Get the similar_games ID array from the source game
    const similarGameIds = await this.fetchSimilarGameIds(igdbId);

    if (similarGameIds.length === 0) {
      logger.debug(
        `IGDB: No similar games found for igdbId=${igdbId}`
      );
      return [];
    }

    // Step 2: Batch-fetch details for all similar game IDs
    const gameDetails = await this.fetchGameDetails(similarGameIds);

    return this.mapToSimilarItems(gameDetails);
  }

  /**
   * Step 1: Retrieve similar_games IDs for a given game.
   *
   * Posts to /v4/games with IGDB Apicalypse query syntax requesting
   * only the similar_games field.
   */
  private async fetchSimilarGameIds(igdbId: number): Promise<number[]> {
    const query = `fields similar_games; where id = ${igdbId};`;
    const results = await this.post<IgdbGameSimilar[]>('games', query);

    if (!results || results.length === 0) {
      return [];
    }

    return results[0].similar_games ?? [];
  }

  /**
   * Step 2: Batch-fetch name, total_rating, and total_rating_count for a
   * list of game IDs in a single POST request.
   *
   * Uses IGDB's `where id = (id1,id2,...);` syntax to retrieve all games at once,
   * avoiding per-ID calls and staying within rate limits.
   */
  private async fetchGameDetails(
    gameIds: number[]
  ): Promise<IgdbGameDetail[]> {
    const idList = gameIds.join(',');
    const query = `fields name,total_rating,total_rating_count; where id = (${idList});`;
    const results = await this.post<IgdbGameDetail[]>('games', query);

    return results ?? [];
  }

  /**
   * Map IGDB game detail responses to SimilarItem records.
   *
   * Normalizes total_rating from 0–100 scale to 0–10 scale.
   * Sets externalRating to null when total_rating is missing or zero.
   * Validates the normalized rating falls within [0.0, 10.0].
   */
  private mapToSimilarItems(games: IgdbGameDetail[]): SimilarItem[] {
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
          // Normalize from 0–100 to 0–10 scale
          externalRating = game.total_rating / 10;
        }

        // Validate the [0.0, 10.0] invariant
        if (
          externalRating !== null &&
          (externalRating < 0 || externalRating > 10)
        ) {
          externalRating = null;
        }

        return {
          externalId: String(game.id),
          mediaType: 'game',
          title: game.name,
          externalRating,
        };
      })
      .filter((item): item is SimilarItem => item !== null);
  }

  /**
   * Execute a POST request to the IGDB API, ensuring:
   *  1. OAuth token is valid (refreshed if within 60s of expiry)
   *  2. Request is throttled through the shared RequestQueue
   *
   * @param endpoint - The IGDB API endpoint path (e.g., 'games').
   * @param query - The Apicalypse query string body.
   * @returns Parsed response data from the IGDB API.
   */
  private async post<T>(endpoint: string, query: string): Promise<T> {
    await this.ensureValidToken();

    const url = urljoin(IGDB_API_BASE, endpoint);

    const result = await this.requestQueue.request(() =>
      this.axiosInstance.post<T>(url, query, {
        headers: {
          Authorization: `Bearer ${this.token!.access_token}`,
          'Client-ID': this.clientId,
        },
      })
    );

    return result.data;
  }

  /**
   * Ensure the OAuth2 token is present and not within 60 seconds of expiry.
   *
   * Check logic:
   *   expiresAt = tokenAcquiredAt.getTime() + token.expires_in * 1000
   *   needsRefresh = expiresAt - Date.now() < 60_000
   *
   * When a refresh is needed, the token acquisition request itself flows
   * through the shared RequestQueue to respect the 4 req/sec rate limit.
   */
  private async ensureValidToken(): Promise<void> {
    if (this.token && this.tokenAcquiredAt) {
      const expiresAt =
        this.tokenAcquiredAt.getTime() + this.token.expires_in * 1000;
      const needsRefresh = expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS;

      if (!needsRefresh) {
        return;
      }
    }

    await this.refreshToken();
  }

  /**
   * Acquire a new OAuth2 client-credentials token from the Twitch/IGDB
   * token endpoint.
   *
   * The token request is routed through the shared RequestQueue.
   */
  private async refreshToken(): Promise<void> {
    const result = await this.requestQueue.request(() =>
      this.axiosInstance.post(IGDB_TOKEN_URL, null, {
        params: {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
        },
      })
    );

    if (result.status === 200) {
      this.token = result.data as IgdbOAuthToken;
      this.tokenAcquiredAt = new Date();
    }
  }
}
