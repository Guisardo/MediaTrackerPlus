import React, { FunctionComponent, useCallback, useRef, useState, useEffect } from 'react';

/**
 * FacetSection wraps an individual facet dimension in a collapsible accordion
 * section with keyboard navigation and correct ARIA roles.
 *
 * Uses native HTML elements and React state instead of @radix-ui/react-collapsible
 * to avoid React 17 compatibility issues with Radix's jsx-runtime usage.
 *
 * The section starts collapsed by default but auto-expands when hasActiveSelection
 * is true so users can see which filters are currently active.
 *
 * Accessibility:
 *   - The trigger button uses aria-expanded and aria-controls.
 *   - The content region uses role="region" and aria-labelledby.
 *   - Keyboard: Enter/Space toggles the section (native button behaviour).
 */
export const FacetSection: FunctionComponent<{
  title: string;
  hasActiveSelection?: boolean;
  children: React.ReactNode;
}> = ({ title, hasActiveSelection = false, children }) => {
  const [open, setOpen] = useState(hasActiveSelection);
  const idRef = useRef<string>(`facet-section-${Math.random().toString(36).slice(2, 8)}`);
  const triggerId = `${idRef.current}-trigger`;
  const contentId = `${idRef.current}-content`;

  // Auto-expand when a selection becomes active (e.g. restored from URL on page load).
  useEffect(() => {
    if (hasActiveSelection) {
      setOpen(true);
    }
  }, [hasActiveSelection]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div data-state={open ? 'open' : 'closed'}>
      <button
        id={triggerId}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center justify-between w-full py-2 px-3 text-sm font-medium text-left text-gray-800 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!open}
      >
        {open && <div className="px-3 pb-3">{children}</div>}
      </div>
    </div>
  );
};
