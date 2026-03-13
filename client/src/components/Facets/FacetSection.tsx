import React, { FunctionComponent, useEffect, useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

/**
 * FacetSection wraps an individual facet dimension in a collapsible accordion
 * section with keyboard navigation and correct ARIA roles.
 *
 * Uses shadcn/ui Collapsible (Radix) for accessibility, animation, and focus
 * trapping. The section starts collapsed by default but auto-expands when
 * hasActiveSelection is true so users can see which filters are currently active.
 *
 * Accessibility:
 *   - The trigger button automatically gets aria-expanded and aria-controls.
 *   - The content region is managed by Radix Collapsible with proper ARIA.
 *   - Keyboard: Enter/Space toggles the section (Radix handles this).
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
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 text-sm font-medium text-left text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <span>{title}</span>
        {/* Chevron rotates 180° when expanded — pure CSS, no JS animation */}
        <span
          className="material-icons text-base transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          expand_more
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};
