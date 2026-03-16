import { NextFunction, RequestHandler } from 'express';

export const request = (
  handler: RequestHandler,
  args: {
    userId: number;
    pathParams?: Record<string, unknown>;
    requestQuery?: Record<string, unknown>;
    requestBody?: Record<string, unknown>;
    requestHeaders?: Record<string, string>;
  }
) => {
  return new Promise<{
    statusCode: number;
    data?: unknown;
  }>((resolve, reject) => {
    let resolved = false;
    let currentStatusCode = 200;

    const res = {
      send: (data: unknown) => {
        if (!resolved) {
          resolved = true;
          resolve({
            statusCode: currentStatusCode,
            data: data,
          });
        }
      },
      json: (data: unknown) => {
        if (!resolved) {
          resolved = true;
          resolve({
            statusCode: currentStatusCode,
            data: data,
          });
        }
      },
      sendStatus: (status: number) => {
        if (!resolved) {
          resolved = true;
          resolve({
            statusCode: status,
          });
        }
      },
      status: (code: number) => {
        currentStatusCode = code;
        return res;
      },
      redirect: (url: string) => {
        if (!resolved) {
          resolved = true;
          resolve({
            statusCode: 302,
            data: url,
          });
        }
      },
    };

    const result = handler(
      {
        user: args.userId,
        params: args.pathParams ?? {},
        query: args.requestQuery ?? {},
        body: args.requestBody ?? {},
        headers: args.requestHeaders ?? {},
      } as unknown as Parameters<RequestHandler>[0],
      res as unknown as Parameters<RequestHandler>[1],
      ((err?: unknown) => {
        if (err) {
          reject(err);
        }
      }) as NextFunction
    );

    // If the handler returns a promise, resolve when it completes
    // (handles cases where handler calls res.status() without res.send())
    if ((result as unknown) && typeof (result as any).then === 'function') {
      (result as unknown as Promise<void>).then(() => {
        if (!resolved) {
          resolved = true;
          resolve({
            statusCode: currentStatusCode,
          });
        }
      }).catch((err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });
    }
  });
};
