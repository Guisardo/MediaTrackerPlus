import React, { FunctionComponent, useEffect } from 'react';
import { Trans } from '@lingui/macro';

import { Portal } from 'src/components/Portal';
import { UseFacetsResult } from 'src/hooks/facets';

/**
 * FacetDrawer renders the full FacetPanel content inside a bottom sheet drawer
 * on screens < 1024px.  It is mounted via Portal so it sits above all other
 * content in the DOM tree.
 *
 * The drawer has:
 *   - position:fixed bottom:0 left:0 right:0 with high z-index
 *   - A draggable-looking handle bar at the top for visual affordance
 *   - A Close button in the header row
 *   - A semi-transparent backdrop that closes the drawer on tap
 *   - An overflow-y:auto scrollable content area for long facet lists
 *
 * No animated transitions are required for this story (functional-only;
 * animation is deferred to a later enhancement).
 */
export const FacetDrawer: FunctionComponent<{
  isOpen: boolean;
  onClose: () => void;
  facets: UseFacetsResult;
  children?: React.ReactNode;
}> = ({ isOpen, onClose, facets, children }) => {
  const { activeFacetCount, clearAllFacets } = facets;

  // Prevent body scroll while the drawer is open.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      {/* Backdrop — tapping closes the drawer */}
      <div
        className="fixed inset-0 z-40 bg-black bg-opacity-40"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Bottom sheet drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[80vh] rounded-t-xl bg-white dark:bg-slate-800 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
      >
        {/* Visual drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600" />
        </div>

        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-slate-700">
          <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            <Trans>Filters</Trans>
          </span>
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
              className="flex items-center justify-center w-7 h-7 rounded text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Close filters"
            >
              <span className="material-icons text-base" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable content area — same accordion sections as desktop sidebar */}
        <div className="flex-1 overflow-y-auto py-1">{children}</div>
      </div>
    </Portal>
  );
};
