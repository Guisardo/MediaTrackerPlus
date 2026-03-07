/**
 * Shared type definitions for the recommendations service module.
 * All providers (TMDB, IGDB, OpenLibrary) and WatchlistWriter operate on this common contract.
 */

/**
 * Represents a media item similar to a given source media.
 *
 * This interface is used across all similarity providers to ensure a consistent
 * data contract regardless of the underlying API (TMDB, IGDB, OpenLibrary).
 *
 * @property externalId - The unique identifier in the external API (e.g., TMDB ID for movies)
 * @property mediaType - The type of media: 'movie', 'tv', 'video_game', or 'book'
 * @property title - The human-readable title or name of the media item
 * @property externalRating - The rating/score from the external API, or null if unavailable.
 *                            MUST be null or within the range [0.0, 10.0].
 *                            Each provider is responsible for enforcing this invariant before returning.
 *                            Examples:
 *                            - TMDB: vote_average is 0-10, null if no votes
 *                            - IGDB: total_rating is 0-100 (normalized by dividing by 10 to [0-10])
 *                            - OpenLibrary: always null (no rating data)
 */
export interface SimilarItem {
  externalId: string;
  mediaType: 'movie' | 'tv' | 'video_game' | 'book';
  title: string;
  externalRating: number | null;
}
