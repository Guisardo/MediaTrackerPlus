import axios from 'axios';
import { ntfy } from 'src/notifications/platforms/ntfy';
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

describe('ntfy notification platform', () => {
  const topic = 'my-media-alerts';
  const customServerUrl = 'https://ntfy.example.com';
  const defaultNtfyHost = 'https://ntfy.sh';
  const priority = '3';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 200, data: '' });
  });

  describe('platform metadata', () => {
    test('has name "ntfy"', () => {
      expect(ntfy.name).toBe('ntfy');
    });

    test('declares credentialNames as ["topic", "url", "priority"]', () => {
      expect(ntfy.credentialNames).toEqual(['topic', 'url', 'priority']);
    });

    test('has a sendFunction', () => {
      expect(typeof ntfy.sendFunction).toBe('function');
    });
  });

  describe('sendFunction — URL construction', () => {
    test('uses ntfy.sh as the base URL when no custom URL is provided', async () => {
      await ntfy.sendFunction({
        credentials: { topic, url: '', priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL(topic, defaultNtfyHost).href);
    });

    test('uses the custom server URL when one is provided', async () => {
      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL(topic, customServerUrl).href);
    });

    test('constructs endpoint as {baseUrl}/{topic}', async () => {
      const specificTopic = 'alerts-channel';

      await ntfy.sendFunction({
        credentials: { topic: specificTopic, url: customServerUrl, priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL(specificTopic, customServerUrl).href);
    });
  });

  describe('sendFunction — payload', () => {
    test('sends the plainText body as the POST body', async () => {
      const body = buildFormattedNotification({ plainText: 'Episode S01E01 is now available' });

      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority },
        content: { title: 'Test', body },
      });

      const [, sentBody] = mockedAxios.post.mock.calls[0];
      expect(sentBody).toBe(body.plainText);
    });

    test('does not send markdown or html as the POST body', async () => {
      const body = buildFormattedNotification({
        plainText: 'plain text only',
        markdown: '**this should not be sent**',
      });

      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority },
        content: { title: 'Test', body },
      });

      const [, sentBody] = mockedAxios.post.mock.calls[0];
      expect(sentBody).not.toBe(body.markdown);
      expect(sentBody).toBe(body.plainText);
    });
  });

  describe('sendFunction — headers', () => {
    test('sends the notification title in the "Title" header', async () => {
      const title = 'Media Tracker Alert';

      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority },
        content: { title, body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toMatchObject({ Title: title });
    });

    test('sends the priority in the "Priority" header', async () => {
      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority: '5' },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toMatchObject({ Priority: '5' });
    });

    test('sends the correct headers when both title and priority are present', async () => {
      const title = 'Full Header Test';

      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority: '2' },
        content: { title, body: buildFormattedNotification() },
      });

      const [, , config] = mockedAxios.post.mock.calls[0];
      expect(config?.headers).toEqual({
        Title: title,
        Priority: '2',
      });
    });
  });

  describe('sendFunction — error handling', () => {
    test('resolves successfully when axios.post resolves', async () => {
      await expect(
        ntfy.sendFunction({
          credentials: { topic, url: customServerUrl, priority },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      await expect(
        ntfy.sendFunction({
          credentials: { topic, url: customServerUrl, priority },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Network Error');
    });

    test('calls axios.post exactly once per invocation', async () => {
      await ntfy.sendFunction({
        credentials: { topic, url: customServerUrl, priority },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
