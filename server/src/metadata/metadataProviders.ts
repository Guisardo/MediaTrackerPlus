import { MediaItemBase, MediaItemForProvider, MediaType } from 'src/entity/mediaItem';
import { Audible } from 'src/metadata/provider/audible';
import { IGDB } from 'src/metadata/provider/igdb';
import { OpenLibrary } from 'src/metadata/provider/openlibrary';
import { TMDbMovie, TMDbTv } from 'src/metadata/provider/tmdb';
import _ from 'lodash';
import { MetadataProvider, MetadataTrailer } from 'src/metadata/metadataProvider';
import { SimilarItem } from 'src/metadata/types';

const providers = <const>[
  new IGDB(),
  new Audible(),
  new OpenLibrary(),
  new TMDbMovie(),
  new TMDbTv(),
];

class MetadataProviders {
  private readonly metadataProviders = new Map(
    _(providers)
      .groupBy((provider) => provider.mediaType)
      .mapValues(
        (value) => new Map(_.entries(_.keyBy(value, (value) => value.name)))
      )
      .entries()
      .value()
  );

  public has(mediaType: MediaType): boolean {
    return this.metadataProviders.has(mediaType);
  }

  public get(mediaType: MediaType, name?: string): MetadataProvider {
    return name
      ? this.metadataProviders.get(mediaType)?.get(name)
      : this.metadataProviders.get(mediaType)?.values().next().value;
  }

  public details(
    mediaItem: MediaItemForProvider
  ): Promise<MediaItemForProvider> | null {
    return this.get(mediaItem.mediaType, mediaItem.source)?.details(mediaItem);
  }

  public similar(mediaItem: MediaItemBase): Promise<SimilarItem[]> | null {
    const provider = this.get(mediaItem.mediaType, mediaItem.source);
    return provider?.similar ? provider.similar(mediaItem) : null;
  }

  public trailers(
    mediaItem: MediaItemBase,
    language: string
  ): Promise<MetadataTrailer[]> | null {
    const provider = this.get(mediaItem.mediaType, mediaItem.source);
    return provider?.trailers ? provider.trailers(mediaItem, language) : null;
  }
}

export const metadataProviders = new MetadataProviders();
