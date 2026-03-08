import axios from 'axios';
import { Pushbullet } from 'src/notifications/platforms/pushbullet';
import { FormattedNotification } from 'src/notifications/notificationFormatter';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

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

describe('Pushbullet notification platform', () => {
  const EXPECTED_API_ENDPOINT = 'https://api.pushbullet.com/v2/pushes';
  const accessToken = 'o.AbCdEfGhIjKlMnOpQrSt';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
  });

  describe('platform metadata', () => {
    test('has name "Pushbullet"', () => {
      expect(Pushbullet.name).toBe('Pushbullet');
    });

    test('declares credentialName as "token" (single credential)', () => {
      expect(Pushbullet.credentialName).toBe('token');
    });

    test('does not declare credentialNames (uses singular credentialName)', () => {
      expect(Pushbullet.credentialNames).toBeUndefined();
    });

    test('has a sendFunction', () => {
      expect(typeof Pushbullet.sendFunction).toBe('function');
    });
  });

  describe('sendFunction — endpoint', () => {
    test('posts to the Pushbullet v2 pushes API endpoint', async () => {
      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(EXPECTED_API_ENDPOINT);
    });

    test('always uses exactly the hardcoded Pushbullet endpoint', async () => {
      // Confirms that no dynamic URL construction is done and the endpoint is stable
      await Pushbullet.sendFunction({
        credentials: { token: 'different-token' },
        content: { title: 'Another title', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe('https://api.pushbullet.com/v2/pushes');
    });
  });

  describe('sendFunction — authentication header', () => {
    test('passes the access token in the "Access-Token" header', async () => {
      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toMatchObject({ 'Access-Token': accessToken });
    });

    test('uses the exact token value from credentials without transformation', async () => {
      const rawToken = 'raw-token-value-with-special-chars-!@#';

      await Pushbullet.sendFunction({
        credentials: { token: rawToken },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toMatchObject({ 'Access-Token': rawToken });
    });
  });

  describe('sendFunction — payload body', () => {
    test('sends the notification title as "title" in the payload', async () => {
      const title = 'Media Tracker: Episode Released';

      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title, body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ title });
    });

    test('sends the plainText body as "body" in the payload', async () => {
      const body = buildFormattedNotification({ plainText: 'Breaking Bad S05E16 Felina is now available' });

      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title: 'Test', body },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ body: body.plainText });
    });

    test('sets the push type to "note"', async () => {
      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ type: 'note' });
    });

    test('sends a complete, correctly-shaped payload', async () => {
      const title = 'Complete Payload Test';
      const body = buildFormattedNotification({ plainText: 'This is the plain text content' });

      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title, body },
      });

      const [, payload, config] = mockedAxios.post.mock.calls[0];

      expect(payload).toEqual({
        body: body.plainText,
        title,
        type: 'note',
      });

      expect(config?.headers).toEqual({ 'Access-Token': accessToken });
    });

    test('does not include markdown or html as the payload body', async () => {
      const body = buildFormattedNotification({
        plainText: 'only this',
        markdown: 'not this',
        html: 'not this either',
      });

      await Pushbullet.sendFunction({
        credentials: { token: accessToken },
        content: { title: 'Test', body },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect((payload as any).body).toBe(body.plainText);
      expect((payload as any).body).not.toBe(body.markdown);
    });
  });

  describe('sendFunction — error handling', () => {
    test('resolves successfully when axios.post resolves', async () => {
      await expect(
        Pushbullet.sendFunction({
          credentials: { token: accessToken },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects with an HTTP error', async () => {
      const httpError = Object.assign(new Error('Request failed with status code 401'), {
        response: { status: 401 },
      });
      mockedAxios.post.mockRejectedValueOnce(httpError);

      await expect(
        Pushbullet.sendFunction({
          credentials: { token: 'invalid-token' },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('401');
    });

    test('propagates the error when axios.post rejects with a network error', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      await expect(
        Pushbullet.sendFunction({
          credentials: { token: accessToken },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Network Error');
    });
  });
});
