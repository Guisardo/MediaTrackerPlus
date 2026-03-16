export type Progress = {
  id?: number;
  date: number;
  mediaItemId: number;
  episodeId?: number | null;
  userId: number;
  progress?: number | null;
  duration?: number;
  action?: 'playing' | 'paused';
  device?: string;
};

export const progressColumns = <const>[
  'id',
  'date',
  'mediaItemId',
  'episodeId',
  'userId',
  'duration',
  'progress',
  'action',
  'device',
];
