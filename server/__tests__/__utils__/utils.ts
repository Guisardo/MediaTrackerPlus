import { customAlphabet } from 'nanoid';
import { Database } from 'src/dbconfig';

export const randomNumericId = () => Number(customAlphabet('123456789', 7)());

export const clearDatabase = async () => {
  await Database.knex.schema
    .dropTableIfExists('groupPlatformRating')
    .dropTableIfExists('userGroupMember')
    .dropTableIfExists('userGroup')
    .dropTableIfExists('listItem')
    .dropTableIfExists('list')
    .dropTableIfExists('image')
    .dropTableIfExists('sessionKey')
    .dropTableIfExists('configuration')
    .dropTableIfExists('notificationPlatformsCredentials')
    .dropTableIfExists('notificationsHistory')
    .dropTableIfExists('metadataProviderCredentials')
    .dropTableIfExists('accessToken')
    .dropTableIfExists('session')
    .dropTableIfExists('userRating')
    .dropTableIfExists('watchlist')
    .dropTableIfExists('progress')
    .dropTableIfExists('seen')
    .dropTableIfExists('user')
    .dropTableIfExists('episodeTranslation')
    .dropTableIfExists('episode')
    .dropTableIfExists('seasonTranslation')
    .dropTableIfExists('season')
    .dropTableIfExists('mediaItemTranslation')
    .dropTableIfExists('mediaItem')
    .dropTableIfExists('knex_migrations');

  await Database.knex.destroy();
};

export const runMigrations = async () => {
  Database.init();
  await Database.runMigrations(false);
};
