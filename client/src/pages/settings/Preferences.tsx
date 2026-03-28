import React, { FunctionComponent, useState } from 'react';
import { t, Trans } from '@lingui/macro';
import { useUser } from 'src/api/user';
import { CheckboxWithTitleAndDescription } from 'src/components/Checkbox';
import { Button } from 'src/components/ui/button';
import { SettingsSegment } from 'src/components/SettingsSegment';

const DateOfBirthField: FunctionComponent<{
  value: string | null | undefined;
  onSave: (value: string | null) => void;
}> = ({ value, onSave }) => {
  const [inputValue, setInputValue] = useState(value ?? '');

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-light text-zinc-600 dark:text-zinc-400">
        <Trans>
          Your date of birth is used for age-based content filtering. This is
          self-only account data and is never shared with other users.
        </Trans>
      </p>

      <div className="flex items-center gap-2">
        <input
          type="date"
          aria-label={t`Date of birth`}
          pattern="\d{4}-\d{2}-\d{2}"
          value={inputValue}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            onSave(inputValue.trim() !== '' ? inputValue : null);
          }}
        >
          <Trans>Save</Trans>
        </Button>

        {value != null && value !== '' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setInputValue('');
              onSave(null);
            }}
          >
            <Trans>Clear</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};

export const SettingsPreferencesPage: FunctionComponent = () => {
  const { user, updateUser } = useUser();

  if (!user) {
    return <></>;
  }

  return (
    <>
      <CheckboxWithTitleAndDescription
        title={t`Public reviews`}
        description={t`Show your reviews to other users`}
        checked={user.publicReviews === true}
        onChange={(value) => updateUser({ publicReviews: value })}
      />

      <CheckboxWithTitleAndDescription
        title={t`Avoid episode spoilers`}
        description={t`Hide title of unseen episodes`}
        checked={user.hideEpisodeTitleForUnseenEpisodes === true}
        onChange={(value) =>
          updateUser({
            hideEpisodeTitleForUnseenEpisodes: value,
          })
        }
      />

      <CheckboxWithTitleAndDescription
        title={t`Avoid season spoilers`}
        description={t`Hide overview of unseen seasons`}
        checked={user.hideOverviewForUnseenSeasons === true}
        onChange={(value) =>
          updateUser({
            hideOverviewForUnseenSeasons: value,
          })
        }
      />

      <CheckboxWithTitleAndDescription
        title={t`Add recommendations to watchlist`}
        description={t`Automatically add similar items to your watchlist when you rate content`}
        checked={user.addRecommendedToWatchlist ?? true}
        onChange={(value) => updateUser({ addRecommendedToWatchlist: value })}
      />

      <SettingsSegment title={t`Age-based content filtering`}>
        <DateOfBirthField
          value={user.dateOfBirth}
          onSave={(value) => updateUser({ dateOfBirth: value })}
        />
      </SettingsSegment>
    </>
  );
};
