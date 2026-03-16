import _ from 'lodash';
import path from 'path';
import {
  createLogger,
  format,
  transports,
  LeveledLogMethod,
  Logger,
} from 'winston';
import { TransformableInfo } from 'logform';

import { configMigrationLogs, Config } from 'src/config';
import {
  httpLogFormatter,
  logWithId,
  validationErrorLogFormatter,
} from 'src/logger/formatters';

const fileTransport = (filename: string) => {
  return new transports.File({
    filename: filename,
    maxsize: 100000,
    maxFiles: 10,
    tailable: true,
    format: format.combine(format.uncolorize(), format.json()),
    eol: '\n',
    silent: Config.NODE_ENV === 'test',
  });
};

export const stackErrorFormatter = format((info: TransformableInfo) => {
  if ('stack' in info) {
    info.message = String(info.stack);
  }

  // When an Error is passed as metadata (e.g. logger.error('msg', { err })),
  // format.cli cannot serialize it because Error properties are non-enumerable.
  // Extract the stack (or message) into the log entry so it appears in console output.
  const meta = info as Record<string, unknown>;
  if (meta['err'] instanceof Error) {
    const err = meta['err'] as Error;
    info.message = `${info.message}\n${err.stack ?? err.message}`;
    delete meta['err'];
  }

  return info;
});

export class logger {
  private static httpLogger: Logger;
  private static debugLogger: Logger;

  static init() {
    const formats = format.combine(
      logWithId(),
      format.errors({ stack: true }),
      format.colorize(),
      format.timestamp(),
      format.prettyPrint()
    );

    this.httpLogger = createLogger({
      level: 'http',
      format: formats,
      levels: {
        http: 3,
      },
      transports: [fileTransport(path.join(Config.LOGS_PATH, 'http.log'))],
    });

    this.debugLogger = createLogger({
      level: 'debug',
      format: formats,
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 5,
      },
      transports: [
        new transports.Console({
          handleExceptions: true,
          format: format.combine(
            stackErrorFormatter(),
            validationErrorLogFormatter(),
            httpLogFormatter(),
            format.cli({
              all: true,
              message: true,
              levels: {
                error: 5,
                warn: 4,
                info: 4,
                http: 4,
                debug: 5,
              },
            })
          ),
          silent: Config.NODE_ENV === 'test',
        }),
        fileTransport(path.join(Config.LOGS_PATH, 'debug.log')),
      ],
    });

    configMigrationLogs().forEach(this.debugLogger.info);
  }

  static http(msg: HttpLogEntry): void {
    this.httpLogger?.http('', msg);
  }

  static error: LeveledLogMethod = (msg, ...splat) => {
    return this.debugLogger?.error(msg, ...splat);
  };

  static warn: LeveledLogMethod = (msg, ...splat) => {
    return this.debugLogger?.warn(msg, ...splat);
  };

  static info: LeveledLogMethod = (msg, ...splat) => {
    return this.debugLogger?.info(msg, ...splat);
  };

  static debug: LeveledLogMethod = (msg, ...splat) => {
    return this.debugLogger?.debug(msg, ...splat);
  };
}

export type LogEntry = {
  message: string;
  id: string;
  level: string;
  stack?: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
} & (HttpLogEntry | ValidationErrorLogEntry | {});

export type HttpLogEntry = {
  type: 'http';
  url: string;
  method: string;
  ip: string;
  httpVersion: string;
  statusCode: number;
  responseSize: number;
  duration: number;
};

export type ValidationErrorLogEntry = {
  type: 'validationError';
  message: string;
  error: string;
  body?: Record<string, unknown>;
  method: string;
  url: string;
};

export type LogLevels = {
  error?: boolean;
  warn?: boolean;
  info?: boolean;
  debug?: boolean;
  http?: boolean;
};
