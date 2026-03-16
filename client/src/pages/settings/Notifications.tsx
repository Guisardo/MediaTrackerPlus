import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { t, Trans } from '@lingui/macro';
import { User } from 'mediatracker-api';
import { useNotificationPlatformsCredentials } from 'src/api/notificationPlatformsCredentials';
import { useUser } from 'src/api/user';
import { CheckboxWithTitleAndDescription } from 'src/components/Checkbox';
import { SettingsSegment } from 'src/components/SettingsSegment';
import { Button } from 'src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';

export const SettingsNotificationsPage: FunctionComponent = () => {
  const { user, updateUser } = useUser();

  if (!user) {
    return <></>;
  }

  return (
    <>
      <CheckboxWithTitleAndDescription
        title={t`Send notification for releases`}
        description={t`Receive notification for all media items on your watchlist, when they are released, including new seasons for tv shows`}
        checked={user.sendNotificationForReleases === true}
        onChange={(value) => updateUser({ sendNotificationForReleases: value })}
      />
      <CheckboxWithTitleAndDescription
        title={t`Send notification for episodes releases`}
        description={t`Receive notification for every episode for all tv shows on your watchlist, when it's released`}
        checked={user.sendNotificationForEpisodesReleases === true}
        onChange={(value) =>
          updateUser({ sendNotificationForEpisodesReleases: value })
        }
      />
      <CheckboxWithTitleAndDescription
        title={t`Send notification when status changes`}
        description={t`Receive notification for all media items on your watchlist, when its status changes`}
        checked={user.sendNotificationWhenStatusChanges === true}
        onChange={(value) =>
          updateUser({ sendNotificationWhenStatusChanges: value })
        }
      />
      <CheckboxWithTitleAndDescription
        title={t`Send notification when release date changes`}
        description={t`Receive notification for all media items on your watchlist, when its release date changes`}
        checked={user.sendNotificationWhenReleaseDateChanges === true}
        onChange={(value) =>
          updateUser({ sendNotificationWhenReleaseDateChanges: value })
        }
      />
      <CheckboxWithTitleAndDescription
        title={t`Send notification when number of seasons changes`}
        description={t`Receive notification for all tv shows on your watchlist, when its number of seasons changes`}
        checked={user.sendNotificationWhenNumberOfSeasonsChanges === true}
        onChange={(value) =>
          updateUser({ sendNotificationWhenNumberOfSeasonsChanges: value })
        }
      />
      <NotificationPlatform />

      <NotificationPlatformsCredentials
        platformName="Pushbullet"
        href="https://www.pushbullet.com"
      >
        {(extraValues) => (
          <label>
            <Trans>App token</Trans>
            {/* https://www.pushbullet.com/#settings/account */}
            <input name="token" required className="block" />
          </label>
        )}
      </NotificationPlatformsCredentials>

      <NotificationPlatformsCredentials
        platformName="Pushover"
        href="https://pushover.net"
      >
        {(extraValues) => (
          <label>
            {/* https://pushover.net */}
            <Trans> User key</Trans>
            <input name="key" required className="block" />
          </label>
        )}
      </NotificationPlatformsCredentials>

      <NotificationPlatformsCredentials
        platformName="Pushsafer"
        href="https://www.pushsafer.com"
      >
        {(extraValues) => (
          <label>
            {/* https://www.pushsafer.com/dashboard */}
            <Trans>Key</Trans>
            <input name="key" required className="block" />
          </label>
        )}
      </NotificationPlatformsCredentials>

      <NotificationPlatformsCredentials
        platformName="gotify"
        href="https://gotify.net"
        hasPriority={true}
        maxPriority={10}
      >
        {(extraValues) => (
          <>
            <label>
              <Trans>Gotify server url</Trans>
              <input name="url" type="url" required className="block" />
            </label>
            <label>
              <Trans>Access Token</Trans>
              <input name="token" required className="block" />
            </label>
          </>
        )}
      </NotificationPlatformsCredentials>

      <NotificationPlatformsCredentials
        platformName="Discord"
        href="https://discord.com"
      >
        {(extraValues) => (
          <label>
            <Trans>Webhook URL</Trans>
            <input name="url" type="url" required className="block" />
          </label>
        )}
      </NotificationPlatformsCredentials>

      <NotificationPlatformsCredentials
        platformName="ntfy"
        href="https://ntfy.sh"
        hasPriority={true}
        maxPriority={5}
      >
        {(extraValues) => (
          <>
            <label>
              <Trans>Topic</Trans>
              <input name="topic" required className="block" />
            </label>
            <label>
              <Trans>Server url (only for self hosting)</Trans>
              <input name="url" type="url" className="block" />
            </label>
          </>
        )}
      </NotificationPlatformsCredentials>
    </>
  );
};

