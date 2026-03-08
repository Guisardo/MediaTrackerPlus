import { LogsController } from 'src/controllers/logs';
import { Database } from 'src/dbconfig';
import { LogEntry } from 'src/logger';
import { Data } from '__tests__/__utils__/data';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { NextFunction } from 'express';

/**
 * LogsController tests.
 *
 * The `add` handler (GET /api/logs) is admin-only.  It delegates to `getLogs`
 * from `src/logger/getLogs` which reads log files from the filesystem.
 *
 * Strategy:
 *  - Mock `src/logger/getLogs` so tests are hermetic (no real log files needed).
 *  - The `onlyForAdmin` middleware calls `res.status(401).send()` for non-admins.
 *    The standard `request` helper from `__utils__/request` does not mock
 *    `res.status()` (it only provides `send` and `sendStatus`).  We therefore
 *    use a local `requestWithStatus` helper that captures both the status code
 *    set via `res.status(code)` and the final `res.send()` call.
 *  - The admin-success path goes through `onlyForAdmin` → `next()` → the actual
 *    handler which calls `res.send(logs)`.  Our helper captures that correctly.
 *
 * Covers:
 *  - GET /api/logs as admin → HTTP 200 and an array
 *  - GET /api/logs as admin → returns the mocked log entries verbatim
 *  - GET /api/logs as non-admin → HTTP 401 (admin gate)
 *  - Empty logs array → responds with empty array, not an error
 *  - Response entries have the expected LogEntry shape (message, id, level, timestamp)
 *  - `count` query parameter is forwarded to getLogs
 *  - `from` query parameter is forwarded to getLogs
 *  - Level filter flags are forwarded to getLogs
 */

// ---------------------------------------------------------------------------
// Module mock for getLogs (filesystem dependency)
// ---------------------------------------------------------------------------

jest.mock('src/logger/getLogs', () => ({
  getLogs: jest.fn(),
}));

// Import the mocked module AFTER the jest.mock call so we get the mock instance.
import { getLogs } from 'src/logger/getLogs';
const getLogsMock = getLogs as jest.MockedFunction<typeof getLogs>;

// ---------------------------------------------------------------------------
// Local request helper that properly captures res.status(...).send(...)
// ---------------------------------------------------------------------------

/**
 * Invokes a multi-step express handler (handler array wrapped by
 * createExpressRoute) and returns the HTTP status code + response data.
 *
 * The standard `__utils__/request` helper does not mock `res.status()`, so
 * the admin-gate middleware (`onlyForAdmin`) would throw.  This helper adds a
 * chainable `status(code)` method that stores the code before the eventual
 * `send()` resolves the promise.
 */
const requestWithStatus = (
  handler: (
    req: Express.Request,
    res: Express.Response,
    next: NextFunction
  ) => void,
  args: {
    userId: number;
    requestQuery?: Record<string, unknown>;
  }
): Promise<{ statusCode: number; data?: unknown }> => {
  return new Promise((resolve, reject) => {
    let capturedStatus = 200;

    const res = {
      send: (data?: unknown) => resolve({ statusCode: capturedStatus, data }),
      sendStatus: (status: number) => resolve({ statusCode: status }),
      status(code: number) {
        capturedStatus = code;
        return this; // chainable
      },
    };

    handler(
      {
        user: args.userId,
        params: {},
        query: args.requestQuery ?? {},
        body: {},
      } as unknown as Express.Request,
      res as unknown as Express.Response,
      reject
    );
  });
};

// ---------------------------------------------------------------------------
// Sample log entries used across tests
// ---------------------------------------------------------------------------

