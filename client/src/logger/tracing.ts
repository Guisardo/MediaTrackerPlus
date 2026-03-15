const SENSITIVE_KEY_PATTERN =
  /pass(word)?|token|secret|authorization|cookie|session|credential|api[-_]?key/i;
const MAX_DEPTH = 3;
const MAX_ARRAY_ITEMS = 5;
const MAX_OBJECT_KEYS = 10;
const MAX_STRING_LENGTH = 120;
const SENSITIVE_VALUE_KEYS = new Set(['body']);

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

  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncate(value.message),
      stack: truncate(value.stack || ''),
    };
  }

  if (typeof Request !== 'undefined' && value instanceof Request) {
    return {
      type: 'Request',
      method: value.method,
      url: value.url,
    };
  }

  if (typeof Headers !== 'undefined' && value instanceof Headers) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : truncate(entryValue),
      ])
    );
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
      if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_VALUE_KEYS.has(key)) {
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

const isClientLoggingEnabled = () => process.env.NODE_ENV === 'development';

export const clientLogger = {
  debug(message: string, metadata?: unknown) {
    if (!isClientLoggingEnabled()) {
      return;
    }

    if (metadata !== undefined) {
      console.debug(`[MediaTracker] ${message}`, metadata);
      return;
    }

    console.debug(`[MediaTracker] ${message}`);
  },

  error(message: string, metadata?: unknown) {
    if (!isClientLoggingEnabled()) {
      return;
    }

    if (metadata !== undefined) {
      console.error(`[MediaTracker] ${message}`, metadata);
      return;
    }

    console.error(`[MediaTracker] ${message}`);
  },
};

export const summarizeForClientLog = (value: unknown) => summarizeValue(value);

export const traceAsyncMethod = (options?: {
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
    _target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ) => {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      return descriptor;
    }

    descriptor.value = async function tracedMethod(...args: unknown[]) {
      const methodLabel = label || String(propertyKey);
      const startedAt = Date.now();

      clientLogger.debug(`${methodLabel} started`, {
        args: includeArgs ? summarizeForClientLog(args) : undefined,
      });

      try {
        const result = await originalMethod.apply(this, args);

        clientLogger.debug(`${methodLabel} completed`, {
          durationMs: Date.now() - startedAt,
          result: includeResult ? summarizeForClientLog(result) : undefined,
        });

        return result;
      } catch (error) {
        clientLogger.error(`${methodLabel} failed`, {
          durationMs: Date.now() - startedAt,
          error: summarizeForClientLog(error),
        });

        throw error;
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
