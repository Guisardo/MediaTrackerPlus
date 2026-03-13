import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';

export type ModalArgs<T> = {
  onClosed?: (arg?: T) => void;
  onBeforeClosed?: (arg?: T) => void;
  closeOnEscape?: boolean;
  closeOnBackgroundClick?: boolean;
};

interface OpenModalRef {
  open: () => void;
}
class OpenModalRefClass implements OpenModalRef {
  public _openModal: () => void;

  public open() {
    this._openModal && this._openModal();
  }
}

export const useOpenModalRef = () => {
  return useRef(new OpenModalRefClass() as OpenModalRef);
};

export const Modal = <ReturnType,>(props: {
  openModal?: (openModal: () => void) => React.JSX.Element;
  openModalRef?: React.MutableRefObject<OpenModalRef>;
  children: (closeModal: (arg?: ReturnType) => void) => React.JSX.Element;
  onClosed?: (arg?: ReturnType) => void;
  onBeforeClosed?: (arg?: ReturnType) => void;
  closeOnEscape?: boolean;
  closeOnBackgroundClick?: boolean;
}) => {
  const {
    onBeforeClosed,
    closeOnBackgroundClick,
    closeOnEscape,
    onClosed,
    openModalRef,
  } = {
    closeOnBackgroundClick: true,
    closeOnEscape: true,
    ...props,
  };

  const showOpen = props.openModal === undefined && openModalRef === undefined;

  const [isOpen, setIsOpen] = useState(showOpen || false);
  const returnedValueRef = useRef<ReturnType | undefined>(undefined);

  const closeModal: (arg?: ReturnType) => void = useCallback(
    (arg) => {
      onBeforeClosed && onBeforeClosed(arg);
      returnedValueRef.current = arg;
      setIsOpen(false);
    },
    [onBeforeClosed]
  );

  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    if (openModalRef?.current) {
      (openModalRef.current as OpenModalRefClass)._openModal = openModal;
    }
  }, [openModalRef, openModal]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        // Dialog is being closed externally (Escape key or overlay click).
        // Radix fires onOpenChange(false) for both; individual handlers
        // below prevent the specific events when disabled, so if we reach
        // here the close was allowed.
        onBeforeClosed && onBeforeClosed(returnedValueRef.current);
        setIsOpen(false);
      }
    },
    [onBeforeClosed]
  );

  /**
   * Radix Dialog invokes onAnimationEnd after the closing animation
   * completes.  We hook into this to fire the onClosed callback at the
   * right time (matching the previous react-spring onRest behaviour).
   */
  const handleAnimationEnd = useCallback(() => {
    if (!isOpen && onClosed) {
      onClosed(returnedValueRef.current);
      returnedValueRef.current = undefined;
    }
  }, [isOpen, onClosed]);

  return (
    <>
      {props.openModal && props.openModal(openModal)}
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          onAnimationEnd={handleAnimationEnd}
          onEscapeKeyDown={(e) => {
            if (!closeOnEscape) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            if (!closeOnBackgroundClick) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (!closeOnBackgroundClick) {
              e.preventDefault();
            }
          }}
          className="max-w-fit p-0 border-0 bg-transparent shadow-none"
        >
          <div className="rounded-lg bg-zinc-100 dark:bg-gray-900">
            {props.children(closeModal)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
