import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { AccessTokenMiddleware } from 'src/middlewares/token';
import { accessTokenRepository } from 'src/repository/accessToken';

jest.mock('src/repository/accessToken', () => ({
  accessTokenRepository: {
    findOne: jest.fn(),
  },
}));

const mockAccessTokenRepository = accessTokenRepository as jest.Mocked<
  typeof accessTokenRepository
>;

/**
 * Computes the SHA-256 hex digest of a raw token string, matching exactly what
 * AccessTokenMiddleware does before the database lookup.
 */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf-8').digest('hex');
}

/**
 * Builds a minimal Express Request mock. Headers, query, and the user property
 * can be overridden per test.
 */
function buildMockRequest(overrides: {
  authHeader?: string;
  accessTokenHeader?: string;
  queryToken?: string;
  user?: number;
} = {}): Request & { user?: number } {
  const headers: Record<string, string> = {};

  if (overrides.authHeader !== undefined) {
    headers['Authorization'] = overrides.authHeader;
  }
  if (overrides.accessTokenHeader !== undefined) {
    headers['Access-Token'] = overrides.accessTokenHeader;
  }

  return {
    user: overrides.user,
    header(name: string): string | undefined {
      return headers[name];
    },
    query: overrides.queryToken !== undefined
      ? { token: overrides.queryToken }
      : {},
  } as unknown as Request & { user?: number };
}

/**
 * A minimal Express Response mock. The authorize middleware does not send a
 * response — it only sets req.user and calls next(). This object exists purely
 * to satisfy the handler signature.
 */
const mockResponse: Response = {} as Response;

describe('AccessTokenMiddleware.authorize', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // No token provided at all
  // ---------------------------------------------------------------------------

  describe('when no token is present in any source', () => {
    test('calls next() without setting req.user', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest();

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
      expect(mockAccessTokenRepository.findOne).not.toHaveBeenCalled();
    });

    test('does not query the database', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest();

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(mockAccessTokenRepository.findOne).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Token in Authorization: Bearer <token>
  // ---------------------------------------------------------------------------

  describe('when a valid Bearer token is provided in the Authorization header', () => {
    const rawToken = 'valid-raw-token-abc123';
    const userId = 42;

    beforeEach(() => {
      mockAccessTokenRepository.findOne.mockResolvedValue({
        id: 1,
        userId,
        token: hashToken(rawToken),
        description: 'test token',
      });
    });

    test('calls next()', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ authHeader: `Bearer ${rawToken}` });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('sets req.user to the userId from the found access token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ authHeader: `Bearer ${rawToken}` });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBe(userId);
    });

    test('queries the database with the SHA-256 hash of the raw token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ authHeader: `Bearer ${rawToken}` });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(mockAccessTokenRepository.findOne).toHaveBeenCalledWith({
        token: hashToken(rawToken),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Token in Access-Token header
  // ---------------------------------------------------------------------------

  describe('when a valid token is provided in the Access-Token header', () => {
    const rawToken = 'access-token-header-xyz789';
    const userId = 7;

    beforeEach(() => {
      mockAccessTokenRepository.findOne.mockResolvedValue({
        id: 2,
        userId,
        token: hashToken(rawToken),
        description: 'access token header test',
      });
    });

    test('calls next()', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ accessTokenHeader: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('sets req.user to the userId from the found access token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ accessTokenHeader: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBe(userId);
    });

    test('queries the database with the hashed token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ accessTokenHeader: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(mockAccessTokenRepository.findOne).toHaveBeenCalledWith({
        token: hashToken(rawToken),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Token in query parameter
  // ---------------------------------------------------------------------------

  describe('when a valid token is provided as a query parameter', () => {
    const rawToken = 'query-token-qwerty';
    const userId = 99;

    beforeEach(() => {
      mockAccessTokenRepository.findOne.mockResolvedValue({
        id: 3,
        userId,
        token: hashToken(rawToken),
        description: 'query param token test',
      });
    });

    test('calls next()', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ queryToken: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('sets req.user to the userId from the found access token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ queryToken: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBe(userId);
    });

    test('queries the database with the hashed token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ queryToken: rawToken });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(mockAccessTokenRepository.findOne).toHaveBeenCalledWith({
        token: hashToken(rawToken),
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Token present but not found in database
  // ---------------------------------------------------------------------------

  describe('when the token is not found in the database', () => {
    beforeEach(() => {
      mockAccessTokenRepository.findOne.mockResolvedValue(undefined);
    });

    test('calls next() with Authorization Bearer token', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ authHeader: 'Bearer unknown-token' });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('does not set req.user when token is not found', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ authHeader: 'Bearer unknown-token' });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBeUndefined();
    });

    test('calls next() with Access-Token header token not found', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ accessTokenHeader: 'bad-token' });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });

    test('calls next() with query token not found', async () => {
      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ queryToken: 'unknown-query-token' });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Authorization header without "Bearer " prefix
  // ---------------------------------------------------------------------------

  describe('when the Authorization header does not start with "Bearer "', () => {
    test('does not extract the token from a non-Bearer Authorization header', async () => {
      const next: NextFunction = jest.fn();
      // "Basic " prefix — should not be treated as a Bearer token
      const req = buildMockRequest({ authHeader: 'Basic dXNlcjpwYXNz' });

      // The repository should not be called if there is no other token source
      mockAccessTokenRepository.findOne.mockResolvedValue(undefined);

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      // next is called but req.user is not set — no database hit with the
      // Basic credentials
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Priority: Authorization header > Access-Token header > query param
  // ---------------------------------------------------------------------------

  describe('token source priority', () => {
    test('Authorization Bearer takes precedence over Access-Token header', async () => {
      const bearerRaw = 'bearer-wins';
      const accessTokenRaw = 'access-token-loses';
      const userId = 10;

      // Only the bearer hash lookup should return a result
      mockAccessTokenRepository.findOne.mockImplementation(async (where) => {
        if ((where as any).token === hashToken(bearerRaw)) {
          return { id: 10, userId, token: hashToken(bearerRaw), description: 'bearer' };
        }
        return undefined;
      });

      const next: NextFunction = jest.fn();
      const req = buildMockRequest({
        authHeader: `Bearer ${bearerRaw}`,
        accessTokenHeader: accessTokenRaw,
      });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBe(userId);
      // The first findOne call must use the Bearer hash
      const firstCallArg = (mockAccessTokenRepository.findOne as jest.Mock).mock.calls[0][0];
      expect(firstCallArg).toEqual({ token: hashToken(bearerRaw) });
    });

    test('Access-Token header is used when Authorization Bearer is absent', async () => {
      const accessTokenRaw = 'only-access-token';
      const userId = 20;

      mockAccessTokenRepository.findOne.mockResolvedValue({
        id: 5,
        userId,
        token: hashToken(accessTokenRaw),
        description: 'access token only',
      });

      const next: NextFunction = jest.fn();
      const req = buildMockRequest({ accessTokenHeader: accessTokenRaw });

      await AccessTokenMiddleware.authorize(req, mockResponse, next);

      expect(req.user).toBe(userId);
      expect(mockAccessTokenRepository.findOne).toHaveBeenCalledWith({
        token: hashToken(accessTokenRaw),
      });
    });
  });
});
