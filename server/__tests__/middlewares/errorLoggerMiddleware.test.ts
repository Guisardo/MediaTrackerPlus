import { Request, Response, NextFunction } from 'express';
import { ValidationError } from 'typescript-routes-to-openapi-server';
import { errorLoggerMiddleware } from 'src/middlewares/errorLoggerMiddleware';
import { logger } from 'src/logger';

jest.mock('src/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    http: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

/**
 * Builds a minimal Express Request mock with the properties used by
 * errorLoggerMiddleware (method, url, body).
 */
function buildMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    url: '/api/test',
    body: { field: 'value' },
    ...overrides,
  } as unknown as Request;
}

/**
 * Builds a minimal Express Response mock that tracks status / send calls and
 * chains correctly (res.status(...).send(...)).
 */
function buildMockResponse(): Response & {
  _status: number | undefined;
  _body: unknown;
} {
  const res = {
    _status: undefined as number | undefined,
    _body: undefined as unknown,
    status(this: any, code: number) {
      this._status = code;
      return this;
    },
    send(this: any, body: unknown) {
      this._body = body;
      return this;
    },
  } as unknown as Response & { _status: number | undefined; _body: unknown };
  return res;
}

describe('errorLoggerMiddleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // ValidationError branch
  // ---------------------------------------------------------------------------

  describe('when the error is a ValidationError', () => {
    const validationError = new ValidationError([], 'field is required');
    const req = buildMockRequest({
      method: 'PUT',
      url: '/api/items',
      body: { broken: true },
    });

    test('responds with HTTP 400', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(validationError, req, res as Response, next);

      expect(res._status).toBe(400);
    });

    test('response body is the string representation of the error', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(validationError, req, res as Response, next);

      expect(res._body).toBe(String(validationError));
    });

    test('calls logger.error with a validationError type entry', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(validationError, req, res as Response, next);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);

      const logArg = (mockLogger.error as jest.Mock).mock.calls[0][0];

      expect(logArg).toMatchObject({
        message: 'ValidationError',
        error: validationError.message,
        body: req.body,
        method: req.method,
        url: req.url,
        type: 'validationError',
      });
    });

    test('does not call logger.error with a stack property for ValidationError', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(validationError, req, res as Response, next);

      const logArg = (mockLogger.error as jest.Mock).mock.calls[0][0];

      // ValidationError path logs structured fields, not a raw stack
      expect(logArg).not.toHaveProperty('stack');
    });

    test('does not call next()', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(validationError, req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Generic Error branch
  // ---------------------------------------------------------------------------

  describe('when the error is a generic Error', () => {
    const genericError = new Error('Something went wrong');
    genericError.stack = 'Error: Something went wrong\n    at Object.<anonymous>';
    const req = buildMockRequest({ method: 'GET', url: '/api/data' });

    test('responds with HTTP 500', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      expect(res._status).toBe(500);
    });

    test('response body is the string representation of the error', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      expect(res._body).toBe(String(genericError));
    });

    test('calls logger.error exactly once', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    test('calls logger.error with message and stack', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      const logArg = (mockLogger.error as jest.Mock).mock.calls[0][0];

      expect(logArg).toMatchObject({
        message: genericError.message,
        stack: genericError.stack,
      });
    });

    test('does not include type: validationError in generic error log', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      const logArg = (mockLogger.error as jest.Mock).mock.calls[0][0];

      expect(logArg.type).toBeUndefined();
    });

    test('does not call next()', () => {
      const res = buildMockResponse();

      errorLoggerMiddleware(genericError, req, res as Response, next);

      expect(next).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Non-Error objects thrown (duck-typed errors)
  // ---------------------------------------------------------------------------

  describe('when the thrown value is not a ValidationError instance', () => {
    test('a TypeError uses the generic 500 path', () => {
      const typeError = new TypeError('Cannot read property foo of undefined');
      const req = buildMockRequest();
      const res = buildMockResponse();

      errorLoggerMiddleware(typeError, req, res as Response, next);

      expect(res._status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    test('a RangeError uses the generic 500 path', () => {
      const rangeError = new RangeError('Invalid array length');
      const req = buildMockRequest();
      const res = buildMockResponse();

      errorLoggerMiddleware(rangeError, req, res as Response, next);

      expect(res._status).toBe(500);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Response body shape
  // ---------------------------------------------------------------------------

  describe('response body shape', () => {
    test('ValidationError body is a non-empty string', () => {
      const err = new ValidationError([], 'bad input');
      const req = buildMockRequest();
      const res = buildMockResponse();

      errorLoggerMiddleware(err, req, res as Response, next);

      expect(typeof res._body).toBe('string');
      expect((res._body as string).length).toBeGreaterThan(0);
    });

    test('generic Error body is a non-empty string', () => {
      const err = new Error('internal failure');
      const req = buildMockRequest();
      const res = buildMockResponse();

      errorLoggerMiddleware(err, req, res as Response, next);

      expect(typeof res._body).toBe('string');
      expect((res._body as string).length).toBeGreaterThan(0);
    });
  });
});
