import React, { FunctionComponent } from 'react';
import { createRoot } from 'react-dom/client';
import { Trans } from '@lingui/macro';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';

import { Modal } from 'src/components/Modal';
import { Button } from 'src/components/ui/button';

export const Confirm = async (message: string) => {
  const portal = document.getElementById('portal');
  const node = document.createElement('div');

  portal.appendChild(node);

  return await new Promise<boolean>((resolve) => {
    const root = createRoot(node);
    root.render(
      <React.StrictMode>
        <I18nProvider i18n={i18n}>
          <Modal>
            {(closeModal) => (
              <ModalBody
                message={message}
                resolve={(res) => {
                  closeModal();
                  root.unmount();
                  portal.removeChild(node);

                  resolve(res);
                }}
              />
            )}
          </Modal>
        </I18nProvider>
      </React.StrictMode>
    );
  });
};

const ModalBody: FunctionComponent<{
  resolve: (value: boolean) => void;
  message: string;
}> = (props) => {
  const { resolve, message } = props;

  return (
    <div className="flex flex-col p-3">
      <div className="mb-2 text-xl">{message}</div>
      <div className="flex">
        <Button variant="outline" onClick={() => resolve(true)}>
          <Trans>Yes</Trans>
        </Button>
        <Button variant="outline" className="ml-auto" onClick={() => resolve(false)}>
          <Trans>No</Trans>
        </Button>
      </div>
    </div>
  );
};
