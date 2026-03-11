import React, { useEffect, useState } from 'react';
import { t } from '@lingui/macro';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';

import { MediaItemOrderBy } from 'mediatracker-api';
import { useUserGroups } from 'src/api/groups';

const ALL_USERS_LABEL = 'All Users';

/**
 * useGroupSelectorComponent — hook that renders a group selector dropdown
 * next to the sort order component, visible only when:
 *   1. orderBy === 'platformRecommended', AND
 *   2. The user belongs to at least one group.
 *
 * Selecting a group adds groupId=<id> to URL search params and triggers
 * handleFilterChange so the parent re-fetches items.
 *
 * Selecting 'All Users' removes the groupId param from the URL.
 *
 * When orderBy changes away from 'platformRecommended', the groupId param is
 * automatically removed via a useEffect watching the orderBy value.
 *
 * Stale groupId params (for groups the user is no longer a member of) are
 * silently cleared on render, falling back to 'All Users'.
 */
export const useGroupSelectorComponent = (args: {
  orderBy: MediaItemOrderBy;
  handleFilterChange: () => void;
}) => {
  const { orderBy, handleFilterChange } = args;
  const { groups, isLoading } = useUserGroups();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMenu, setShowMenu] = useState(false);

  // Determine the groupId from URL params (validated against actual membership).
  const rawGroupId = searchParams.get('groupId');
  const parsedGroupId = rawGroupId !== null ? Number(rawGroupId) : undefined;

  // Validate: is the groupId in the URL actually in the user's group list?
  const isValidGroupId =
    parsedGroupId !== undefined &&
    !isNaN(parsedGroupId) &&
    groups !== undefined &&
    groups.some((g) => g.id === parsedGroupId);

  const selectedGroupId = isValidGroupId ? parsedGroupId : undefined;

  // If there's a stale groupId in the URL (not in user's groups), clean it up.
  useEffect(() => {
    if (
      rawGroupId !== null &&
      !isLoading &&
      groups !== undefined &&
      !isValidGroupId
    ) {
      setSearchParams(
        Object.fromEntries(
          Array.from(searchParams.entries()).filter(
            ([name]) => name !== 'groupId'
          )
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawGroupId, isLoading, isValidGroupId]);

  // When orderBy changes away from platformRecommended, remove the groupId
  // param so stale group scoping doesn't affect other sort orders.
  useEffect(() => {
    if (orderBy !== 'platformRecommended' && searchParams.has('groupId')) {
      setSearchParams(
        Object.fromEntries(
          Array.from(searchParams.entries()).filter(
            ([name]) => name !== 'groupId'
          )
        )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy]);

  const selectGroup = (groupId: number | undefined) => {
    setShowMenu(false);
    handleFilterChange();

    if (groupId === undefined) {
      // "All Users" selected — remove groupId from URL params.
      setSearchParams(
        Object.fromEntries(
          Array.from(searchParams.entries()).filter(
            ([name]) => name !== 'groupId'
          )
        )
      );
    } else {
      setSearchParams({
        ...Object.fromEntries(searchParams.entries()),
        groupId: String(groupId),
      });
    }
  };

  // Determine display label for the currently selected value.
  const selectedGroupName =
    selectedGroupId !== undefined
      ? groups?.find((g) => g.id === selectedGroupId)?.name ?? ALL_USERS_LABEL
      : ALL_USERS_LABEL;

  // Whether the dropdown should be rendered at all.
  const shouldShow =
    orderBy === 'platformRecommended' &&
    !isLoading &&
    groups !== undefined &&
    groups.length > 0;

  const GroupSelectorComponent = () => {
    if (!shouldShow) {
      return null;
    }

    return (
      <div
        className="relative ml-2 cursor-pointer select-none"
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
      >
        <div className="flex cursor-pointer select-none">
          <span className="material-icons">group</span>&nbsp;
          {selectedGroupName}
        </div>

        {showMenu && (
          <ul
            className="absolute right-0 z-10 transition-all rounded shadow-lg shadow-black bg-zinc-100 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            {/* "All Users" option */}
            <li
              key="all-users"
              className={clsx(
                'px-2 py-1 rounded hover:bg-red-700 whitespace-nowrap',
                selectedGroupId === undefined && 'dark:bg-slate-700 bg-zinc-300'
              )}
              onClick={() => selectGroup(undefined)}
            >
              {t`All Users`}
            </li>

            {/* Individual group options */}
            {(groups ?? []).map((group) => (
              <li
                key={group.id}
                className={clsx(
                  'px-2 py-1 rounded hover:bg-red-700 whitespace-nowrap',
                  selectedGroupId === group.id && 'dark:bg-slate-700 bg-zinc-300'
                )}
                onClick={() => selectGroup(group.id)}
              >
                {group.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return {
    selectedGroupId,
    GroupSelectorComponent,
  };
};
