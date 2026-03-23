import _ from 'lodash';
import { NotificationPlatformsCredentialsType } from 'src/notifications/notifications';

export type User = {
  id: number;
  name: string;
  password: string;
  admin?: boolean;
  publicReviews?: boolean;
  sendNotificationWhenStatusChanges?: boolean;
  sendNotificationWhenReleaseDateChanges?: boolean;
  sendNotificationWhenNumberOfSeasonsChanges?: boolean;
  sendNotificationForReleases?: boolean;
  sendNotificationForEpisodesReleases?: boolean;
  notificationPlatform?: keyof NotificationPlatformsCredentialsType;
  hideOverviewForUnseenSeasons?: boolean;
  hideEpisodeTitleForUnseenEpisodes?: boolean;
  addRecommendedToWatchlist?: boolean;
  /**
   * Date of birth stored as a YYYY-MM-DD string. Self-only: never included in
   * public user projections.
   */
  dateOfBirth?: string | null;
};

/**
 * Columns returned for any user query that does NOT require the password or
 * the self-only `dateOfBirth` field (e.g. public search, getById).
 */
export const userNonSensitiveColumns = <const>[
  'id',
  'name',
  'admin',
  'publicReviews',
  'sendNotificationWhenStatusChanges',
  'sendNotificationWhenReleaseDateChanges',
  'sendNotificationWhenNumberOfSeasonsChanges',
  'sendNotificationForReleases',
  'sendNotificationForEpisodesReleases',
  'notificationPlatform',
  'hideOverviewForUnseenSeasons',
  'hideEpisodeTitleForUnseenEpisodes',
  'addRecommendedToWatchlist',
];

/**
 * Columns returned exclusively for the authenticated user's own profile.
 * Extends `userNonSensitiveColumns` with `dateOfBirth`, which must never
 * appear in public or other-user projections.
 */
export const userSelfColumns = <const>[
  ...userNonSensitiveColumns,
  'dateOfBirth',
];

export const userColumns = <const>[...userSelfColumns, 'password'];
