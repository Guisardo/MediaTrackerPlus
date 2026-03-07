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
}
