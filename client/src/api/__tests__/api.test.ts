/**
 * Tests for the API utility layer: FetchError, MediaTrackerError, unwrapError,
 * and errorHandler defined in src/api/api.ts.
 *
 * The `mediatracker-api` module is mocked in its entirety so that the module-level
 * `new MediaTracker(...)` call in api.ts does not trigger real network behaviour.
 */

import { FetchError, MediaTrackerError, unwrapError, errorHandler } from '../api';

// ---------------------------------------------------------------------------
// Module-level mock – prevents the Api constructor from running at import time
// ---------------------------------------------------------------------------
jest.mock('mediatracker-api', () => {
  return {
    Api: jest.fn().mockImplementation(() => ({})),
  };
}, { virtual: true });

// ---------------------------------------------------------------------------
// FetchError
// ---------------------------------------------------------------------------

describe('FetchError', () => {
  it('sets status on the instance', () => {
    const err = new FetchError({ status: 404 });
    expect(err.status).toBe(404);
  });

  it('sets statusText when provided', () => {
    const err = new FetchError({ status: 404, statusText: 'Not Found' });
    expect(err.statusText).toBe('Not Found');
  });

  it('sets statusText to undefined when omitted', () => {
    const err = new FetchError({ status: 500 });
    expect(err.statusText).toBeUndefined();
  });

  it('sets body when provided', () => {
    const err = new FetchError({ status: 422, body: '{"error":"invalid"}' });
    expect(err.body).toBe('{"error":"invalid"}');
  });

  it('sets body to undefined when omitted', () => {
    const err = new FetchError({ status: 500 });
    expect(err.body).toBeUndefined();
  });

  it('sets name to "FetchError"', () => {
    const err = new FetchError({ status: 500 });
    expect(err.name).toBe('FetchError');
  });

  it('formats message as "status (statusText)" when statusText is present', () => {
    const err = new FetchError({ status: 403, statusText: 'Forbidden' });
    expect(err.message).toBe('403 (Forbidden)');
  });

  it('formats message as the status code string when statusText is absent', () => {
    const err = new FetchError({ status: 503 });
    expect(err.message).toBe('503');
  });

  it('is an instance of Error', () => {
    const err = new FetchError({ status: 400 });
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// MediaTrackerError
// ---------------------------------------------------------------------------

describe('MediaTrackerError', () => {
  it('sets the message', () => {
    const err = new MediaTrackerError('Something went wrong');
    expect(err.message).toBe('Something went wrong');
  });

  it('sets name to "MediaTrackerError"', () => {
    const err = new MediaTrackerError('oops');
    expect(err.name).toBe('MediaTrackerError');
  });

  it('is an instance of Error', () => {
    const err = new MediaTrackerError('test');
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// unwrapError
// ---------------------------------------------------------------------------

describe('unwrapError', () => {
  it('returns { data: undefined, error: errorMessage } for a RequestError-shaped object', async () => {
    const requestError = {
      errorMessage: 'Item not found',
      MediaTrackerError: true as const,
    };

    const result = await unwrapError(Promise.resolve(requestError));

    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Item not found');
  });

  it('returns { data, error: undefined } for normal response data', async () => {
    const normalData = { id: 42, title: 'Inception' };

    const result = await unwrapError(Promise.resolve(normalData));

    expect(result.data).toEqual({ id: 42, title: 'Inception' });
    expect(result.error).toBeUndefined();
  });

  it('returns { data, error: undefined } for a string value', async () => {
    const result = await unwrapError(Promise.resolve('plain string' as any));

    expect(result.data).toBe('plain string');
    expect(result.error).toBeUndefined();
  });

  it('returns { data, error: undefined } for an array', async () => {
    const data = [1, 2, 3];
    const result = await unwrapError(Promise.resolve(data as any));

    expect(result.data).toEqual([1, 2, 3]);
    expect(result.error).toBeUndefined();
  });

  it('distinguishes an object with "errorMessage" but without MediaTrackerError: true', async () => {
    // An object that has errorMessage but is missing MediaTrackerError: true
    // should NOT be treated as an error.
    const notAnError = { errorMessage: 'something', MediaTrackerError: false };
    const result = await unwrapError(Promise.resolve(notAnError as any));

    expect(result.data).toEqual(notAnError);
    expect(result.error).toBeUndefined();
  });

  it('distinguishes an object with MediaTrackerError: true but missing errorMessage', async () => {
    // Missing errorMessage – isMediaTrackerError guard requires both fields
    const notAnError = { MediaTrackerError: true as const };
    const result = await unwrapError(Promise.resolve(notAnError as any));

    expect(result.data).toEqual(notAnError);
    expect(result.error).toBeUndefined();
  });

  it('handles null response as normal data', async () => {
    const result = await unwrapError(Promise.resolve(null as any));

    expect(result.data).toBeNull();
    expect(result.error).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// errorHandler
// ---------------------------------------------------------------------------

describe('errorHandler', () => {
  it('calls the wrapped function with the provided args and returns unwrapped data', async () => {
    const responseData = { id: 1, name: 'test' };
    const innerFn = jest.fn().mockResolvedValue(responseData);
    const wrapped = errorHandler(innerFn);

    const result = await wrapped({ someArg: 'value' });

    expect(innerFn).toHaveBeenCalledTimes(1);
    expect(innerFn).toHaveBeenCalledWith({ someArg: 'value' });
    expect(result.data).toEqual(responseData);
    expect(result.error).toBeUndefined();
  });

  it('propagates a RequestError from the inner function as an error string', async () => {
    const requestError = {
      errorMessage: 'Unauthorized',
      MediaTrackerError: true as const,
    };
    const innerFn = jest.fn().mockResolvedValue(requestError);
    const wrapped = errorHandler(innerFn);

    const result = await wrapped(undefined);

    expect(result.data).toBeUndefined();
    expect(result.error).toBe('Unauthorized');
  });

  it('calls the wrapped function exactly once per invocation', async () => {
    const innerFn = jest.fn().mockResolvedValue({ ok: true });
    const wrapped = errorHandler(innerFn);

    await wrapped('arg1');
    await wrapped('arg2');

    expect(innerFn).toHaveBeenCalledTimes(2);
  });

  it('passes undefined args when the wrapped function expects no parameters', async () => {
    const innerFn = jest.fn().mockResolvedValue({ result: 'ok' });
    const wrapped = errorHandler(innerFn as any);

    const result = await wrapped(undefined);

    expect(innerFn).toHaveBeenCalledWith(undefined);
    expect(result.data).toEqual({ result: 'ok' });
  });
});
