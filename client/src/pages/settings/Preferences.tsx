import React, { FunctionComponent } from 'react';
import { t } from '@lingui/macro';
import { useUser } from 'src/api/user';
import { CheckboxWithTitleAndDescription } from 'src/components/Checkbox';

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
    </>
  );
};