const sampleLogs: LogEntry[] = [
  {
    message: 'Server started',
    id: 'abc-001',
    level: 'info',
    timestamp: '2023-06-15T10:00:00.000Z',
  },
  {
    message: 'Database migration complete',
    id: 'abc-002',
    level: 'info',
    timestamp: '2023-06-15T10:00:01.000Z',
  },
  {
    message: 'Failed to fetch metadata',
    id: 'abc-003',
    level: 'error',
    timestamp: '2023-06-15T10:05:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LogsController', () => {
  beforeAll(async () => {
    await runMigrations();

    await Database.knex('user').insert(Data.user);   // admin = true
    await Database.knex('user').insert(Data.user2);  // admin = false
  });

  afterAll(clearDatabase);

  beforeEach(() => {
    // Default: getLogs returns the sample entries
    getLogsMock.mockResolvedValue(sampleLogs);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Admin access
  // -------------------------------------------------------------------------

  describe('GET /api/logs – admin user', () => {
    test('returns HTTP 200 for an admin user', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id, // admin = true
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
    });

    test('returns an array in the response body', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(Array.isArray(res.data)).toBe(true);
    });

    test('returns the exact log entries provided by getLogs', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.data).toEqual(sampleLogs);
    });

    test('returns an empty array when getLogs resolves with an empty array', async () => {
      getLogsMock.mockResolvedValue([]);

      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Admin gate — non-admin user
  // -------------------------------------------------------------------------

  describe('GET /api/logs – non-admin user', () => {
    test('returns HTTP 401 for a non-admin user', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user2.id, // admin = false
        requestQuery: {},
      });

      expect(res.statusCode).toBe(401);
    });

    test('does not call getLogs when the user is not an admin', async () => {
      const logsController = new LogsController();

      await requestWithStatus(logsController.add, {
        userId: Data.user2.id,
        requestQuery: {},
      });

      expect(getLogsMock).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Response shape
  // -------------------------------------------------------------------------

  describe('response entry shape', () => {
    test('each entry has message, id, level, and timestamp fields', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const logs = res.data as LogEntry[];
      for (const entry of logs) {
        expect(typeof entry.message).toBe('string');
        expect(typeof entry.id).toBe('string');
        expect(typeof entry.level).toBe('string');
        expect(typeof entry.timestamp).toBe('string');
      }
    });

    test('id values are non-empty strings', async () => {
      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const logs = res.data as LogEntry[];
      for (const entry of logs) {
        expect(entry.id.length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Query parameter forwarding
  // -------------------------------------------------------------------------

  describe('query parameter forwarding to getLogs', () => {
    test('forwards the count parameter to getLogs', async () => {
      const logsController = new LogsController();

      await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: { count: 10 },
      });

      expect(getLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ count: 10 })
      );
    });

    test('forwards the from parameter to getLogs', async () => {
      const logsController = new LogsController();

      await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: { from: 'abc-002' },
      });

      expect(getLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'abc-002' })
      );
    });

    test('forwards level filter flags (error, warn, info, debug, http) to getLogs', async () => {
      const logsController = new LogsController();

      await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {
          error: true,
          warn: false,
          info: true,
          debug: false,
          http: true,
        },
      });

      expect(getLogsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          levels: expect.objectContaining({
            error: true,
            warn: false,
            info: true,
            debug: false,
            http: true,
          }),
        })
      );
    });

    test('calls getLogs exactly once per request', async () => {
      const logsController = new LogsController();

      await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      expect(getLogsMock).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Multiple log entries / ordering
  // -------------------------------------------------------------------------

  describe('multiple log entries', () => {
    test('returns all entries provided by getLogs without modification', async () => {
      const manyLogs: LogEntry[] = Array.from({ length: 50 }, (_, i) => ({
        message: `Log message ${i}`,
        id: `id-${i}`,
        level: i % 2 === 0 ? 'info' : 'error',
        timestamp: `2023-06-15T10:${String(i).padStart(2, '0')}:00.000Z`,
      }));

      getLogsMock.mockResolvedValue(manyLogs);

      const logsController = new LogsController();

      const res = await requestWithStatus(logsController.add, {
        userId: Data.user.id,
        requestQuery: {},
      });

      const logs = res.data as LogEntry[];
      expect(logs.length).toBe(50);
      expect(logs[0].id).toBe('id-0');
      expect(logs[49].id).toBe('id-49');
    });
  });
});
