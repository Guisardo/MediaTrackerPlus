import React, {
  createContext,
  FunctionComponent,
  useContext,
  useEffect,
  useState,
} from 'react';

const DarkModeContext = createContext<
  | {
      darkMode: boolean;
      setDarkMode: (value: boolean) => void;
    }
  | undefined
>(undefined);

export const DarkModeProvider: FunctionComponent<{ children: React.ReactNode }> = (props) => {
  const [darkMode, setDarkModeValue] = useState<boolean>(
    localStorage.theme === 'dark'
  );

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === 'theme') {
        setDarkMode(event.newValue === 'dark');
      }
    };

    window.addEventListener('storage', handler);

    return () => window.removeEventListener('storage', handler);
  }, []);

  const setDarkMode = (value: boolean) => {
    if (value) {
      localStorage.theme = 'dark';
      document.documentElement.classList.add('dark');
    } else {
      localStorage.theme = 'light';
      document.documentElement.classList.remove('dark');
    }

    setDarkModeValue(value);
  };

  return (
    <DarkModeContext.Provider
      value={{
        darkMode: darkMode,
        setDarkMode: setDarkMode,
      }}
    >
      {props.children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = () => {
  const context = useContext(DarkModeContext);

  if (!context) {
    throw new Error('useDarkMode must be used inside DarkModeProvider');
  }

  return context;
};
