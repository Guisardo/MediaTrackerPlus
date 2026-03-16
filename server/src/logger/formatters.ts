import chalk from 'chalk';
import _ from 'lodash';
import { nanoid } from 'nanoid';
import { format } from 'winston';
import { TransformableInfo } from 'logform';

import { LogEntry } from 'src/logger';

type ValidationLogEntry = LogEntry & {
  type: 'validationError';
  error: string;
  body?: Record<string, unknown>;
  method: string;
  url: string;
};

type HttpEntry = LogEntry & {
  type: 'http';
  ip: string;
  method: string;
  url: string;
  httpVersion: string;
  statusCode: number;
  responseSize: number;
  duration: number;
};

export const logWithId = format((info) => {
  info.id = nanoid(36);

  return info;
});

export const validationErrorLogFormatter = format((info: TransformableInfo) => {
  if ('type' in info && info.type === 'validationError') {
    const logEntry = info as ValidationLogEntry;
    const body =
      logEntry.body && Object.keys(logEntry.body).length > 0
        ? JSON.stringify(logEntry.body)
        : '';

    info.message = `${chalk.red('ValidationError')} ${chalk.yellow(
      `${logEntry.method} ${logEntry.url} ${body}`
    )} ${logEntry.error}`;
  }

  return info;
});

export const httpLogFormatter = format((info: TransformableInfo) => {
  if ('type' in info && info.type === 'http') {
    const logEntry = info as HttpEntry;
    info.message = `${logEntry.ip} "${chalk.magenta(
      `${logEntry.method} ${logEntry.url} HTTP/${logEntry.httpVersion}`
    )}" ${logEntry.statusCode} ${logEntry.responseSize} ${chalk.blue(
      `${logEntry.duration}ms`
    )}`;
  }

  return info;
});
