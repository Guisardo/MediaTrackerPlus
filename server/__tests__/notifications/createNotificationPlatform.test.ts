import { createNotificationPlatform } from 'src/notifications/createNotificationPlatform';
import { FormattedNotification } from 'src/notifications/notificationFormatter';

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

describe('createNotificationPlatform factory', () => {
  describe('platform name', () => {
    test('returns an object with the provided name', () => {
      const platform = createNotificationPlatform({
        name: 'MyPlatform',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.name).toBe('MyPlatform');
    });

    test('preserves the exact case of the name string', () => {
      const platform = createNotificationPlatform({
        name: 'Discord',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.name).toBe('Discord');
    });

    test('preserves lowercase names', () => {
      const platform = createNotificationPlatform({
        name: 'gotify',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.name).toBe('gotify');
    });
  });

  describe('credentialNames (array variant)', () => {
    test('returns the credentialNames array when provided', () => {
      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        credentialNames: <const>['url', 'token', 'priority'],
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialNames).toEqual(['url', 'token', 'priority']);
    });

    test('returns credentialNames with a single entry', () => {
      const platform = createNotificationPlatform({
        name: 'SingleCredPlatform',
        credentialNames: <const>['url'],
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialNames).toEqual(['url']);
    });

    test('returns credentialName as undefined when credentialNames is provided', () => {
      const platform = createNotificationPlatform({
        name: 'ArrayCredPlatform',
        credentialNames: <const>['url', 'token'],
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialName).toBeUndefined();
    });
  });

  describe('credentialName (singular variant)', () => {
    test('returns the credentialName string when provided', () => {
      const platform = createNotificationPlatform({
        name: 'TokenPlatform',
        credentialName: 'token',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialName).toBe('token');
    });

    test('returns credentialNames as undefined when singular credentialName is provided', () => {
      const platform = createNotificationPlatform({
        name: 'TokenPlatform',
        credentialName: 'key',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialNames).toBeUndefined();
    });
  });

  describe('no credentials variant', () => {
    test('returns credentialNames as undefined when neither variant is provided', () => {
      const platform = createNotificationPlatform({
        name: 'NoCredPlatform',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platform.credentialNames).toBeUndefined();
      expect(platform.credentialName).toBeUndefined();
    });
  });

  describe('sendFunction', () => {
    test('returns the exact sendFunction reference provided', () => {
      const sendFn = jest.fn().mockResolvedValue(undefined);

      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        sendFunction: sendFn,
      });

      expect(platform.sendFunction).toBe(sendFn);
    });

    test('invokes sendFunction with the credentials and content when called', async () => {
      const sendFn = jest.fn().mockResolvedValue(undefined);
      const body = buildFormattedNotification();
      const credentials = { url: 'https://example.com', token: 'abc' };

      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        credentialNames: <const>['url', 'token'],
        sendFunction: sendFn,
      });

      await platform.sendFunction({ credentials, content: { title: 'Hello', body } });

      expect(sendFn).toHaveBeenCalledTimes(1);
      expect(sendFn).toHaveBeenCalledWith({
        credentials,
        content: { title: 'Hello', body },
      });
    });

    test('passes the content title unmodified to sendFunction', async () => {
      const sendFn = jest.fn().mockResolvedValue(undefined);
      const title = 'My Notification Title';
      const body = buildFormattedNotification();

      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        sendFunction: sendFn,
      });

      await platform.sendFunction({ credentials: {} as never, content: { title, body } });

      const calledWith = sendFn.mock.calls[0][0];
      expect(calledWith.content.title).toBe(title);
    });

    test('passes the full FormattedNotification body unmodified to sendFunction', async () => {
      const sendFn = jest.fn().mockResolvedValue(undefined);
      const body = buildFormattedNotification({
        plainText: 'plain',
        markdown: 'markdown',
        html: '<em>html</em>',
        BBCode: '[i]bbcode[/i]',
      });

      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        sendFunction: sendFn,
      });

      await platform.sendFunction({ credentials: {} as never, content: { title: 'Title', body } });

      const calledWith = sendFn.mock.calls[0][0];
      expect(calledWith.content.body).toEqual(body);
    });

    test('propagates a rejection from sendFunction', async () => {
      const sendFn = jest.fn().mockRejectedValue(new Error('send failed'));
      const body = buildFormattedNotification();

      const platform = createNotificationPlatform({
        name: 'FailingPlatform',
        sendFunction: sendFn,
      });

      await expect(
        platform.sendFunction({ credentials: {} as never, content: { title: 'Test', body } })
      ).rejects.toThrow('send failed');
    });

    test('can be called multiple times independently', async () => {
      const sendFn = jest.fn().mockResolvedValue(undefined);
      const body = buildFormattedNotification();

      const platform = createNotificationPlatform({
        name: 'TestPlatform',
        sendFunction: sendFn,
      });

      await platform.sendFunction({ credentials: {} as never, content: { title: 'First', body } });
      await platform.sendFunction({ credentials: {} as never, content: { title: 'Second', body } });

      expect(sendFn).toHaveBeenCalledTimes(2);
      expect(sendFn.mock.calls[0][0].content.title).toBe('First');
      expect(sendFn.mock.calls[1][0].content.title).toBe('Second');
    });
  });

  describe('return shape', () => {
    test('returned object has exactly the expected keys', () => {
      const platform = createNotificationPlatform({
        name: 'ShapeTest',
        credentialNames: <const>['url'],
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(Object.keys(platform).sort()).toEqual(
        ['credentialName', 'credentialNames', 'name', 'sendFunction'].sort()
      );
    });

    test('different platform instances are independent objects', () => {
      const platformA = createNotificationPlatform({
        name: 'PlatformA',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      const platformB = createNotificationPlatform({
        name: 'PlatformB',
        sendFunction: jest.fn().mockResolvedValue(undefined),
      });

      expect(platformA).not.toBe(platformB);
      expect(platformA.name).not.toBe(platformB.name);
    });
  });

  describe('real platform integrations via factory', () => {
    /**
     * These tests verify that the actual platform singletons (Discord, gotify, etc.)
     * are consistent with what createNotificationPlatform produces — without making
     * any HTTP calls.
     */
    test('Discord platform has the correct factory-produced shape', async () => {
      const { Discord } = await import('src/notifications/platforms/discord');

      expect(Discord.name).toBe('Discord');
      expect(Discord.credentialNames).toEqual(['url']);
      expect(Discord.credentialName).toBeUndefined();
      expect(typeof Discord.sendFunction).toBe('function');
    });

    test('gotify platform has the correct factory-produced shape', async () => {
      const { gotify } = await import('src/notifications/platforms/gotify');

      expect(gotify.name).toBe('gotify');
      expect(gotify.credentialNames).toEqual(['url', 'token', 'priority']);
      expect(gotify.credentialName).toBeUndefined();
      expect(typeof gotify.sendFunction).toBe('function');
    });

    test('ntfy platform has the correct factory-produced shape', async () => {
      const { ntfy } = await import('src/notifications/platforms/ntfy');

      expect(ntfy.name).toBe('ntfy');
      expect(ntfy.credentialNames).toEqual(['topic', 'url', 'priority']);
      expect(ntfy.credentialName).toBeUndefined();
      expect(typeof ntfy.sendFunction).toBe('function');
    });

    test('Pushbullet platform has the correct factory-produced shape', async () => {
      const { Pushbullet } = await import('src/notifications/platforms/pushbullet');

      expect(Pushbullet.name).toBe('Pushbullet');
      expect(Pushbullet.credentialName).toBe('token');
      expect(Pushbullet.credentialNames).toBeUndefined();
      expect(typeof Pushbullet.sendFunction).toBe('function');
    });

    test('Pushover platform has the correct factory-produced shape', async () => {
      const { Pushover } = await import('src/notifications/platforms/pushover');

      expect(Pushover.name).toBe('Pushover');
      expect(Pushover.credentialName).toBe('key');
      expect(Pushover.credentialNames).toBeUndefined();
      expect(typeof Pushover.sendFunction).toBe('function');
    });

    test('Pushsafer platform has the correct factory-produced shape', async () => {
      const { Pushsafer } = await import('src/notifications/platforms/pushsafer');

      expect(Pushsafer.name).toBe('Pushsafer');
      expect(Pushsafer.credentialName).toBe('key');
      expect(Pushsafer.credentialNames).toBeUndefined();
      expect(typeof Pushsafer.sendFunction).toBe('function');
    });
  });
});
