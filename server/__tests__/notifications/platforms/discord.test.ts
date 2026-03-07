import axios from 'axios';
import { Discord } from 'src/notifications/platforms/discord';
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

describe('Discord notification platform', () => {
  const validWebhookUrl = 'https://discord.com/api/webhooks/123456789/abcdef-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({ status: 204, data: '' });
  });

  describe('platform metadata', () => {
    test('has name "Discord"', () => {
      expect(Discord.name).toBe('Discord');
    });

    test('declares credentialNames as ["url"]', () => {
      expect(Discord.credentialNames).toEqual(['url']);
    });

    test('has a sendFunction', () => {
      expect(typeof Discord.sendFunction).toBe('function');
    });
  });

  describe('sendFunction', () => {
    test('calls axios.post with the webhook URL derived from credentials', async () => {
      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: {
          title: 'New Episode Released',
          body: buildFormattedNotification(),
        },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        new URL(validWebhookUrl).href,
        expect.any(Object)
      );
    });

    test('sends the markdown body as "content" in the request payload', async () => {
      const body = buildFormattedNotification({ markdown: '**Breaking Bad** Season 5 Episode 16 is available' });

      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: { title: 'Breaking Bad', body },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ content: body.markdown });
    });

    test('sends the notification title as "username" in the request payload', async () => {
      const title = 'Breaking Bad — New Episode';

      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: { title, body: buildFormattedNotification() },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toMatchObject({ username: title });
    });

    test('payload contains both "content" and "username" fields', async () => {
      const title = 'My Show';
      const body = buildFormattedNotification({ markdown: 'Episode 1 is out' });

      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: { title, body },
      });

      const [, payload] = mockedAxios.post.mock.calls[0];
      expect(payload).toEqual({
        content: body.markdown,
        username: title,
      });
    });

    test('normalises a URL with trailing slash via the URL constructor', async () => {
      const urlWithTrailingSlash = 'https://discord.com/api/webhooks/999/token/';

      await Discord.sendFunction({
        credentials: { url: urlWithTrailingSlash },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      const [calledUrl] = mockedAxios.post.mock.calls[0];
      expect(calledUrl).toBe(new URL(urlWithTrailingSlash).href);
    });

    test('resolves successfully when axios.post resolves', async () => {
      mockedAxios.post.mockResolvedValueOnce({ status: 204, data: '' });

      await expect(
        Discord.sendFunction({
          credentials: { url: validWebhookUrl },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).resolves.toBeUndefined();
    });

    test('propagates the error when axios.post rejects', async () => {
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      await expect(
        Discord.sendFunction({
          credentials: { url: validWebhookUrl },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow('Network Error');
    });

    test('throws when credentials.url is not a valid URL', async () => {
      await expect(
        Discord.sendFunction({
          credentials: { url: 'not-a-valid-url' },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow();

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('throws when credentials.url is an empty string', async () => {
      await expect(
        Discord.sendFunction({
          credentials: { url: '' },
          content: { title: 'Test', body: buildFormattedNotification() },
        })
      ).rejects.toThrow();

      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    test('sends exactly one POST request per invocation', async () => {
      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: { title: 'Test', body: buildFormattedNotification() },
      });

      await Discord.sendFunction({
        credentials: { url: validWebhookUrl },
        content: { title: 'Second call', body: buildFormattedNotification() },
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });
  });
});
