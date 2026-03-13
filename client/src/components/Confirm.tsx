import React, { FunctionComponent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Trans } from '@lingui/macro';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Imperative confirmation dialog backed by shadcn/ui Dialog.
 *
 * Creates a temporary React root, renders a Dialog that resolves a Promise
 * to `true` (Yes) or `false` (No), then unmounts and cleans up.
 *
 * The Dialog component uses Radix internally which handles its own portal
 * rendering — no external `#portal` or `#modals` DOM element is needed.
 */
export const Confirm = async (message: string): Promise<boolean> => {
  const node = document.createElement('div');
  document.body.appendChild(node);

  return await new Promise<boolean>((resolve) => {
    const root = createRoot(node);

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(node);
    };

    root.render(
      <React.StrictMode>
        <I18nProvider i18n={i18n}>
          <ConfirmDialog
            message={message}
            onResolve={(value) => {
              resolve(value);
              cleanup();
            }}
          />
        </I18nProvider>
      </React.StrictMode>
    );
  });
};

const ConfirmDialog: FunctionComponent<{
  message: string;
  onResolve: (value: boolean) => void;
}> = ({ message, onResolve }) => {
  const [open, setOpen] = useState(true);

  const handleResolve = (value: boolean) => {
    setOpen(false);
    onResolve(value);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleResolve(false);
      }
    }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle><Trans>Confirm</Trans></DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleResolve(false)}>
            <Trans>No</Trans>
          </Button>
          <Button variant="default" onClick={() => handleResolve(true)}>
            <Trans>Yes</Trans>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
