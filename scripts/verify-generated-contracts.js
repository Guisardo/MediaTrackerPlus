const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const openApiPath = path.join(rootDir, 'server', 'openapi.json');
const restApiPath = path.join(rootDir, 'rest-api', 'index.ts');

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

if (!fs.existsSync(openApiPath)) {
  fail(`Missing generated OpenAPI document: ${openApiPath}`);
}

if (!fs.existsSync(restApiPath)) {
  fail(`Missing generated rest-api client: ${restApiPath}`);
}

const openApi = JSON.parse(fs.readFileSync(openApiPath, 'utf8'));
const restApi = fs.readFileSync(restApiPath, 'utf8');

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

if (!restApi.includes('metadataLanguage?: string | null;')) {
  fail('Generated rest-api client is missing metadataLanguage.');
}

console.log('Generated contract verification passed.');
