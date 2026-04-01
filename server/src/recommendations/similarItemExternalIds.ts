import { ExternalIds } from 'src/entity/mediaItem';
import { SimilarItem } from 'src/metadata/types';

export const similarItemToExternalIds = (item: SimilarItem): ExternalIds => {
  switch (item.mediaType) {
    case 'movie':
    case 'tv':
      return { tmdbId: Number(item.externalId) };
    case 'video_game':
      return { igdbId: Number(item.externalId) };
    case 'book':
      return { openlibraryId: item.externalId };
  }
};
