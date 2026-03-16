import { UserRating } from 'src/entity/userRating';
import {
  definedOrNull,
  repository,
} from 'src/repository/repository';

export const userRatingRepository = new (repository<UserRating>({
  tableName: 'userRating',
  primaryColumnName: 'id',
  uniqueBy: (value) => ({
    mediaItemId: value.mediaItemId,
    episodeId: definedOrNull(value.episodeId),
    seasonId: definedOrNull(value.seasonId),
    userId: value.userId,
  }),
}))();
