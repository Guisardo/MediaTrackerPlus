import axios from 'axios';
import { Pushover } from 'src/notifications/platforms/pushover';
import { FormattedNotification } from 'src/notifications/notificationFormatter';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

/**
 * The hardcoded Pushover application token defined in pushover.ts.
 * Captured here so tests document the expected value without re-deriving it.
 */
const PUSHOVER_APP_TOKEN = 'ax32fzevhit7iwkm3fk18uw1i2ooyv';
const EXPECTED_API_ENDPOINT = 'https://api.pushover.net/1/messages.json';

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

describe('Pushover notification platform', () => {
  const userKey = 'uAbCdEfGhIjKlMnOpQrStUvWxYz012';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 200, data: { status: 1 } });
  });

  describe('platform metadata', () => {
    test('has name "Pushover"', () => {
      expect(Pushover.name).toBe('Pushover');
    });

    test('declares credentialName as "key" (single credential)', () => {
      expect(Pushover.credentialName).toBe('key');
    });

    test('does not declare credentialNames (uses singular credentialName)', () => {
      expect(Pushover.credentialNames).toBeUndefined();
    });

    test('has a sendFunction', () => {
      expect(typeof Pushover.sendFunction).toBe('function');
    });
  });

  describe('sendFunction — endpoint', () => {
    test('posts to the Pushover messages API endpoint', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(EXPECTED_API_ENDPOINT);
    });
  });

  describe('sendFunction — payload params', () => {
    test('sends the user key as the "user" param', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.user).toBe(userKey);
    });

    test('sends the hardcoded application token as the "token" param', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.token).toBe(PUSHOVER_APP_TOKEN);
    });

    test('sends the notification title as the "title" param', async () => {
      const title = 'Breaking Bad: New Episode';

      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title, body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.title).toBe(title);
    });

    test('sends the html body as the "message" param', async () => {
      const notification = buildFormattedNotification({
        html: '<b>Breaking Bad</b> S05E16 <em>Felina</em> is available',
      });

      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.message).toBe(notification.html);
    });

    test('sends the "html" flag set to "1" to enable HTML rendering', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.html).toBe('1');
    });

    test('does not use markdown or plainText as the message body', async () => {
      const notification = buildFormattedNotification({
        html: 'html-only',
        markdown: 'not-used',
        plainText: 'not-used-either',
      });

      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);
      expect(body.message).toBe('html-only');
      expect(body.message).not.toBe('not-used');
    });

    test('sends params as a URLSearchParams instance (not a plain object)', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, rawBody] = mockedAxios.post.mock.calls[0];
      expect(rawBody).toBeInstanceOf(URLSearchParams);
    });

    test('sends a complete, correctly-shaped params object', async () => {
      const title = 'Full Params Test';
      const notification = buildFormattedNotification({ html: '<b>Full test</b>' });

      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title, body: notification },
      });

      const body = parsePostBody(mockedAxios.post.mock.calls[0]);

      expect(body).toEqual({
        message: notification.html,
        title,
        user: userKey,
        token: PUSHOVER_APP_TOKEN,
        html: '1',
      });
    });
  });

  describe('sendFunction — error handling', () => {
    test('resolves successfully when axios.post resolves', async () => {
      await expect(
        Pushover.sendFunction({
          credentials: { key: userKey },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects', async () => {
      const apiError = new Error('Bad Request');
      mockedAxios.post.mockRejectedValueOnce(apiError);

      await expect(
        Pushover.sendFunction({
          credentials: { key: 'invalid-key' },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Bad Request');
    });

    test('calls axios.post exactly once per invocation', async () => {
      await Pushover.sendFunction({
        credentials: { key: userKey },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
