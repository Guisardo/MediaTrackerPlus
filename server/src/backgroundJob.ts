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

export const initializeBackgroundJob = async (
  args: BackgroundJobConfig
): Promise<Configuration> => {
  const {
    serverLang,
    tmdbLang,
    audibleLang,
    igdbClientId,
    igdbClientSecret,
    demo,
  } = args;

  Config.migrate();
  Config.validate();
  logger.init();
  Database.init();
  await Database.runMigrations();
  await catchAndLogError(cleanupSoftDeletedGroups);

  logger.info(
    `Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  );
  logger.info(`Server time: ${new Date().toLocaleString()}`);

  let configuration = await configurationRepository.get();

  if (!configuration) {
    await configurationRepository.create({
      enableRegistration: true,
      serverLang: serverLang || 'en',
      tmdbLang: tmdbLang || 'en',
      audibleLang: audibleLang || 'us',
      igdbClientId: igdbClientId,
      igdbClientSecret: igdbClientSecret,
    });
  } else {
    await configurationRepository.update({
      serverLang: serverLang || configuration.serverLang,
      tmdbLang: tmdbLang || configuration.tmdbLang,
      audibleLang: audibleLang || configuration.audibleLang,
      igdbClientId: igdbClientId || configuration.igdbClientId,
      igdbClientSecret: igdbClientSecret || configuration.igdbClientSecret,
    });
  }

  configuration = await configurationRepository.get();
  const resolvedConfiguration = configuration ?? {
    enableRegistration: true,
    serverLang: serverLang || 'en',
    tmdbLang: tmdbLang || 'en',
    audibleLang: audibleLang || 'us',
    igdbClientId: igdbClientId,
    igdbClientSecret: igdbClientSecret,
  };

  setupI18n(resolvedConfiguration.serverLang || serverLang || 'en');

  if (demo) {
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
