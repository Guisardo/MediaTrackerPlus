import React, {
  useState,
  FunctionComponent,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import clsx from 'clsx';
import { useUpdateSearchParams } from './updateSearchParamsHook';

export const useMenuComponent = <T extends string>(args: {
  values: T[];
  initialSelection?: T;
  paramFilter: string;
  handleFilterChange: () => void;
}) => {
  const { values, paramFilter, initialSelection } = args;
  const { currentValue, updateSearchParams } = useUpdateSearchParams<string>({
    filterParam: paramFilter,
    initialValue: initialSelection,
    resetPage: true,
  });
  const [selectedValue, setSelectedValue] = useState(currentValue);

  useEffect(() => {
    if (selectedValue === undefined && initialSelection !== undefined) {
      setSelectedValue(initialSelection);
    }
  }, [selectedValue, initialSelection]);

  const Menu: FunctionComponent<{ children: React.ReactNode }> = (params) => {
    const { children } = params;
    const [showMenu, setShowMenu] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
      const handler = (event: MouseEvent) => {
        if (
          ref &&
          ref.current &&
          ref.current !== event.target &&
          !ref.current.contains(event.target)
        ) {
          setShowMenu(false);
        }
      };

      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
      <div className="flex select-none">
        <div
          className="relative ml-2 cursor-pointer select-none"
          ref={ref}
          onClick={() => setShowMenu(!showMenu)}
        >
          {children}
          {showMenu && (
            <ul className="absolute right-0 z-10 transition-all rounded shadow-lg shadow-black bg-zinc-100 dark:bg-gray-900">
              {values.map((value) =>
                value ? (
                  <li
                    key={value}
                    className={clsx(
                      'px-2 py-1 rounded hover:bg-red-700 whitespace-nowrap',
                      selectedValue === value && 'dark:bg-slate-700 bg-zinc-300'
                    )}
                    onClick={() => {
                      setSelectedValue(value);
                      updateSearchParams(value);
                      args.handleFilterChange();
                    }}
                  >
                    {value}
                  </li>
                ) : null
              )}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return {
    Menu: Menu,
    selectedValue: selectedValue,
  };
};
