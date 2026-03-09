import { NextFunction } from 'express';

export const request = (
  handler: (
    req: Express.Request,
    res: Express.Response,
    next: NextFunction
  ) => void,
  args: {
    userId: number;
    pathParams?: Record<string, unknown>;
    requestQuery?: Record<string, unknown>;
    requestBody?: Record<string, unknown>;
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
        params: args.pathParams,
        query: args.requestQuery,
        body: args.requestBody,
      } as unknown as Express.Request,
      res as unknown as Express.Response,
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
