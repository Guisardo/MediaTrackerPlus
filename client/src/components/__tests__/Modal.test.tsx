/**
 * Tests for the Modal component defined in src/components/Modal.tsx.
 *
 * The component now uses shadcn/ui Dialog (backed by Radix Dialog) instead
 * of @react-spring/web animations and a custom Portal component.
 *
 * Radix Dialog is mocked to render synchronously in jsdom.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal, useOpenModalRef } from '../Modal';

// ---------------------------------------------------------------------------
// Mock radix-ui Dialog primitives — render synchronously without portals
// ---------------------------------------------------------------------------
jest.mock('radix-ui', () => {
  const React = require('react');

  const Root = ({ children, open, onOpenChange, ...rest }: any) => {
    // Store onOpenChange for child access
    return (
      <div data-testid="dialog-root" data-open={open} {...rest}>
        {React.Children.map(children, (child: React.ReactElement) => {
          if (!React.isValidElement(child)) return child;
          return React.cloneElement(child, { __open: open, __onOpenChange: onOpenChange } as any);
        })}
      </div>
    );
  };

  const Portal = ({ children }: any) => <>{children}</>;

  const Overlay = React.forwardRef(({ children, ...props }: any, ref: any) => {
    const { __open, __onOpenChange, ...rest } = props;
    return <div data-testid="dialog-overlay" ref={ref} {...rest}>{children}</div>;
  });

  const Content = React.forwardRef(({ children, __open, __onOpenChange, ...props }: any, ref: any) => {
    if (!__open) return null;
    return (
      <div data-testid="dialog-content" ref={ref} {...props}>
        {children}
      </div>
    );
  });

  const Close = React.forwardRef((props: any, ref: any) => {
    const { children, ...rest } = props;
    return <button ref={ref} {...rest}>{children}</button>;
  });

  const Trigger = React.forwardRef((props: any, ref: any) => {
    const { children, ...rest } = props;
    return <button ref={ref} {...rest}>{children}</button>;
  });

  const Title = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <h2 ref={ref} {...props}>{children}</h2>
  ));

  const Description = React.forwardRef(({ children, ...props }: any, ref: any) => (
    <p ref={ref} {...props}>{children}</p>
  ));

  return {
    Dialog: {
      Root,
      Portal,
      Overlay,
      Content,
      Close,
      Trigger,
      Title,
      Description,
    },
  };
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal child renderer: renders a close button and some content. */
const childContent = 'Modal Content';
const closeButtonLabel = 'Close modal';

const renderChildren = (closeModal: () => void) => (
  <div>
    <p>{childContent}</p>
    <button onClick={() => closeModal()} aria-label={closeButtonLabel}>
      Close
    </button>
  </div>
);

// ---------------------------------------------------------------------------
// Modal with openModal trigger (controlled via prop)
// ---------------------------------------------------------------------------

describe('Modal – trigger rendered via openModal prop', () => {
  it('does not render modal content before the trigger is clicked', () => {
    render(
      <Modal
        openModal={(open) => (
          <button onClick={open} aria-label="Open modal">
            Open
          </button>
        )}
      >
        {renderChildren}
      </Modal>
    );

    expect(screen.queryByText(childContent)).not.toBeInTheDocument();
  });

  it('renders modal content after the trigger is clicked', async () => {
    const user = userEvent.setup();

    render(
      <Modal
        openModal={(open) => (
          <button onClick={open} aria-label="Open modal">
            Open
          </button>
        )}
      >
        {renderChildren}
      </Modal>
    );

    await user.click(screen.getByLabelText('Open modal'));

    expect(screen.getByText(childContent)).toBeInTheDocument();
  });

  it('closes the modal when the close callback is called from inside', async () => {
    const user = userEvent.setup();

    render(
      <Modal
        openModal={(open) => (
          <button onClick={open} aria-label="Open modal">
            Open
          </button>
        )}
      >
        {renderChildren}
      </Modal>
    );

    await user.click(screen.getByLabelText('Open modal'));
    expect(screen.getByText(childContent)).toBeInTheDocument();

    await user.click(screen.getByLabelText(closeButtonLabel));

    await waitFor(() => {
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Modal that is open by default (no openModal prop, no openModalRef)
// ---------------------------------------------------------------------------

describe('Modal – open by default (no trigger)', () => {
  it('renders modal content immediately without any interaction', () => {
    render(<Modal>{renderChildren}</Modal>);

    expect(screen.getByText(childContent)).toBeInTheDocument();
  });

  it('closes when the inner close callback is invoked', async () => {
    const user = userEvent.setup();

    render(<Modal>{renderChildren}</Modal>);

    await user.click(screen.getByLabelText(closeButtonLabel));

    await waitFor(() => {
      expect(screen.queryByText(childContent)).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// onBeforeClosed callback
// ---------------------------------------------------------------------------

describe('Modal – onBeforeClosed callback', () => {
  it('calls onBeforeClosed with undefined when the modal is closed without a return value', async () => {
    const onBeforeClosed = jest.fn();
    const user = userEvent.setup();

    render(
      <Modal
        onBeforeClosed={onBeforeClosed}
        openModal={(open) => <button onClick={open}>Open</button>}
      >
        {renderChildren}
      </Modal>
    );

    await user.click(screen.getByText('Open'));
    await user.click(screen.getByLabelText(closeButtonLabel));

    expect(onBeforeClosed).toHaveBeenCalledTimes(1);
    expect(onBeforeClosed).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// useOpenModalRef
// ---------------------------------------------------------------------------

describe('useOpenModalRef', () => {
  it('returns a ref whose current.open() method opens the modal', async () => {
    const TestComponent = () => {
      const ref = useOpenModalRef();
      return (
        <>
          <button onClick={() => ref.current.open()} aria-label="Open via ref">
            Open via ref
          </button>
          <Modal openModalRef={ref}>{renderChildren}</Modal>
        </>
      );
    };

    const user = userEvent.setup();
    render(<TestComponent />);

    expect(screen.queryByText(childContent)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Open via ref'));

    expect(screen.getByText(childContent)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dialog-based modal renders via Radix portal (outside DOM subtree)
// ---------------------------------------------------------------------------

describe('Modal – dialog rendering', () => {
  it('renders modal content when dialog is open', async () => {
    const user = userEvent.setup();

    render(
      <div id="app-root">
        <Modal openModal={(open) => <button onClick={open}>Open</button>}>
          {renderChildren}
        </Modal>
      </div>
    );

    await user.click(screen.getByText('Open'));

    expect(screen.getByText(childContent)).toBeInTheDocument();
  });
});