const platforms: ReadonlyArray<
  keyof User.GetNotificationCredentials.ResponseBody
> = ['gotify', 'Discord', 'ntfy', 'Pushbullet', 'Pushover', 'Pushsafer'];

const NotificationPlatform: FunctionComponent = () => {
  const { user, updateUser } = useUser();

  if (!user) {
    return null;
  }

  return (
    <>
      <div className="flex mb-2 items-center gap-2">
        <Select
          value={user.notificationPlatform ?? undefined}
          onValueChange={(value) => {
            updateUser({
              notificationPlatform: value as never,
            });
          }}
        >
          <SelectTrigger aria-label={t`Notification platform`} className="w-fit">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((platform) => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div>
          <Trans>Platform</Trans>
        </div>
      </div>
    </>
  );
};

const NotificationPlatformsCredentials: FunctionComponent<{
  platformName: keyof User.GetNotificationCredentials.ResponseBody;
  href: string;
  hasPriority?: boolean;
  maxPriority?: number;
  children: (extraValues: Record<string, string>) => React.ReactNode;
}> = (props) => {
  const { platformName, href, hasPriority = false, maxPriority = 5 } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [priority, setPriority] = useState('');

  const {
    notificationPlatformsCredentials,
    setNotificationPlatformsCredentials,
  } = useNotificationPlatformsCredentials();

  useEffect(() => {
    if (notificationPlatformsCredentials) {
      const credentials = notificationPlatformsCredentials[platformName];

      if (!credentials || !formRef.current) {
        return;
      }

      const credentialsRecord = credentials as Record<string, string>;
      formRef.current
        .querySelectorAll<HTMLInputElement>('input')
        .forEach((input) => {
          if (input.name in credentialsRecord && !input.value) {
            input.value = credentialsRecord[input.name];
          }
        });

      if (hasPriority && 'priority' in credentials) {
        setPriority(String(credentials['priority'] || ''));
      }
    }
  }, [platformName, notificationPlatformsCredentials, hasPriority]);

  return (
    <div className="mb-2">
      <SettingsSegment title={platformName} href={href}>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();

            const credentials = Object.fromEntries(
              new FormData(e.currentTarget).entries()
            ) as Record<string, string>;

            if (hasPriority) {
              credentials['priority'] = priority;
            }

            setNotificationPlatformsCredentials({
              platformName: platformName,
              credentials: credentials,
            } as User.UpdateNotificationCredentials.RequestBody);
          }}
        >
          {props.children({})}

          {hasPriority && (
            <div className="mt-2">
              <label id={`${platformName}-priority-label`}>
                <Trans>Priority</Trans>
              </label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger
                  aria-labelledby={`${platformName}-priority-label`}
                  aria-label={t`Priority`}
                  className="mt-1"
                >
                  <SelectValue placeholder={t`Select priority`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">—</SelectItem>
                  {new Array(maxPriority).fill(null).map((_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button variant="outline" className="mt-2">
            <Trans>Save</Trans>
          </Button>
        </form>
      </SettingsSegment>
    </div>
  );
};
