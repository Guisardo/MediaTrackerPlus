import React, { FunctionComponent, useEffect, useState } from 'react';
import { Trans } from '@lingui/macro';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { UseFacetsResult } from 'src/hooks/facets';

/**
 * FacetDrawer renders the full FacetPanel content inside a shadcn/ui Sheet.
 *
 * On desktop (≥1024px) the Sheet slides in from the right.
 * On mobile (< 1024px) the Sheet slides in from the bottom.
 *
 * The Sheet component provides its own built-in overlay, portal, focus trapping,
 * Escape key handling, and close animation — replacing the custom Portal
 * implementation used in the previous version.
 */
export const FacetDrawer: FunctionComponent<{
  isOpen: boolean;
  onClose: () => void;
  facets: UseFacetsResult;
  children?: React.ReactNode;
}> = ({ isOpen, onClose, facets, children }) => {
  const { activeFacetCount, clearAllFacets } = facets;

  // Determine sheet side based on viewport width.
  const [side, setSide] = useState<'right' | 'bottom'>('bottom');
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setSide(mq.matches ? 'right' : 'bottom');
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={side}
        showCloseButton={false}
        className={
          side === 'bottom'
            ? 'max-h-[80vh] rounded-t-xl bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800'
            : 'bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 w-80'
        }
      >
        {/* Visual drag handle — visible on mobile (bottom sheet) only */}
        {side === 'bottom' && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>
        )}

        {/* Drawer header */}
        <SheetHeader className="flex-row items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 gap-0">
          <SheetTitle className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            <Trans>Filters</Trans>
          </SheetTitle>
          <div className="flex items-center gap-3">
            {activeFacetCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  clearAllFacets();
                }}
                className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
              >
                <Trans>Clear all</Trans>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close filters"
            >
              <span className="material-icons text-base" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable content area — same accordion sections as desktop sidebar */}
        <div className="flex-1 overflow-y-auto py-1">{children}</div>
      </SheetContent>
    </Sheet>
  );
};
