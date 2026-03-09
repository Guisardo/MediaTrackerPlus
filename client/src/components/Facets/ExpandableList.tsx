import React, { FunctionComponent, useState } from 'react';
import { Trans } from '@lingui/macro';

const DEFAULT_MAX_VISIBLE = 15;

/**
 * ExpandableList wraps a list of items and shows the first `maxVisible` items
 * by default.  When the list has more items, a "Show more" / "Show less" toggle
 * button appears below the list.
 *
 * The children prop is a render-function that receives the visible slice and
 * the full list length so the parent can decide how to render items.
 */
export const ExpandableList: FunctionComponent<{
  items: unknown[];
  maxVisible?: number;
  children: (visibleItems: unknown[]) => React.ReactNode;
}> = ({ items, maxVisible = DEFAULT_MAX_VISIBLE, children }) => {
  const [expanded, setExpanded] = useState(false);

  const visibleItems = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div>
      {children(visibleItems)}
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer focus:outline-none"
        >
          {expanded ? <Trans>Show less</Trans> : <Trans>Show more</Trans>}
        </button>
      )}
    </div>
  );
};
