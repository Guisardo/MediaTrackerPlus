/**
 * TMDB Similar Items Client for the recommendations service.
 *
 * Fetches similar movies and TV shows from the TMDB /similar endpoints.
 * The API key is injected at construction time — reuse the same key constant
 * from server/src/metadata/provider/tmdb.ts at the call site.
 */

import axios, { AxiosInstance } from 'axios';

import { logger } from 'src/logger';
import { SimilarItem } from 'src/services/recommendations/types';

const TMDB_BASE_URL = 'https://api.themoviedb.org';

/** Minimum vote count required to include an item in results. */
const MINIMUM_VOTE_COUNT = 10;

/**
 * Represents a single item in the TMDB /similar results array.
 * Both movie and TV endpoints share these fields.
 */
interface TmdbSimilarResultItem {
  id: number;
  title?: string; // movie
  name?: string; // tv show
  vote_average: number;
  vote_count: number;
}

/**
 * Response envelope returned by the TMDB /similar endpoints.
 */
interface TmdbSimilarResponse {
  page: number;
  results: TmdbSimilarResultItem[];
  total_pages: number;
  total_results: number;
}

/**
 * Client that fetches similar movies and TV shows from TMDB.
 *
 * Responsibilities:
 * - Call GET /3/movie/{id}/similar for movies
 * - Call GET /3/tv/{id}/similar for TV shows
 * - Apply vote_count filter (minimum 10) to remove low-data items
 * - Coerce vote_average === 0 to null (unreleased / no-data sentinel)
 * - Validate externalRating is null or in [0.0, 10.0]
 * - Handle HTTP 429 (rate-limit) by logging Retry-After and returning []
 * - Throw on any other non-2xx response with status code and path
 *
 * The API key and axios instance are injected at construction time for
 * testability and to avoid duplicating credentials across modules.
 */
export class TmdbSimilarClient {
  private readonly apiKey: string;
  private readonly axiosInstance: AxiosInstance;

  /**
   * @param apiKey - The TMDB API key. Pass the constant from
   *   server/src/metadata/provider/tmdb.ts at the call site.
   * @param axiosInstance - Optional axios instance for testing.
   *   Defaults to the global axios instance when omitted.
   */
  constructor(apiKey: string, axiosInstance?: AxiosInstance) {
    this.apiKey = apiKey;
    this.axiosInstance = axiosInstance ?? axios;
  }

  /**
   * Fetch similar items from TMDB for a given ID and media type.
   *
   * @param tmdbId - The TMDB numeric ID of the source media item.
   * @param mediaType - Either 'movie' or 'tv'.
   * @returns Array of SimilarItem records. May be empty when rate-limited or
   *          when all results are filtered out.
   * @throws Error with HTTP status code and endpoint path on non-2xx, non-429 responses.
   */
  async fetchSimilar(
    tmdbId: number,
    mediaType: 'movie' | 'tv'
  ): Promise<SimilarItem[]> {
    const endpointPath = `/3/${mediaType}/${tmdbId}/similar`;
    const url = `${TMDB_BASE_URL}${endpointPath}`;

    let response: { data: TmdbSimilarResponse; status: number };

    try {
      response = await this.axiosInstance.get<TmdbSimilarResponse>(url, {
        params: {
          api_key: this.apiKey,
        },
      });
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number; headers?: Record<string, string> };
      };

      const status = axiosError?.response?.status;

      if (status === 429) {
        const retryAfter = axiosError?.response?.headers?.['retry-after'];
        logger.warn(
          `TMDB rate limit hit on ${endpointPath}. Retry-After: ${retryAfter ?? 'unknown'}`
        );
        return [];
      }

      throw new Error(
        `TMDB API request failed with HTTP ${status ?? 'unknown'} for ${endpointPath}`
      );
    }

    const items = response.data.results;

    return items
      .filter((item) => item.vote_count >= MINIMUM_VOTE_COUNT)
      .map((item): SimilarItem | null => {
        const title = mediaType === 'movie' ? item.title : item.name;

        if (!title) {
          return null;
        }

        let externalRating: number | null = item.vote_average;

        // Coerce vote_average === 0 to null: unreleased or no-data items that
        // slipped through the vote_count filter should not appear to have a
        // zero rating.
        if (externalRating === 0) {
          externalRating = null;
        }

        // Validate that the rating is within the documented [0.0, 10.0] invariant.
        if (
          externalRating !== null &&
          (externalRating < 0 || externalRating > 10)
        ) {
          externalRating = null;
        }

        return {
          externalId: String(item.id),
          mediaType,
          title,
          externalRating,
        };
      })
      .filter((item): item is SimilarItem => item !== null);
  }
}
