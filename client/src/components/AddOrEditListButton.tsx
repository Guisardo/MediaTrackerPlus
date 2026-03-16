import React, { FunctionComponent, useState, useRef } from 'react';
import { Trans, t } from '@lingui/macro';
import { ListPrivacy, ListSortBy, ListSortOrder } from 'mediatracker-api';

import { mediaTrackerApi } from 'src/api/api';
import { useLists } from 'src/api/lists';
import { useUser } from 'src/api/user';
import { Modal } from 'src/components/Modal';
import {
  useListPrivacyKeys,
  useListSortByKeys,
  useSortOrderKeys,
} from 'src/hooks/translations';
import { listDescription, listName } from 'src/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { Confirm } from 'src/components/Confirm';
import { Button } from 'src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/ui/select';

const AddOrEditListButton: FunctionComponent<{
  list?: {
    id: number;
    name: string;
    description?: string;
    sortBy?: ListSortBy;
    sortOrder?: ListSortOrder;
    isWatchlist: boolean;
    privacy: ListPrivacy;
  };
}> = (props) => {
  const { list } = props;

  return (
    <Modal
      openModal={(openModal) => (
        <Button variant="outline" onClick={() => openModal()}>
          {list ? <Trans>Edit list</Trans> : <Trans>Add list</Trans>}
        </Button>
      )}
    >
      {(closeModal) => (
        <AddOrEditListModal closeModal={closeModal} list={list} />
      )}
    </Modal>
  );
};

const AddOrEditListModal: FunctionComponent<{
  closeModal: () => void;
  list?: {
    id: number;
    name: string;
    description?: string;
    sortBy?: ListSortBy;
    sortOrder?: ListSortOrder;
    isWatchlist: boolean;
    privacy: ListPrivacy;
  };
}> = (props) => {
  const { closeModal, list } = props;

  const { user } = useUser();
  const userId = user?.id;
  const { lists, invalidateListsQuery } = useLists({ userId: userId ?? 0 });

  const [name, setName] = useState(listName(list) || '');
  const [description, setDescription] = useState(listDescription(list) || '');
  const [privacy, setPrivacy] = useState<ListPrivacy>(
    list?.privacy || 'private'
  );
  const [sortBy, setSortBy] = useState<ListSortBy>(
    list?.sortBy || 'recently-watched'
  );
  const [sortOrder, setSortOrder] = useState<ListSortOrder>(
    list?.sortOrder || 'desc'
  );

  const listSortByKeys = useListSortByKeys();
  const listPrivacyKeys = useListPrivacyKeys();
  const sortOrderKeys = useSortOrderKeys();
  const location = useLocation();
  const navigate = useNavigate();

  const nameRef = useRef<HTMLInputElement>(null);

  const edit = Boolean(list);

  return (
    <form
      className="p-3 w-96"
      onSubmit={async (e) => {
        e.preventDefault();

        if (
          lists?.find(
            (value) => value.name === name && value.name !== list?.name
          )
        ) {
          nameRef.current?.setCustomValidity(
            t`There already exists a list with name "${name}"`
          );
          nameRef.current?.reportValidity();
        } else {
          if (edit && list) {
            await mediaTrackerApi.list.updateList({
              id: list.id,
              name,
              description,
              privacy,
              sortBy,
              sortOrder,
            });
          } else {
            if (userId == null) {
              return;
            }

            await mediaTrackerApi.list.addList({
              name,
              description,
              privacy,
              sortBy,
              sortOrder,
            });
          }
          invalidateListsQuery();
          closeModal();
        }
      }}
    >
      <div className="text-2xl">
        {edit ? <Trans>Edit list</Trans> : <Trans>New list</Trans>}
      </div>

      <label className="flex flex-col pt-2">
        <Trans>Name</Trans>:
        <input
          value={name}
          ref={nameRef}
          disabled={list?.isWatchlist}
          onChange={(e) => {
            setName(e.currentTarget?.value);
            e.currentTarget?.setCustomValidity('');
          }}
          required
        />
      </label>

      <label className="flex flex-col pt-2">
        <Trans>Description</Trans>:
        <textarea
          value={description}
          onChange={(e) => setDescription(e.currentTarget?.value)}
          disabled={list?.isWatchlist}
          rows={4}
        />
      </label>

      <div className="flex flex-col pt-2">
        <label id="privacy-label"><Trans>Privacy</Trans>:</label>
        <Select
          value={privacy}
          onValueChange={(value) => setPrivacy(value as ListPrivacy)}
        >
          <SelectTrigger aria-labelledby="privacy-label" aria-label={t`Privacy`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listPrivacyKeys.map((key, translation) => (
              <SelectItem value={key} key={key}>
                {translation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col pt-2">
        <label id="sort-by-label"><Trans>Sort by</Trans>:</label>
        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as ListSortBy)}
        >
          <SelectTrigger aria-labelledby="sort-by-label" aria-label={t`Sort by`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {listSortByKeys.map((key, translation) => (
              <SelectItem value={key} key={key}>
                {translation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col pt-2">
        <label id="sort-order-label"><Trans>Sort order</Trans>:</label>
        <Select
          value={sortOrder}
          onValueChange={(value) => setSortOrder(value as ListSortOrder)}
        >
          <SelectTrigger aria-labelledby="sort-order-label" aria-label={t`Sort order`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOrderKeys.map((key, translation) => (
              <SelectItem value={key} key={key}>
                {translation}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-row mt-4">
        <Button variant="default">
          {edit ? <Trans>Save list</Trans> : <Trans>Add list</Trans>}
        </Button>

        {edit && !list?.isWatchlist && (
          <Button
            variant="destructive"
            className="ml-2"
            onClick={async () => {
              if (!list) {
                return;
              }

              if (
                await Confirm(
                  t`Do you really want to remove list "${list.name}"`
                )
              ) {
                await mediaTrackerApi.list.deleteList({ listId: list.id });

                closeModal();

                if (location.pathname.startsWith('/list/')) {
                  navigate('/lists', {
                    replace: true,
                  });
                }

                invalidateListsQuery();
              }
            }}
          >
            <Trans>Delete list</Trans>
          </Button>
        )}

        <Button variant="outline" className="ml-auto" onClick={() => closeModal()}>
          Close
        </Button>
      </div>
    </form>
  );
};

export const AddListButton: FunctionComponent = AddOrEditListButton;

export const EditListButton: FunctionComponent<{
  list: {
    id: number;
    name: string;
    description?: string;
    sortBy?: ListSortBy;
    sortOrder?: ListSortOrder;
    isWatchlist: boolean;
    privacy: ListPrivacy;
  };
}> = AddOrEditListButton;
