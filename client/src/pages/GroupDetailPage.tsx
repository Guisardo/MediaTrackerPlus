import React, {
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Trans, t } from '@lingui/macro';
import { useNavigate, useParams } from 'react-router-dom';

import { GroupMemberResponse, UserGroupRole } from 'mediatracker-api';
import {
  UserSearchResult,
  searchUsers,
  useAddGroupMember,
  useDeleteGroup,
  useGroup,
  useRemoveGroupMember,
  useUpdateGroup,
  useUpdateGroupMemberRole,
} from 'src/api/groups';
import { Confirm } from 'src/components/Confirm';

// ---------------------------------------------------------------------------
// AddMemberPanel – admin-only panel for searching and adding members
// ---------------------------------------------------------------------------

/**
 * Input that searches users as you type (min 300ms debounce) and shows
 * a dropdown of results the admin can click to add.
 *
 * Excluded members (current group members) are filtered out so admins
 * cannot add a duplicate member.
 */
const AddMemberPanel: FunctionComponent<{
  groupId: number;
  existingMemberUserIds: number[];
}> = ({ groupId, existingMemberUserIds }) => {
  const { addGroupMember } = useAddGroupMember(groupId);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: fire search 300ms after the user stops typing
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const users = await searchUsers(trimmed);
        // Filter out existing members so the admin cannot re-add them
        setResults(
          users.filter((u) => !existingMemberUserIds.includes(u.id))
        );
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, existingMemberUserIds]);

  const handleAddMember = async (user: UserSearchResult) => {
    setErrorMessage(null);
    try {
      await addGroupMember({ userId: user.id, role: 'viewer' });
      // Clear the search after successfully adding
      setQuery('');
      setResults([]);
    } catch {
      setErrorMessage(t`Failed to add member. They may already be in the group.`);
    }
  };

  return (
    <div className="mt-4">
      <div className="text-sm font-semibold mb-1">
        <Trans>Add member</Trans>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder={t`Search by username…`}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          className="w-full"
          aria-label={t`Search users to add`}
        />

        {isSearching && (
          <div className="text-xs text-gray-500 mt-1">
            <Trans>Searching…</Trans>
          </div>
        )}

        {results.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-gray-900 shadow-md">
            {results.map((user) => (
              <div
                key={user.id}
                className="px-3 py-2 cursor-pointer hover:bg-zinc-200 dark:hover:bg-gray-800 text-sm"
                onClick={() => handleAddMember(user)}
                role="option"
                aria-selected={false}
              >
                {user.name}
              </div>
            ))}
          </div>
        )}

        {!isSearching && query.trim() && results.length === 0 && (
          <div className="text-xs text-gray-500 mt-1">
            <Trans>No users found</Trans>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="text-xs text-red-500 mt-1">{errorMessage}</div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MemberRow – single row in the members list
// ---------------------------------------------------------------------------

/**
 * Displays one member's name and role.
 *
 * When the current user is an admin, also shows:
 *  - a role dropdown to promote/demote the member
 *  - a Remove button (with a confirm dialog)
 */
const MemberRow: FunctionComponent<{
  member: GroupMemberResponse;
  groupId: number;
  isAdmin: boolean;
}> = ({ member, groupId, isAdmin }) => {
  const { removeGroupMember } = useRemoveGroupMember(groupId);
  const { updateGroupMemberRole } = useUpdateGroupMemberRole(groupId);

  const handleRemove = async () => {
    if (
      await Confirm(
        t`Remove ${member.name} from this group?`
      )
    ) {
      await removeGroupMember(member.userId);
    }
  };

  const handleRoleChange = async (newRole: UserGroupRole) => {
    await updateGroupMemberRole({ userId: member.userId, role: newRole });
  };

  return (
    <div className="flex items-center py-2 border-b border-zinc-200 dark:border-zinc-700 last:border-0">
      <div className="flex-1 text-sm">{member.name}</div>

      {isAdmin ? (
        <>
          <select
            value={member.role}
            onChange={(e) =>
              handleRoleChange(e.currentTarget.value as UserGroupRole)
            }
            className="text-sm mr-2"
            aria-label={t`Role for ${member.name}`}
          >
            <option value="admin">{t`Admin`}</option>
            <option value="viewer">{t`Viewer`}</option>
          </select>

          <button
            className="btn-red text-xs"
            onClick={handleRemove}
            aria-label={t`Remove ${member.name}`}
          >
            <Trans>Remove</Trans>
          </button>
        </>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {member.role === 'admin' ? <Trans>Admin</Trans> : <Trans>Viewer</Trans>}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// GroupDetailPage – main page component
// ---------------------------------------------------------------------------

/**
 * Group detail page (/groups/:groupId).
 *
 * - Fetches the group detail (name, role, members) via useGroup().
 * - Admins can: edit the group name inline (on blur), add members (search),
 *   remove members, change member roles, and delete the group.
 * - Viewers see the member list and their own role but cannot manage members.
 * - Navigates back to /groups after the group is deleted.
 */
export const GroupDetailPage: FunctionComponent = () => {
  const { groupId: groupIdParam } = useParams<{ groupId: string }>();
  const groupId = Number(groupIdParam);
  const navigate = useNavigate();

  const { group, isLoading, isError, invalidateGroupQuery } = useGroup(groupId);
  const { updateGroup } = useUpdateGroup(groupId);
  const { deleteGroup } = useDeleteGroup(groupId);

  // Inline name editing state — tracks the current value in the input
  const [editingName, setEditingName] = useState<string | null>(null);

  // Sync editingName when group data first loads
  useEffect(() => {
    if (group && editingName === null) {
      setEditingName(group.name);
    }
  }, [group, editingName]);

  const handleNameBlur = async () => {
    const trimmed = (editingName ?? '').trim();
    if (!trimmed || trimmed === group?.name) {
      // Restore original name if blank or unchanged
      setEditingName(group?.name ?? '');
      return;
    }
    try {
      await updateGroup(trimmed);
      invalidateGroupQuery();
    } catch {
      // On error restore original name
      setEditingName(group?.name ?? '');
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setEditingName(group?.name ?? '');
      e.currentTarget.blur();
    }
  };

  const handleDeleteGroup = async () => {
    if (
      await Confirm(
        t`Delete group "${group?.name}"? This action cannot be undone.`
      )
    ) {
      await deleteGroup();
      navigate('/groups', { replace: true });
    }
  };

  if (isLoading) {
    return <Trans>Loading</Trans>;
  }

  if (isError || !group) {
    return (
      <div className="text-red-500">
        <Trans>Failed to load group. It may have been deleted.</Trans>
      </div>
    );
  }

  const isAdmin = group.role === 'admin';
  const memberUserIds = group.members.map((m) => m.userId);

  return (
    <div className="max-w-xl">
      {/* Group name — editable inline by admin */}
      <div className="flex items-center mb-4">
        {isAdmin ? (
          <input
            className="text-2xl font-semibold bg-transparent border-b border-transparent hover:border-zinc-400 focus:border-zinc-500 outline-none w-full"
            value={editingName ?? group.name}
            onChange={(e) => setEditingName(e.currentTarget.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            aria-label={t`Group name`}
          />
        ) : (
          <h1 className="text-2xl font-semibold">{group.name}</h1>
        )}
      </div>

      {/* Current user's role */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Trans>Your role:</Trans>{' '}
        <span className="font-medium">
          {isAdmin ? <Trans>Admin</Trans> : <Trans>Viewer</Trans>}
        </span>
      </div>

      {/* Members list */}
      <div className="mb-4">
        <div className="text-sm font-semibold mb-2">
          <Trans>Members</Trans>
        </div>

        {group.members.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <Trans>No members yet</Trans>
          </div>
        ) : (
          group.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              groupId={groupId}
              isAdmin={isAdmin}
            />
          ))
        )}
      </div>

      {/* Add member panel — admin only */}
      {isAdmin && (
        <AddMemberPanel
          groupId={groupId}
          existingMemberUserIds={memberUserIds}
        />
      )}

      {/* Delete group button — admin only, at the bottom */}
      {isAdmin && (
        <div className="mt-8 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button className="btn-red" onClick={handleDeleteGroup}>
            <Trans>Delete group</Trans>
          </button>
        </div>
      )}
    </div>
  );
};
