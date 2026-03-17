import { promises as fs } from 'fs';
import path from 'path';
import { generateApi } from 'swagger-typescript-api';

const outputPath = path.resolve(process.cwd(), './../rest-api/generated/');

const fixGeneratedClassImportConflicts = async () => {
  const generatedFiles = await fs.readdir(outputPath);

  await Promise.all(
    generatedFiles
      .filter((fileName) => fileName.endsWith('.ts'))
      .map(async (fileName) => {
        const filePath = path.join(outputPath, fileName);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const classMatch = fileContent.match(/export class (\w+)</);
        const dataContractsImportMatch = fileContent.match(
          /import \{([^}]+)\} from '\.\/data-contracts';/
        );

        if (classMatch == null || dataContractsImportMatch == null) {
          return;
        }

        const className = classMatch[1];
        const importedNames = dataContractsImportMatch[1]
          .split(',')
          .map((name) => name.trim());

        if (!importedNames.includes(className)) {
          return;
        }

        const aliasName = `${className}Model`;
        const updatedImport = `import { ${importedNames
          .map((name) => (name === className ? `${className} as ${aliasName}` : name))
          .join(', ')} } from './data-contracts';`;

        const updatedFileContent = fileContent
          .replace(dataContractsImportMatch[0], updatedImport)
          .replace(
            new RegExp(
              `this\\.http\\.request<${className}(?=(?:\\[\\])?\\s*,)`,
              'g'
            ),
            `this.http.request<${aliasName}`
          );

        if (updatedFileContent !== fileContent) {
          await fs.writeFile(filePath, updatedFileContent);
        }
      })
  );
};

const run = async () => {
  await generateApi({
    output: outputPath,
    input: path.resolve(process.cwd(), './openapi.json'),
    httpClientType: 'fetch',
    defaultResponseAsSuccess: true,
    generateRouteTypes: true,
    unwrapResponseData: true,
    cleanOutput: true,
    enumNamesAsValues: false,
    moduleNameIndex: 1,
    generateUnionEnums: true,
    modular: true,
    singleHttpClient: true,
  });

  await fixGeneratedClassImportConflicts();
};

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
