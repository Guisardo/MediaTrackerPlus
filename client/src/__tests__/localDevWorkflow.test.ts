import fs from 'fs';
import path from 'path';

const CLIENT_ROOT = path.resolve(__dirname, '..', '..');
const WORKSPACE_ROOT = path.resolve(CLIENT_ROOT, '..');

const readWorkspaceFile = (...segments: string[]) =>
  fs.readFileSync(path.resolve(WORKSPACE_ROOT, ...segments), 'utf-8');

const readWorkspaceJson = <T>(filePath: string): T =>
  JSON.parse(readWorkspaceFile(filePath));

describe('local development workflow', () => {
  it('exposes a single root dev entrypoint', () => {
    const rootPackage = readWorkspaceJson<{ scripts: Record<string, string> }>(
      'package.json'
    );

    expect(rootPackage.scripts.dev).toBe('sh ./scripts/dev.sh');
    expect(rootPackage.scripts['dev:start']).toBeUndefined();
  });

  it('starts the Vite dev server on 0.0.0.0 while proxying the API to loopback', () => {
    const viteConfig = readWorkspaceFile('client', 'vite.config.ts');

    expect(viteConfig).toContain("host: '0.0.0.0'");
    expect(viteConfig).toContain("target: 'http://127.0.0.1:7481'");
  });

  it('waits for generated REST API artifacts before starting the client', () => {
    const devScript = readWorkspaceFile('scripts', 'dev.sh');

    expect(devScript).toContain('wait_for_file');
    expect(devScript).toContain('rest-api/index.js');
    expect(devScript).toContain('npm run dev --prefix server');
    expect(devScript).toContain('npm run dev --prefix client');
  });

  it('boots the server with an initial build before watch mode takes over', () => {
    const serverPackage = readWorkspaceJson<{ scripts: Record<string, string> }>(
      path.join('server', 'package.json')
    );
    const serverDevScript = readWorkspaceFile('server', 'scripts', 'dev.sh');

    expect(serverPackage.scripts.dev).toBe('sh ./scripts/dev.sh');
    expect(serverPackage.scripts['watch:start']).toContain('npm run dev:start');

    expect(serverDevScript).toContain('npm run lingui:compile');
    expect(serverDevScript).toContain('npm run build:routes');
    expect(serverDevScript).toContain('npm run build:server');
    expect(serverDevScript).toContain('npm run watch:start');
  });
});
