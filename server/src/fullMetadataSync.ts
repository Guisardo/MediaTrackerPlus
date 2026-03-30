import { MediaItemBaseWithSeasons } from 'src/entity/mediaItem';
import { logger } from 'src/logger';
import { metadataProviders } from 'src/metadata/metadataProviders';
import { mediaItemRepository } from 'src/repository/mediaItem';
import { runLockedMetadataUpdate } from 'src/updateMetadata';

export const getFullMetadataSyncCandidates = async (): Promise<
  MediaItemBaseWithSeasons[]
> => {
  const mediaItems = await mediaItemRepository.find();

  return mediaItems.filter(
    (mediaItem) =>
      metadataProviders.get(mediaItem.mediaType, mediaItem.source) != null
  );
};

export const runFullMetadataSync = async (): Promise<void> => {
  await runLockedMetadataUpdate({
    forceUpdate: true,
    selectMediaItems: async () => {
      const mediaItems = await getFullMetadataSyncCandidates();

      logger.info(`Selected ${mediaItems.length} items for full metadata sync`);

      return mediaItems;
    },
  });
};
