import React, { FunctionComponent } from 'react';
import { Trans, Plural } from '@lingui/macro';
import { Link } from 'react-router-dom';

import { useUserGroups } from 'src/api/groups';
import { AddGroupButton } from 'src/components/AddOrEditGroupButton';

/**
 * Groups list page — shows all groups the current user belongs to with name,
 * role, and member count. Provides a "Create Group" button for creating new groups.
 * Clicking a group row navigates to the group detail page (/groups/:groupId).
 */
export const GroupsPage: FunctionComponent = () => {
  const { groups } = useUserGroups();

  if (!groups) {
    return <Trans>Loading</Trans>;
  }

  return (
    <>
      <div className="mb-3">
        <AddGroupButton />
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center mt-10 text-center text-zinc-500 dark:text-zinc-400">
          <div className="text-2xl mb-2">
            <Trans>No groups yet</Trans>
          </div>
          <div>
            <Trans>
              Create a group to share Platform Recommended results with other
              users.
            </Trans>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.id} className="mb-5">
            <div className="flex items-center my-1">
              <div className="text-xl">
                <Link to={`/groups/${group.id}`}>{group.name}</Link>
              </div>

              <div className="pl-3 text-sm text-zinc-500 dark:text-zinc-400">
                {group.role === 'admin' ? (
                  <Trans>Admin</Trans>
                ) : (
                  <Trans>Viewer</Trans>
                )}
              </div>
            </div>

            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              <Plural
                value={group.memberCount}
                one="# member"
                other="# members"
              />
            </div>
          </div>
        ))
      )}
    </>
  );
};
