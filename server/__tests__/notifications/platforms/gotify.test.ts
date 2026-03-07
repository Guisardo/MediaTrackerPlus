import axios from 'axios';
import { gotify } from 'src/notifications/platforms/gotify';
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

describe('gotify notification platform', () => {
  const serverUrl = 'https://gotify.example.com';
  const token = 'super-secret-token';
  const priority = '5';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 200, data: {} });
  });

  describe('platform metadata', () => {
    test('has name "gotify"', () => {
      expect(gotify.name).toBe('gotify');
    });

    test('declares credentialNames as ["url", "token", "priority"]', () => {
      expect(gotify.credentialNames).toEqual(['url', 'token', 'priority']);
    });

    test('has a sendFunction', () => {
      expect(typeof gotify.sendFunction).toBe('function');
    });
  });

  describe('sendFunction', () => {
    test('calls axios.post with the correct /message endpoint', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority },
        content: { title: 'Test Title', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL('/message', serverUrl).href);
    });

    test('appends /message to the server URL regardless of trailing slash', async () => {
      const urlWithTrailingSlash = 'https://gotify.example.com/';

      await gotify.sendFunction({
        credentials: { url: urlWithTrailingSlash, token, priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL('/message', urlWithTrailingSlash).href);
    });

    test('sends the X-Gotify-Key header with the token', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token: 'my-token-value', priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toMatchObject({ 'X-Gotify-Key': 'my-token-value' });
    });

    test('sends the notification title in the payload', async () => {
      const title = 'Episode Available';

      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority },
        content: { title, body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ title });
    });

    test('sends the markdown body as "message" in the payload', async () => {
      const body = buildFormattedNotification({ markdown: '**Breaking Bad** S05E16 is out' });

      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority },
        content: { title: 'Test', body },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ message: body.markdown });
    });

    test('sends numeric priority parsed from the priority credential string', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority: '8' },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ priority: 8 });
    });

    test('falls back to priority 5 when priority credential is not a valid number', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority: 'invalid' },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ priority: 5 });
    });

    test('falls back to priority 5 when priority credential is an empty string', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority: '' },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ priority: 5 });
    });

    test('sets contentType to "text/markdown" via the extras field', async () => {
      await gotify.sendFunction({
        credentials: { url: serverUrl, token, priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({
        extras: {
          'client::display': {
            contentType: 'text/markdown',
          },
        },
      });
    });

    test('sends a complete, correctly-shaped payload', async () => {
      const title = 'Complete Payload Test';
      const body = buildFormattedNotification({ markdown: 'Markdown content here' });

      await gotify.sendFunction({
        credentials: { url: serverUrl, token: 'tok', priority: '3' },
        content: { title, body },
      });

      const [, payload, config] = mockedAxios.post.mock.calls[0];

      expect(payload).toEqual({
        extras: {
          'client::display': {
            contentType: 'text/markdown',
          },
        },
        priority: 3,
        message: body.markdown,
        title,
      });

      expect(config?.headers).toEqual({ 'X-Gotify-Key': 'tok' });
    });

    test('resolves successfully when axios.post resolves', async () => {
      await expect(
        gotify.sendFunction({
          credentials: { url: serverUrl, token, priority },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects', async () => {
      const networkError = new Error('Connection refused');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      await expect(
        gotify.sendFunction({
          credentials: { url: serverUrl, token, priority },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Connection refused');
    });
  });
});
