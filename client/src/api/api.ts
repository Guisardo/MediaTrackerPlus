import { i18n } from '@lingui/core';
import { Api as MediaTracker, RequestError } from 'mediatracker-api';
import { applyMethodDecorator, traceAsyncMethod } from 'src/logger/tracing';

export class FetchError extends Error {
  readonly status: number;
  readonly statusText?: string;
  readonly body?: string;

  constructor(args: { status: number; statusText?: string; body?: string }) {
    super(
      args.statusText
        ? `${args.status} (${args.statusText})`
        : args.status.toString()
    );
    this.name = this.constructor.name;
    this.status = args.status;
    this.statusText = args.statusText;
    this.body = args.body;
  }
}

export class MediaTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ClientApiFetchLogger {
  async execute(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers);
    headers.set('Accept-Language', i18n.locale);

    const res = await fetch(input, {
      ...init,
      headers,
    });

    if (!res.ok) {
      throw new FetchError({
        status: res.status,
        statusText: res.statusText,
        body: await res.text(),
      });
    }

    return res;
  }
}

applyMethodDecorator(
  ClientApiFetchLogger.prototype,
  'execute',
  traceAsyncMethod({
    includeResult: true,
    label: 'client.api.fetch',
  })
);

export const clientApiFetchLogger = new ClientApiFetchLogger();

export const mediaTrackerApi = new MediaTracker({
  customFetch: (input, init) => clientApiFetchLogger.execute(input, init),
});

export const unwrapError = async <T>(
  data: Promise<T | RequestError>
): Promise<
  | {
      data: T;
      error: undefined;
    }
  | {
      data: undefined;
      error: string;
    }
> => {
  const res = await data;

  if (isMediaTrackerError(res)) {
    return {
      data: undefined,
      error: res.errorMessage,
    };
  }

  return {
    data: res,
    error: undefined,
  };
};

export const errorHandler = <T, U>(
  fn: (args: T) => Promise<U | RequestError>
) => {
  return async (args: T) => unwrapError(fn(args));
};

const isMediaTrackerError = <T>(
  data: T | RequestError
): data is RequestError => {
  return (
    data &&
    typeof data === 'object' &&
    'errorMessage' in data &&
    'MediaTrackerError' in data &&
    typeof data.errorMessage === 'string' &&
    data.MediaTrackerError === true
  );
};
