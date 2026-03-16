import _ from 'lodash';

import {
  ExternalIds,
  MediaItemForProvider,
  MediaType,
} from 'src/entity/mediaItem';
import { SimilarItem } from 'src/metadata/types';

export abstract class MetadataProvider<Name extends string = string> {
  public abstract readonly name: Name;
  public abstract readonly mediaType: MediaType;

  /**
   * Search for media
   * @param query
   */
  public abstract search(query: string): Promise<MediaItemForProvider[]>;

  /**
   * Get details for media.
   * @param mediaItem MediaItem
   */
  abstract details(ids: ExternalIds): Promise<MediaItemForProvider>;

  /**
   * Fetch similar items for the given external IDs.
   * Returns an empty array when no similar items are available or the
   * external ID is missing. Optional — providers that have no similarity
   * API omit this method.
   * @param ids ExternalIds
   */
  similar?(ids: ExternalIds): Promise<SimilarItem[]>;

  /**
   * Fetch localized metadata for a specific language.
   * Returns a MediaItemForProvider with localized title, overview, and genres.
   * Does NOT set originalTitle — that remains the responsibility of details().
   * Optional — providers that do not support localized metadata omit this method.
   * @param ids ExternalIds
   * @param language BCP 47 language tag (e.g., 'en', 'es', 'pt-BR')
   */
  localizedDetails?(
    ids: ExternalIds,
    language: string
  ): Promise<MediaItemForProvider | null | undefined>;

  /**
   * Fetch all regional game localizations in a single API call.
   * Returns an array of localization entries with a regionId and localized name.
   * Used for providers (e.g., IGDB) that expose regional title variants via a
   * dedicated endpoint rather than per-language detail fetches.
   * Optional — only implemented by providers that have a localization endpoint.
   * @param ids ExternalIds
   */
  fetchGameLocalizations?(
    ids: ExternalIds
  ): Promise<Array<{ regionId: number; name: string }>>;
}
