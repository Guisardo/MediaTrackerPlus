export type Seen = {
  id?: number;
  date?: number | null;
  mediaItemId: number;
  seasonId?: number | null;
  episodeId?: number | null;
  userId: number;
  duration?: number | null;
};

export const seenColumns = <const>[
  'date',
  'id',
  'mediaItemId',
  'seasonId',
  'episodeId',
  'userId',
  'duration',
];

export class SeenFilters {
  public static mediaItemSeenValue = (seen: Seen) => {
    return Boolean(!seen.episodeId);
  };

  public static episodeSeenValue = (seen: Seen) => {
    return Boolean(seen.episodeId);
  };
}
