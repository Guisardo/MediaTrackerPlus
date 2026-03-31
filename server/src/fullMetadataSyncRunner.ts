import 'source-map-support/register';

import { initializeBackgroundJob } from 'src/backgroundJob';
import { Config } from 'src/config';
import { Database } from 'src/dbconfig';
import { runFullMetadataSync } from 'src/fullMetadataSync';

const main = async () => {
  await initializeBackgroundJob({
    serverLang: Config.SERVER_LANG,
    tmdbLang: Config.TMDB_LANG,
    audibleLang: Config.AUDIBLE_LANG,
    igdbClientId: Config.IGDB_CLIENT_ID,
    igdbClientSecret: Config.IGDB_CLIENT_SECRET,
    demo: Config.DEMO,
  });

  await runFullMetadataSync();
};

void main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.stack ?? error.message : String(error)
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      if (Database.knex) {
        await Database.knex.destroy();
      }
    } catch (error) {
      console.error(
        error instanceof Error ? error.stack ?? error.message : String(error)
      );
      process.exitCode = 1;
    }
  });
