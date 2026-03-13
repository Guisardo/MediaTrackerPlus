import React, { FunctionComponent, useState } from 'react';
import clsx from 'clsx';
import { t, Trans } from '@lingui/macro';
import { NavLink, useLocation, useSearchParams } from 'react-router-dom';

import { useUser } from 'src/api/user';
import { useDarkMode } from 'src/hooks/darkMode';

/**
 * URL param names that should be forwarded when navigating between single-type
 * content pages (/movies, /tv, /games, /books, /audiobooks).
 *
 * Dropped on cross-type navigation (type-specific facets):
 *   - creators (source field changes: director vs creator vs author vs developer)
 *   - publishers (games-specific)
 *   - status (labels change per type)
 *   - mediaTypes (single-type pages are already scoped)
 *   - page (always reset on navigation)
 */
const CROSS_TYPE_FORWARDED_PARAMS = [
  'genres',
  'yearMin',
  'yearMax',
  'ratingMin',
  'ratingMax',
  'languages',
  'orderBy',
  'sortOrder',
] as const;

/** Routes for single-type content pages (facets-enabled, type-scoped). */
const SINGLE_TYPE_PATHS = new Set(['/tv', '/movies', '/games', '/books', '/audiobooks']);

export const useRouteNames = () => {
  return [
    { path: '/', name: t`Home` },
    { path: '/tv', name: t`Tv` },
    { path: '/movies', name: t`Movies` },
    { path: '/games', name: t`Games` },
    { path: '/books', name: t`Books` },
    { path: '/audiobooks', name: t`Audiobooks` },
    { path: '/upcoming', name: t`Upcoming` },
    { path: '/in-progress', name: t`In progress` },
    { path: '/watchlist', name: t`Watchlist` },
    { path: '/random', name: t`Random` },
    { path: '/statistics', name: t`Statistics` },
    { path: '/calendar', name: t`Calendar` },
    { path: '/import', name: t`Import` },
    { path: '/lists', name: t`Lists` },
    { path: '/groups', name: t`Groups` },
  ];
};

/**
 * Returns a function that builds the `to` prop for nav links, forwarding
 * cross-type-compatible facet params when navigating between single-type
 * content pages.
 *
 * When the current page and the destination are both single-type content pages,
 * the forwarded params (genres, yearMin, yearMax, ratingMin, ratingMax,
 * languages, orderBy, sortOrder) are preserved in the destination URL.
 * Type-specific params (creators, publishers, status, mediaTypes, page) are
 * always dropped.
 *
 * For all other navigation targets (home, watchlist, statistics, etc.), the
 * destination path is returned as-is (no param forwarding).
 */
function useCrossTypeNavTarget(): (targetPath: string) => string {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  return (targetPath: string) => {
    const isFromSingleTypePage = SINGLE_TYPE_PATHS.has(location.pathname);
    const isToSingleTypePage = SINGLE_TYPE_PATHS.has(targetPath);

    if (!isFromSingleTypePage || !isToSingleTypePage) {
      return targetPath;
    }

    // Build forwarded params by extracting only CROSS_TYPE_FORWARDED_PARAMS.
    const forwardedEntries = CROSS_TYPE_FORWARDED_PARAMS.flatMap((param) => {
      const value = searchParams.get(param);
      return value !== null ? [[param, value] as [string, string]] : [];
    });

    if (forwardedEntries.length === 0) {
      return targetPath;
    }

    const queryString = new URLSearchParams(forwardedEntries).toString();
    return `${targetPath}?${queryString}`;
  };
}

export const NavComponent: FunctionComponent = () => {
  const { user, logout } = useUser();

  const { darkMode, setDarkMode } = useDarkMode();
  const [showSidebar, setShowSidebar] = useState(false);

  const location = useLocation();
  const routes = useRouteNames();
  const getCrossTypeNavTarget = useCrossTypeNavTarget();

  return (
    <>
      {user ? (
        <>
          <nav className="flex items-center">
            <div className="hidden md:block">
              <div className="flex flex-col md:flex-row">
                {routes.map((route) => (
                  <span
                    key={route.path}
                    className="m-1 mr-2 whitespace-nowrap"
                  >
                    <NavLink
                      to={getCrossTypeNavTarget(route.path)}
                      className={({ isActive }) =>
                        clsx(
                          'text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors',
                          isActive && 'font-semibold text-zinc-900 dark:text-zinc-50 underline'
                        )
                      }
                    >
                      {route.name}
                    </NavLink>
                  </span>
                ))}
              </div>
            </div>

            <div className="md:hidden">
              <div className="flex flex-col md:flex-row">
                {routes
                  .filter((route) => route.path === location.pathname)
                  .map((route) => (
                    <span
                      key={route.path}
                      className="m-1 mr-2 text-xl whitespace-nowrap"
                    >
                      {route.name}
                    </span>
                  ))}
              </div>
            </div>

            <div className="inline-flex ml-auto mr-2 whitespace-nowrap">
              <span
                onClick={() => setDarkMode(!darkMode)}
                className="pr-2 cursor-pointer select-none material-icons"
              >
                {darkMode ? <>light_mode</> : <>mode_night</>}
              </span>
              <a href="#/settings">{user.name}</a>
              <span className="px-1">|</span>
              <a
                href="/logout"
                onClick={(e) => {
                  e.preventDefault();
                  if (confirm(t`Do you really want to logout?`)) {
                    logout();
                  }
                }}
              >
                <Trans>Logout</Trans>
              </a>
            </div>

            <span
              className="flex px-2 cursor-pointer md:hidden material-icons"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? 'menu_open' : 'menu'}
            </span>
          </nav>

          <SideBar
            showSidebar={showSidebar}
            hideSidebar={() => setShowSidebar(false)}
          />
        </>
      ) : (
        <div className="flex items-center">
          <div className="inline-flex ml-auto whitespace-nowrap">
            <span
              onClick={() => setDarkMode(!darkMode)}
              className="pt-2 pr-2 cursor-pointer select-none material-icons"
            >
              {darkMode ? <>light_mode</> : <>mode_night</>}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

const SideBar: FunctionComponent<{
  showSidebar: boolean;
  hideSidebar: () => void;
}> = (props) => {
  const { showSidebar, hideSidebar } = props;
  const routes = useRouteNames();
  const getCrossTypeNavTarget = useCrossTypeNavTarget();

  return (
    <>
      {/* Backdrop overlay – fades in/out via CSS transition */}
      <div
        className={clsx(
          'fixed top-0 bottom-0 left-0 right-0 z-10 w-full h-full bg-gray-500 transition-opacity duration-300',
          showSidebar ? 'opacity-30 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => hideSidebar()}
        aria-hidden="true"
      />

      {/* Sidebar panel – slides in from the right via CSS transition */}
      <div
        className={clsx(
          'fixed top-0 right-0 z-50 p-4 pr-10 overflow-hidden',
          'bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800',
          '-bottom-full',
          'transition-transform duration-300',
          showSidebar ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex flex-col md:flex-row">
          {routes.map((route) => (
            <span key={route.path} className="my-2 ml-1 mr-3 text-xl">
              <NavLink
                onClick={() => hideSidebar()}
                to={getCrossTypeNavTarget(route.path)}
                className={({ isActive }) =>
                  clsx(
                    'text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors',
                    isActive && 'font-semibold text-zinc-900 dark:text-zinc-50'
                  )
                }
              >
                {route.name}
              </NavLink>
            </span>
          ))}
        </div>
      </div>
    </>
  );
};
