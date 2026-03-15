import { NextFunction, Request, Response } from 'express';

jest.mock('src/logger', () => ({
  logger: {
    debug: jest.fn(),
  },
}));

describe('requestDebugMiddleware', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('logs sanitized request metadata in development', async () => {
    jest.doMock('src/config', () => ({
      Config: {
        NODE_ENV: 'development',
      },
    }));

    const { requestDebugMiddleware } = await import(
      'src/middlewares/requestDebugMiddleware'
    );
    const { logger } = await import('src/logger');

    const next: NextFunction = jest.fn();
    const req = {
      method: 'POST',
      url: '/api/user/login',
      body: {
        username: 'demo',
        password: 'super-secret',
      },
      params: {
        groupId: '12',
      },
      query: {
        include: 'members',
      },
    } as unknown as Request;

    requestDebugMiddleware(req, {} as Response, next);

    expect(logger.debug).toHaveBeenCalledWith(
      'request POST /api/user/login',
      {
        body: {
          username: 'demo',
          password: '[redacted]',
        },
        params: {
          groupId: '12',
        },
        query: {
          include: 'members',
        },
      }
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips request debug logging outside development', async () => {
    jest.doMock('src/config', () => ({
      Config: {
        NODE_ENV: 'production',
      },
    }));

    const { requestDebugMiddleware } = await import(
      'src/middlewares/requestDebugMiddleware'
    );
    const { logger } = await import('src/logger');

    const next: NextFunction = jest.fn();
    const req = {
      method: 'GET',
      url: '/api/items',
      body: {},
      params: {},
      query: {},
    } as unknown as Request;

    requestDebugMiddleware(req, {} as Response, next);

    expect(logger.debug).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
