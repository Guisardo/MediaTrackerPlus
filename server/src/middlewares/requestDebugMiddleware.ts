import { RequestHandler } from 'express';

import { Config } from 'src/config';
import { logger } from 'src/logger';
import { summarizeForLog } from 'src/logger/tracing';

export const requestDebugMiddleware: RequestHandler = (req, _res, next) => {
  if (Config.NODE_ENV !== 'development') {
    next();
    return;
  }

  logger.debug(`request ${req.method} ${req.url}`, {
    body: summarizeForLog(req.body),
    params: summarizeForLog(req.params),
    query: summarizeForLog(req.query),
  });

  next();
};
