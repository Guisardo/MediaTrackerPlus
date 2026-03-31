import { t } from '@lingui/macro';
import chalk from 'chalk';
import { nanoid } from 'nanoid';

import { Config } from 'src/config';
import { Database } from 'src/dbconfig';
import {
  AudibleCountryCode,
  Configuration,
  ServerLang,
  TmdbLang,
} from 'src/entity/configuration';
import { setupI18n } from 'src/i18n/i18n';
import { logger } from 'src/logger';
import { configurationRepository } from 'src/repository/globalSettings';
import { cleanupSoftDeletedGroups } from 'src/repository/groupCleanup';
import { sessionKeyRepository } from 'src/repository/sessionKey';
import { userRepository } from 'src/repository/user';
import { catchAndLogError } from 'src/utils';

export type BackgroundJobConfig = {
  serverLang: ServerLang;
  tmdbLang: TmdbLang;
  audibleLang: AudibleCountryCode;
  igdbClientId?: string;
  igdbClientSecret?: string;
  demo?: boolean;
};

const initializeBackgroundJobInfrastructure = async (): Promise<void> => {
  Config.migrate();
  Config.validate();
  logger.init();
  Database.init();
  await Database.runMigrations();
  await catchAndLogError(cleanupSoftDeletedGroups);
};

const logBackgroundJobEnvironment = (): void => {
  logger.info(
    `Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  logger.info(`Server time: ${new Date().toLocaleString()}`);
};

const buildDefaultConfiguration = (
  args: BackgroundJobConfig
): Configuration => ({
  enableRegistration: true,
  serverLang: args.serverLang || 'en',
  tmdbLang: args.tmdbLang || 'en',
  audibleLang: args.audibleLang || 'us',
  igdbClientId: args.igdbClientId,
  igdbClientSecret: args.igdbClientSecret,
});

const synchronizeConfiguration = async (
  args: BackgroundJobConfig
): Promise<Configuration> => {
  const fallbackConfiguration = buildDefaultConfiguration(args);
  const currentConfiguration = await configurationRepository.get();

  if (!currentConfiguration) {
    await configurationRepository.create(fallbackConfiguration);
  } else {
    await configurationRepository.update({
      serverLang: args.serverLang || currentConfiguration.serverLang,
      tmdbLang: args.tmdbLang || currentConfiguration.tmdbLang,
      audibleLang: args.audibleLang || currentConfiguration.audibleLang,
      igdbClientId: args.igdbClientId || currentConfiguration.igdbClientId,
      igdbClientSecret:
        args.igdbClientSecret || currentConfiguration.igdbClientSecret,
    });
  }

  return (await configurationRepository.get()) ?? fallbackConfiguration;
};

const enableDemoMode = async (): Promise<void> => {
  const demoUser = await userRepository.findOne({ name: 'demo' });

  if (!demoUser) {
    await userRepository.create({
      name: 'demo',
      password: 'demo',
      admin: false,
    });
  }

  await configurationRepository.update({
    enableRegistration: false,
  });

  logger.info(chalk.green.bold(t`DEMO mode enabled`));
};

export const initializeBackgroundJob = async (
  args: BackgroundJobConfig
): Promise<Configuration> => {
  await initializeBackgroundJobInfrastructure();
  logBackgroundJobEnvironment();

  const resolvedConfiguration = await synchronizeConfiguration(args);
  setupI18n(resolvedConfiguration.serverLang || args.serverLang || 'en');

  if (args.demo) {
    await enableDemoMode();
  }

  return (await configurationRepository.get()) ?? resolvedConfiguration;
};

export const ensureSessionKey = async (): Promise<string> => {
  let sessionKey = await sessionKeyRepository.findOne();

  if (!sessionKey) {
    sessionKey = {
      key: nanoid(1024),
      createdAt: new Date().getTime(),
    };

    await sessionKeyRepository.create(sessionKey);
  }

  return sessionKey.key;
};
