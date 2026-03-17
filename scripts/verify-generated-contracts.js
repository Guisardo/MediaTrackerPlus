const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const openApiPath = path.join(rootDir, 'server', 'openapi.json');
const restApiEntryPath = path.join(rootDir, 'rest-api', 'index.ts');
const restApiContractsPath = path.join(
  rootDir,
  'rest-api',
  'generated',
  'data-contracts.ts'
);
const restApiClientPath = path.join(rootDir, 'rest-api', 'generated', 'http-client.ts');

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!fs.existsSync(openApiPath)) {
  fail(`Missing generated OpenAPI document: ${openApiPath}`);
}

if (!fs.existsSync(restApiEntryPath)) {
  fail(`Missing rest-api entrypoint: ${restApiEntryPath}`);
}

if (!fs.existsSync(restApiContractsPath)) {
  fail(`Missing generated rest-api contracts: ${restApiContractsPath}`);
}

if (!fs.existsSync(restApiClientPath)) {
  fail(`Missing generated rest-api http client: ${restApiClientPath}`);
}

const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const restApiEntry = fs.readFileSync(restApiEntryPath, 'utf8');
const restApiContracts = fs.readFileSync(restApiContractsPath, 'utf8');

const schemaHasProperty = (schema, propertyName) => {
  if (schema == null || typeof schema !== 'object') {
    return false;
  }

  if (
    schema.properties != null &&
    Object.prototype.hasOwnProperty.call(schema.properties, propertyName)
  ) {
    return true;
  }

  if (Array.isArray(schema.allOf)) {
    return schema.allOf.some((child) => schemaHasProperty(child, propertyName));
  }

  if (Array.isArray(schema.oneOf)) {
    return schema.oneOf.some((child) => schemaHasProperty(child, propertyName));
  }

  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((child) => schemaHasProperty(child, propertyName));
  }

  return false;
};

const paths = openApi.paths ?? {};
if (Object.keys(paths).length === 0) {
  fail('Generated OpenAPI document has no paths.');
}

const requiredPaths = ['/api/details/{mediaItemId}', '/api/items'];
for (const requiredPath of requiredPaths) {
  if (!(requiredPath in paths)) {
    fail(`Generated OpenAPI document is missing required path: ${requiredPath}`);
  }
}

const schemas = openApi.components?.schemas ?? {};

if (!schemaHasProperty(schemas.MediaItemDetailsResponse, 'metadataLanguage')) {
  fail(
    'Generated OpenAPI schema MediaItemDetailsResponse is missing metadataLanguage.'
  );
}

if (!schemaHasProperty(schemas.MediaItemItemsResponse, 'metadataLanguage')) {
  fail(
    'Generated OpenAPI schema MediaItemItemsResponse is missing metadataLanguage.'
  );
}

if (!restApiContracts.includes('metadataLanguage?: string | null;')) {
  fail('Generated rest-api client is missing metadataLanguage.');
}

const requiredEntryExports = [
  "export * from './generated/data-contracts';",
  "export * from './generated/http-client';",
  "export * from './generated/ItemsRoute';",
  "export * from './generated/StatisticsRoute';",
  'export class Api<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {',
  'items = new ItemsApi<SecurityDataType>(this);',
  'statistics = new StatisticsApi<SecurityDataType>(this);',
  'group = new GroupApi<SecurityDataType>(this);',
  'importTrakttv = new ImportTrakttvApi<SecurityDataType>(this);',
];

for (const requiredSnippet of requiredEntryExports) {
  if (!restApiEntry.includes(requiredSnippet)) {
    fail(`rest-api entrypoint is missing compatibility export: ${requiredSnippet}`);
  }
}

console.log('Generated contract verification passed.');
