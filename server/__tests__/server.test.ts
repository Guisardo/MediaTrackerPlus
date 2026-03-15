import { EventEmitter } from 'events';
import http from 'http';
import { Server } from 'src/server';

describe('createServer', () => {
  test('passing empty session key should throw exception', () => {
    expect(
      () =>
        new Server({
          hostname: '127.0.0.1',
          port: 1234,
          assetsPath: '.',
          publicPath: '.',
          sessionKey: '',
          production: false,
        })
    ).toThrow(/sessionKey/);
  });

  test('createServer', async () => {
    const server = new Server({
      hostname: '127.0.0.1',
      port: 1234,
      assetsPath: '.',
      publicPath: '.',
      sessionKey: 'sessionKey',
      production: false,
    });

    await expect(async () => server.listen()).rejects.toThrow();

    const app = server.create();
    const mockHttpServer = new EventEmitter() as http.Server;

    mockHttpServer.close = ((callback?: (error?: Error) => void) => {
      callback?.();
      return mockHttpServer;
    }) as http.Server['close'];

    jest.spyOn(app, 'listen').mockImplementation(
      (
        _port: number,
        _hostname: string,
        listeningListener?: () => void
      ) => {
        process.nextTick(() => listeningListener?.());
        return mockHttpServer;
      }
    );

    await server.listen();
    await server.close();
  });
});
