import * as fs from 'fs';
import * as path from 'path';
import { typescriptRoutesToOpenApi } from 'typescript-routes-to-openapi';
import { version } from '../package.json';

typescriptRoutesToOpenApi({
  tsConfigPath: './tsconfig.app.json',
  openapi: {
    info: {
      title: 'MediaTracker',
      version: version,
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    components: {
      securitySchemes: {
        ApiKey: {
          type: 'apiKey',
          in: 'query',
          name: 'token',
        },
        ApiHeader: {
          type: 'apiKey',
          in: 'header',
          name: 'Access-Token',
        },
      },
    },
    security: [
      {
        ApiKey: [],
      },
      {
        ApiHeader: [],
      },
    ],
  },
  routesOutputDir: './src/generated/routes',
  checkProgramForErrors: false,
});

// The third-party generator template uses `unknown && ajv.compile(unknown)` which TypeScript strict
// mode cannot narrow to a callable type, causing TS2349/TS2339 errors. Prepend @ts-nocheck to the
// generated file to suppress these errors without modifying the generator internals.
const routesFilePath = path.resolve(__dirname, '../src/generated/routes/routes.ts');
const routesContent = fs.readFileSync(routesFilePath, 'utf-8');
if (!routesContent.startsWith('// @ts-nocheck')) {
  fs.writeFileSync(routesFilePath, `// @ts-nocheck\n${routesContent}`);
}
