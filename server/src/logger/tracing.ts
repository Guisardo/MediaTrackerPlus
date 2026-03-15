import { logger } from '../logger';
import { Config } from '../config';

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|token|secret|authorization|cookie|session|credential|api[-_]?key/i;
const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 5;
const MAX_OBJECT_KEYS = 10;
const MAX_STRING_LENGTH = 120;

const truncate = (value: string) => {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
};

const summarizeValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncate(value);
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return value;
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: truncate(value.stack || ''),
    };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) {
      return `[Array(${value.length})]`;
    }

    return {
      type: 'array',
      length: value.length,
      sample: value
        .slice(0, MAX_ARRAY_ITEMS)
        .map((item) => summarizeValue(item, depth + 1, seen)),
    };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    if (depth >= MAX_DEPTH) {
      const constructorName = value.constructor?.name || 'Object';
      return `[${constructorName}]`;
    }

    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue);
    const summarizedEntries = keys.slice(0, MAX_OBJECT_KEYS).map((key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, '[redacted]'];
      }

      return [key, summarizeValue(objectValue[key], depth + 1, seen)];
    });

    return {
      ...Object.fromEntries(summarizedEntries),
      ...(keys.length > MAX_OBJECT_KEYS
        ? { __truncatedKeys: keys.length - MAX_OBJECT_KEYS }
        : {}),
    };
  }

  return String(value);
};

const buildTraceLabel = (
  instance: unknown,
  methodName: string,
  label?: string
) => {
  if (label) {
    return label;
  }

  if (
    instance &&
    typeof instance === 'object' &&
    'tableName' in instance &&
    typeof instance.tableName === 'string'
  ) {
    return `repository:${instance.tableName}.${methodName}`;
  }

  const constructorName =
    instance &&
    typeof instance === 'object' &&
    'constructor' in instance &&
    (instance.constructor as { name?: string })?.name
      ? (instance.constructor as { name: string }).name
      : 'UnknownClass';

  return `${constructorName}.${methodName}`;
};

export const summarizeForLog = (value: unknown) => summarizeValue(value);

export const traceMethod = (options?: {
  includeArgs?: boolean;
  includeResult?: boolean;
  label?: string;
}) => {
  const {
    includeArgs = true,
    includeResult = true,
    label,
  } = options || {};

  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ) => {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      return descriptor;
    }

    descriptor.value = function tracedMethod(...args: unknown[]) {
      if (Config.NODE_ENV !== 'development') {
        return originalMethod.apply(this, args);
      }

      const methodName = String(propertyKey);
      const traceLabel = buildTraceLabel(this, methodName, label);
      const startedAt = Date.now();

      logger.debug(`${traceLabel} started`, {
        args: includeArgs ? summarizeForLog(args) : undefined,
        trace: traceLabel,
      });

      const onSuccess = (result: unknown) => {
        logger.debug(`${traceLabel} completed`, {
          durationMs: Date.now() - startedAt,
          result: includeResult ? summarizeForLog(result) : undefined,
          trace: traceLabel,
        });

        return result;
      };

      const onError = (error: unknown) => {
        logger.error(`${traceLabel} failed`, {
          durationMs: Date.now() - startedAt,
          err: error instanceof Error ? error : new Error(String(error)),
          trace: traceLabel,
        });

        throw error;
      };

      try {
        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
          return result.then(onSuccess).catch(onError);
        }

        return onSuccess(result);
      } catch (error) {
        return onError(error);
      }
    };

    return descriptor;
  };
};

export const applyMethodDecorator = (
  target: object,
  propertyKey: string,
  decorator: (
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>
  ) => TypedPropertyDescriptor<any> | void
) => {
  const descriptor = Object.getOwnPropertyDescriptor(target, propertyKey);

  if (!descriptor) {
    return;
  }

  const nextDescriptor =
    decorator(target, propertyKey, descriptor as TypedPropertyDescriptor<any>) ||
    descriptor;

  Object.defineProperty(target, propertyKey, nextDescriptor);
};
