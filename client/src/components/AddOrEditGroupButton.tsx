import React, { FunctionComponent, useRef, useState } from 'react';
import { Trans } from '@lingui/macro';

import { useCreateGroup, useUserGroups } from 'src/api/groups';
import { Modal } from 'src/components/Modal';
import { Button } from 'src/components/ui/button';

/**
 * Modal form body for creating a new group.
 *
 * Validates that the group name is not empty, calls createGroup, invalidates
 * the userGroups cache, and closes the modal on success.
 */
const AddGroupModal: FunctionComponent<{ closeModal: () => void }> = (
  props
) => {
  const { closeModal } = props;

  const { createGroup } = useCreateGroup();
  const { invalidateUserGroupsQuery } = useUserGroups();

  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="p-3 w-80"
      onSubmit={async (e) => {
        e.preventDefault();

        const trimmedName = name.trim();

        if (!trimmedName) {
          nameRef.current?.setCustomValidity(
            'Group name cannot be empty'
          );
          nameRef.current?.reportValidity();
          return;
        }

        await createGroup(trimmedName);
        invalidateUserGroupsQuery();
        closeModal();
      }}
    >
      <div className="text-2xl mb-3">
        <Trans>New group</Trans>
      </div>

      <label className="flex flex-col pt-2">
        <Trans>Name</Trans>:
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            e.currentTarget.setCustomValidity('');
          }}
          required
          autoFocus
        />
      </label>

      <div className="flex flex-row mt-4">
        <Button variant="default" type="submit">
          <Trans>Create group</Trans>
        </Button>

        <Button variant="outline" className="ml-auto" onClick={() => closeModal()}>
          <Trans>Close</Trans>
        </Button>
      </div>
    </form>
  );
};

/**
 * Button that opens a modal for creating a new group.
 *
 * Rendered on the GroupsPage to let the current user create a group.
 */
export const AddGroupButton: FunctionComponent = () => {
  return (
    <Modal
      openModal={(openModal) => (
        <Button variant="outline" onClick={() => openModal()}>
          <Trans>Create group</Trans>
        </Button>
      )}
    >
      {(closeModal) => <AddGroupModal closeModal={closeModal} />}
    </Modal>
  );
};
