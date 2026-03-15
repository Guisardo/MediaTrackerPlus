jest.mock('src/config', () => ({
  Config: {
    NODE_ENV: 'development',
  },
}));

jest.mock('src/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from 'src/logger';
import {
  applyMethodDecorator,
  summarizeForLog,
  traceMethod,
} from 'src/logger/tracing';

describe('logger tracing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('redacts sensitive values when summarizing metadata', () => {
    expect(
      summarizeForLog({
        password: 'secret',
        nested: {
          authorization: 'Bearer token',
        },
      })
    ).toEqual({
      password: '[redacted]',
      nested: {
        authorization: '[redacted]',
      },
    });
  });

  it('logs repository method start and completion in development', async () => {
    class ExampleRepository {
      public readonly tableName = 'mediaItem';

      async find(where: { token: string; title: string }) {
        return {
          ok: true,
          where,
        };
      }
    }

    applyMethodDecorator(ExampleRepository.prototype, 'find', traceMethod());

    const repository = new ExampleRepository();

    await repository.find({
      token: 'super-secret',
      title: 'A Very Long Title That Should Still Be Logged Safely',
    });

    expect(logger.debug).toHaveBeenNthCalledWith(
      1,
      'repository:mediaItem.find started',
      expect.objectContaining({
        args: {
          type: 'array',
          length: 1,
          sample: [
            {
              token: '[redacted]',
              title: 'A Very Long Title That Should Still Be Logged Safely',
            },
          ],
        },
      })
    );

    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      'repository:mediaItem.find completed',
      expect.objectContaining({
        trace: 'repository:mediaItem.find',
      })
    );
  });

  it('logs failures and rethrows the original error', async () => {
    class ExampleRepository {
      public readonly tableName = 'user';

      async create() {
        throw new Error('boom');
      }
    }

    applyMethodDecorator(ExampleRepository.prototype, 'create', traceMethod());

    const repository = new ExampleRepository();

    await expect(repository.create()).rejects.toThrow('boom');

    expect(logger.error).toHaveBeenCalledWith(
      'repository:user.create failed',
      expect.objectContaining({
        err: expect.any(Error),
        trace: 'repository:user.create',
      })
    );
  });
});
