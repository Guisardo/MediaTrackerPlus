/**
 * React 17 polyfill for useSyncExternalStore.
 *
 * TanStack React Query v5 uses React.useSyncExternalStore which was introduced
 * in React 18.  Since this project still runs React 17 (upgraded in US-008),
 * we patch the function onto React using the official 'use-sync-external-store'
 * shim so that Jest tests can exercise hooks that call useQuery / useMutation.
 */
const React = require('react');

if (typeof React.useSyncExternalStore !== 'function') {
  const { useSyncExternalStore } =
    require('use-sync-external-store/shim');
  React.useSyncExternalStore = useSyncExternalStore;
}
