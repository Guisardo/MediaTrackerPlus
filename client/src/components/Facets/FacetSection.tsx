import React, { FunctionComponent, useState, useEffect } from 'react';
import * as Collapsible from '@radix-ui/react-collapsible';

/**
 * FacetSection wraps an individual facet dimension in a collapsible accordion
 * section.  Uses @radix-ui/react-collapsible for keyboard navigation and
 * correct ARIA roles (button triggers, region content).
 *
 * The section starts collapsed by default but auto-expands when hasActiveSelection
 * is true so users can see which filters are currently active.
 */
export const FacetSection: FunctionComponent<{
  title: string;
  hasActiveSelection?: boolean;
  children: React.ReactNode;
}> = ({ title, hasActiveSelection = false, children }) => {
  const [open, setOpen] = useState(hasActiveSelection);

  // Auto-expand when a selection becomes active (e.g. restored from URL on page load).
  useEffect(() => {
    if (hasActiveSelection) {
      setOpen(true);
    }
  }, [hasActiveSelection]);

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          className="flex items-center justify-between w-full py-2 px-3 text-sm font-medium text-left text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-expanded={open}
        >
          <span>{title}</span>
          {/* Chevron rotates 180° when expanded — pure CSS, no JS animation */}
          <span
            className="material-icons text-base transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <div className="px-3 pb-3">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};
