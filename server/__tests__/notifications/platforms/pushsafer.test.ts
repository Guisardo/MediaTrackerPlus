import axios from 'axios';
import { Pushsafer } from 'src/notifications/platforms/pushsafer';
import { FormattedNotification } from 'src/notifications/notificationFormatter';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const EXPECTED_API_ENDPOINT = 'https://www.pushsafer.com/api';

/**
 * Builds a complete FormattedNotification for use in tests.
 */
function buildFormattedNotification(overrides: Partial<FormattedNotification> = {}): FormattedNotification {
  return {
    plainText: 'Plain text body',
    markdown: '**Markdown body**',
    html: '<b>HTML body</b>',
    BBCode: '[b]BBCode body[/b]',
    ...overrides,
  };
}

/**
 * Parses the URLSearchParams argument passed to axios.post and returns a plain object.
 */
function parsePostBody(call: unknown[]): Record<string, string> {
  const [, rawBody] = call as [string, URLSearchParams, ...unknown[]];
  const result: Record<string, string> = {};
  rawBody.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

describe('Pushsafer notification platform', () => {
  const privateKey = 'a1b2c3d4e5f6g7h8i9j0';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 250, data: { status: 250 } });
  });

  describe('platform metadata', () => {
    test('has name "Pushsafer"', () => {
      expect(Pushsafer.name).toBe('Pushsafer');
    });

    test('declares credentialName as "key" (single credential)', () => {
      expect(Pushsafer.credentialName).toBe('key');
    });

    test('does not declare credentialNames (uses singular credentialName)', () => {
      expect(Pushsafer.credentialNames).toBeUndefined();
    });

    test('has a sendFunction', () => {
      expect(typeof Pushsafer.sendFunction).toBe('function');
    });
  });

  describe('sendFunction — endpoint', () => {
    test('posts to the Pushsafer API endpoint', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(EXPECTED_API_ENDPOINT);
    });

    test('always uses the hardcoded pushsafer.com API URL', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: 'another-key' },
        content: { title: 'Another title', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe('https://www.pushsafer.com/api');
    });
  });

  describe('sendFunction — payload params', () => {
    test('sends the private/alias key as the "k" param', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.k).toBe(privateKey);
    });

    test('uses the exact key value from credentials without transformation', async () => {
      const aliasKey = 'alias-key-for-device-group';

      await Pushsafer.sendFunction({
        credentials: { key: aliasKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.k).toBe(aliasKey);
    });

    test('sends the BBCode body as the "m" param', async () => {
      const notification = buildFormattedNotification({
        BBCode: '[b]Breaking Bad[/b] S05E16 [i]Felina[/i] is available',
      });

      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.m).toBe(notification.BBCode);
    });

    test('does not use plainText, markdown, or html as the message param', async () => {
      const notification = buildFormattedNotification({
        BBCode: 'bbcode-only',
        plainText: 'not-used',
        markdown: 'not-used-either',
        html: 'also-not-used',
      });

      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.m).toBe('bbcode-only');
      expect(body.m).not.toBe('not-used');
    });

    test('sends the notification title as the "t" param', async () => {
      const title = 'Breaking Bad: New Episode Available';

      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title, body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.t).toBe(title);
    });

    test('sends params as a URLSearchParams instance (not a plain object)', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, rawBody] = mockedAxios.post.mock.calls[0];
      expect(rawBody).toBeInstanceOf(URLSearchParams);
    });

    test('sends a complete, correctly-shaped params object', async () => {
      const title = 'Complete Params Test';
      const notification = buildFormattedNotification({
        BBCode: '[b]Full BBCode content[/b]',
      });

      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title, body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);

      expect(body).toEqual({
        k: privateKey,
        m: notification.BBCode,
        t: title,
      });
    });

    test('payload contains exactly the "k", "m", and "t" params — no extras', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(Object.keys(body).sort()).toEqual(['k', 'm', 't']);
    });
  });

  describe('sendFunction — error handling', () => {
    test('resolves successfully when axios.post resolves', async () => {
      await expect(
        Pushsafer.sendFunction({
          credentials: { key: privateKey },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects', async () => {
      const apiError = new Error('Unauthorized');
      mockedAxios.post.mockRejectedValueOnce(apiError);

      await expect(
        Pushsafer.sendFunction({
          credentials: { key: 'invalid-key' },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Unauthorized');
    });

    test('calls axios.post exactly once per invocation', async () => {
      await Pushsafer.sendFunction({
        credentials: { key: privateKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
