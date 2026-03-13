/**
 * Tests for SettingsConfigurationPage in src/pages/settings/Configuration.tsx.
 *
 * Verifies that all three shadcn/ui Select components (Server language,
 * Audible language, TMDB language) correctly:
 *  - Display the initial value from the configuration
 *  - Call the update function with the correct value when a new option is selected
 *
 * Radix UI Select is mocked to render options directly in the DOM for jsdom
 * compatibility.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Radix UI Select mock (context-based for reliable value propagation)
// ---------------------------------------------------------------------------
jest.mock('radix-ui', () => {
  const React = require('react');
  const SelectContext = React.createContext({ value: '', onChange: (_: string) => {} });

  const Root = ({ children, value, onValueChange, defaultValue }: any) => {
    const [internalValue, setInternalValue] = React.useState(value ?? defaultValue ?? '');
    React.useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);
    const handleChange = (newVal: string) => {
      setInternalValue(newVal);
      onValueChange?.(newVal);
    };
    return (
      <SelectContext.Provider value={{ value: internalValue, onChange: handleChange }}>
        <div>{children}</div>
      </SelectContext.Provider>
    );
  };

  const Trigger = React.forwardRef(({ children, 'aria-label': ariaLabel, ...props }: any, ref: any) => (
    <button ref={ref} role="combobox" aria-label={ariaLabel} {...props}>{children}</button>
  ));

  const Value = ({ placeholder }: any) => {
    const { value } = React.useContext(SelectContext);
    return <span data-testid="select-value">{value || placeholder || ''}</span>;
  };

  const Icon = ({ children }: any) => <>{children}</>;
  const Portal = ({ children }: any) => <>{children}</>;
  const Content = ({ children }: any) => <div>{children}</div>;
  const Viewport = ({ children }: any) => <div>{children}</div>;

  const Item = React.forwardRef(({ children, value, ...props }: any, ref: any) => {
    const { value: currentValue, onChange } = React.useContext(SelectContext);
    return (
      <div
        ref={ref}
        role="option"
        aria-selected={currentValue === value}
        data-value={value}
        onClick={() => onChange(value)}
        {...props}
      >
        <span>{children}</span>
      </div>
    );
  });

  const ItemText = ({ children }: any) => <span>{children}</span>;
  const ItemIndicator = () => null;
  const ScrollUpButton = () => null;
  const ScrollDownButton = () => null;
  const Group = ({ children }: any) => <div>{children}</div>;
  const Label = ({ children }: any) => <div>{children}</div>;
  const Separator = () => <hr />;

  return {
    Select: {
      Root,
      Trigger,
      Value,
      Icon,
      Portal,
      Content,
      Viewport,
      Item,
      ItemText,
      ItemIndicator,
      ScrollUpButton,
      ScrollDownButton,
      Group,
      Label,
      Separator,
    },
  };
});

// ---------------------------------------------------------------------------
// Other mocks
// ---------------------------------------------------------------------------
jest.mock('@lingui/macro', () => ({
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
  t: (strings: TemplateStringsArray, ...values: unknown[]) =>
    typeof strings === 'string'
      ? strings
      : strings.raw
      ? String.raw(strings, ...values)
      : strings[0],
}));

jest.mock('@lingui/react', () => ({
  I18nProvider: ({ children }: any) => children,
  useLingui: () => ({ i18n: { _: (id: unknown) => id } }),
  Trans: ({ children, message, id }: any) => children ?? message ?? id ?? null,
}));

const mockUpdate = jest.fn();

jest.mock('src/api/configuration', () => ({
  useConfiguration: () => ({
    configuration: {
      enableRegistration: false,
      serverLang: 'en',
      audibleLang: 'us',
      tmdbLang: 'en',
      igdbClientId: '',
      igdbClientSecret: '',
    },
    update: mockUpdate,
    isLoading: false,
  }),
}));

jest.mock('src/components/Checkbox', () => ({
  CheckboxWithTitleAndDescription: ({ title }: any) => (
    <div data-testid="checkbox">{title}</div>
  ),
}));

jest.mock('src/components/SettingsSegment', () => ({
  SettingsSegment: ({ children, title }: any) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Import component under test
// ---------------------------------------------------------------------------
import { SettingsConfigurationPage } from 'src/pages/settings/Configuration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const renderPage = () => render(<SettingsConfigurationPage />);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SettingsConfigurationPage – Server language Select', () => {
  it('displays the initial server language value', () => {
    renderPage();
    // There are multiple select-value spans; the first corresponds to Server language
    const valueSpans = screen.getAllByTestId('select-value');
    expect(valueSpans[0].textContent).toBe('en');
  });

  it('calls update with selected server language when clicked by data-value', async () => {
    const user = userEvent.setup();
    renderPage();

    // Find Server language option by its data-value attribute (unambiguous)
    const portugueseOption = document.querySelector('[data-value="pt"]');
    expect(portugueseOption).toBeInTheDocument();
    await user.click(portugueseOption!);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ serverLang: 'pt' })
    );
  });
});

describe('SettingsConfigurationPage – Audible language Select', () => {
  it('calls update with selected audible language when a new option is chosen', async () => {
    const user = userEvent.setup();
    renderPage();

    // UK (English) is unique to Audible language dropdown
    const ukOption = screen.getByRole('option', { name: 'UK (English)' });
    await user.click(ukOption);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ audibleLang: 'uk' })
    );
  });
});

describe('SettingsConfigurationPage – TMDB language Select', () => {
  it('renders TMDB language options including unique entries', () => {
    renderPage();
    // Abkhazian (ab) only appears in TMDB language list, not in Server or Audible lists
    const abkhazianOption = screen.getByRole('option', { name: 'Abkhazian' });
    expect(abkhazianOption).toBeInTheDocument();
  });

  it('calls update with selected TMDB language when a new option is chosen', async () => {
    const user = userEvent.setup();
    renderPage();

    // Arabic (ar) only appears in TMDB language list
    const arabicOption = screen.getByRole('option', { name: 'Arabic' });
    await user.click(arabicOption);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ tmdbLang: 'ar' })
    );
  });
});
