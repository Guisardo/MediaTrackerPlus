/**
 * OpenLibrary Similar Items Client for the recommendations service.
 *
 * Fetches books related to a given work via subject-based search.
 * OpenLibrary has no dedicated similarity API; this client uses the first
 * subject of the source work to find other books in the same subject.
 *
 * All returned SimilarItem records have externalRating: null because
 * OpenLibrary provides no rating signal.
 *
 * The workId stored in the mediaItem table uses the full-path format
 * (e.g., /works/OL82563W). This client strips the "/works/" prefix before
 * constructing API requests.
 */

import axios, { AxiosInstance } from 'axios';

import { logger } from 'src/logger';
import { SimilarItem } from 'src/services/recommendations/types';

const OPENLIBRARY_BASE_URL = 'https://openlibrary.org';

/**
 * A single work entry returned in the /subjects/{subject}.json response's
 * `works` array.
 */
interface OpenLibrarySubjectWork {
  key: string;
  title: string;
}

/**
 * Response from GET /subjects/{subject}.json
 */
interface OpenLibrarySubjectResponse {
  name: string;
  works: OpenLibrarySubjectWork[];
  work_count: number;
}

/**
 * Response from GET /works/{id}.json
 * Only the fields relevant to this client are typed.
 */
interface OpenLibraryWorkDetailsResponse {
  key: string;
  title: string;
  subjects?: string[];
}

/**
 * Client that fetches books related to a given OpenLibrary work via
 * subject-based search.
 *
 * Responsibilities:
 * - Strip "/works/" prefix from the stored workId format
 * - Fetch work details (subjects) via GET /works/{strippedId}.json
 * - Use the first subject to search related books via GET /subjects/{subject}.json
 * - Return all items from the subject response's `works` array
 * - Always set externalRating to null (OpenLibrary has no rating data)
 * - Return [] and log WARN if the work has no subjects
 *
 * The axios instance is injected at construction time for testability.
 * No authentication is required for OpenLibrary.
 */
export class OpenLibrarySimilarClient {
  private readonly axiosInstance: AxiosInstance;

  /**
   * @param axiosInstance - Optional axios instance for testing.
   *   Defaults to the global axios instance when omitted.
   */
  constructor(axiosInstance?: AxiosInstance) {
    this.axiosInstance = axiosInstance ?? axios;
  }

  /**
   * Fetch books related to the given OpenLibrary work ID via subject search.
   *
   * @param workId - The OpenLibrary work ID in full-path format (e.g., /works/OL82563W)
   *   or bare ID format (e.g., OL82563W). The "/works/" prefix is stripped automatically.
   * @returns Array of SimilarItem records with externalRating always null.
   *   Returns an empty array if the work has no subjects.
   */
  async fetchSimilar(workId: string): Promise<SimilarItem[]> {
    const strippedId = this.stripWorksPrefix(workId);

    const workDetails = await this.fetchWorkDetails(strippedId);

    if (!workDetails.subjects || workDetails.subjects.length === 0) {
      logger.warn(
        `OpenLibrarySimilarClient: work "${workId}" has no subjects — returning empty results`
      );
      return [];
    }

    const firstSubject = workDetails.subjects[0];
    const subjectWorks = await this.fetchSubjectWorks(firstSubject);

    return subjectWorks.map((work): SimilarItem => {
      // The key field uses full-path format (e.g., /works/OL82563W).
      // Use it directly as the externalId since that is what the mediaItem table stores.
      const externalId = work.key;

      return {
        externalId,
        mediaType: 'book',
        title: work.title,
        externalRating: null,
      };
    });
  }

  /**
   * Strip the "/works/" prefix from a workId stored in full-path format.
   *
   * Examples:
   *   "/works/OL82563W" → "OL82563W"
   *   "OL82563W"        → "OL82563W" (idempotent)
   */
  private stripWorksPrefix(workId: string): string {
    return workId.replace(/^\/works\//, '');
  }

  /**
   * Fetch work details including subjects from the OpenLibrary API.
   *
   * @param strippedId - The bare work ID without the "/works/" prefix.
   * @throws Error with HTTP status code on non-2xx responses.
   */
  private async fetchWorkDetails(
    strippedId: string
  ): Promise<OpenLibraryWorkDetailsResponse> {
    const endpointPath = `/works/${strippedId}.json`;
    const url = `${OPENLIBRARY_BASE_URL}${endpointPath}`;

    try {
      const response =
        await this.axiosInstance.get<OpenLibraryWorkDetailsResponse>(url);
      return response.data;
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number };
      };
      const status = axiosError?.response?.status;
      throw new Error(
        `OpenLibrary work details request failed with HTTP ${status ?? 'unknown'} for ${endpointPath}`
      );
    }
  }

  /**
   * Fetch books for the given subject from the OpenLibrary subjects API.
   *
   * @param subject - The subject name (e.g., "Science fiction", "Mystery").
   * @throws Error with HTTP status code on non-2xx responses.
   */
  private async fetchSubjectWorks(
    subject: string
  ): Promise<OpenLibrarySubjectWork[]> {
    // OpenLibrary subjects API expects the subject lowercased with spaces replaced by underscores.
    const normalizedSubject = subject.toLowerCase().replace(/\s+/g, '_');
    const endpointPath = `/subjects/${normalizedSubject}.json`;
    const url = `${OPENLIBRARY_BASE_URL}${endpointPath}`;

    try {
      const response =
        await this.axiosInstance.get<OpenLibrarySubjectResponse>(url);
      return response.data.works ?? [];
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { status?: number };
      };
      const status = axiosError?.response?.status;
      throw new Error(
        `OpenLibrary subjects request failed with HTTP ${status ?? 'unknown'} for ${endpointPath}`
      );
    }
  }
}
