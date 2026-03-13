/**
 * Tests for YearSelector component in src/pages/Statistics.tsx.
 *
 * Verifies shadcn/ui Select integration:
 *  - Correct initial value displayed in the trigger
 *  - Selecting a new option calls onYearChange with the correct value
 *  - Special values (noyear, allYear) are mapped to their IDs correctly
 *
 * Radix UI Select is mocked to render options directly in the DOM.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Mock radix-ui Select primitives for jsdom compatibility.
 * Renders options directly in the DOM so tests can interact without
 * pointer event requirements.
 */
jest.mock('radix-ui', () => {
  const React = require('react');

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const SelectContext = React.createContext({ value: '', onChange: (_v: string): void => {} });

  const Root = ({ children, value, onValueChange, defaultValue }: any) => {
    const [internalValue, setInternalValue] = React.useState(
      value ?? defaultValue ?? ''
    );

    React.useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);

    const handleChange = (newVal: string) => {
      setInternalValue(newVal);
      onValueChange?.(newVal);
    };

    return (
      <SelectContext.Provider value={{ value: internalValue, onChange: handleChange }}>
        <div data-radix-select-root>{children}</div>
      </SelectContext.Provider>
    );
  };

  const Trigger = React.forwardRef(
    (
      {
        children,
        'aria-label': ariaLabel,
        ...props
      }: any,
      ref: any
    ) => (
      <button ref={ref} role="combobox" aria-label={ariaLabel} {...props}>
        {children}
      </button>
    )
  );

  const Value = ({ placeholder }: any) => {
    const { value } = React.useContext(SelectContext);
    return (
      <span data-testid="select-value">{value || placeholder || ''}</span>
    );
  };

  const Icon = ({ children }: any) => <>{children}</>;
  const Portal = ({ children }: any) => <>{children}</>;

  const Content = ({ children }: any) => <div>{children}</div>;

  const Viewport = ({ children }: any) => <div>{children}</div>;

  const Item = React.forwardRef(
    ({ children, value, ...props }: any, ref: any) => {
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
    }
  );

  const ItemText = ({ children }: any) => <span>{children}</span>;
  const ItemIndicator = ({ children }: any) => <>{children}</>;
  const ScrollUpButton = ({ children }: any) => <>{children}</>;
  const ScrollDownButton = ({ children }: any) => <>{children}</>;
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

import { YearSelector, noyear, allYear } from 'src/pages/Statistics';

const YEARS = [2024, 2023, 2022, noyear().text, allYear().text];

describe('YearSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Select Year label', () => {
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={jest.fn()}
      />
    );
    expect(screen.getByText('Select Year')).toBeInTheDocument();
  });

  it('renders all year options', () => {
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={jest.fn()}
      />
    );
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts.some((t) => t?.includes('2024'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('2023'))).toBe(true);
    expect(optionTexts.some((t) => t?.includes('2022'))).toBe(true);
  });

  it('displays the correct initial value in the trigger', () => {
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={jest.fn()}
      />
    );
    // The trigger shows the currently selected value
    expect(screen.getByTestId('select-value').textContent).toBe('2024');
  });

  it('calls onYearChange with the numeric year when a year option is selected', async () => {
    const user = userEvent.setup();
    const onYearChange = jest.fn();
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={onYearChange}
      />
    );
    const option2023 = screen.getByRole('option', { name: '2023' });
    await user.click(option2023);

    expect(onYearChange).toHaveBeenCalledTimes(1);
    expect(onYearChange).toHaveBeenCalledWith({ year: '2023' });
  });

  it('calls onYearChange with noyear.id when the "I do not remember" option is selected', async () => {
    const user = userEvent.setup();
    const onYearChange = jest.fn();
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={onYearChange}
      />
    );
    const noyearOption = screen.getByRole('option', { name: noyear().text });
    await user.click(noyearOption);

    expect(onYearChange).toHaveBeenCalledWith({ year: noyear().id });
  });

  it('calls onYearChange with null when the "All Years" option is selected', async () => {
    const user = userEvent.setup();
    const onYearChange = jest.fn();
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: '2024' }}
        onYearChange={onYearChange}
      />
    );
    const allYearsOption = screen.getByRole('option', { name: allYear().text });
    await user.click(allYearsOption);

    expect(onYearChange).toHaveBeenCalledWith({ year: null });
  });

  it('maps noyear id to display text in the trigger when noyear is selected', () => {
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: noyear().id }}
        onYearChange={jest.fn()}
      />
    );
    // When noyear.id is the current value, the trigger should display noyear.text
    expect(screen.getByTestId('select-value').textContent).toBe(noyear().text);
  });

  it('maps null year to allYear display text in the trigger', () => {
    render(
      <YearSelector
        years={YEARS}
        currentYear={{ year: null }}
        onYearChange={jest.fn()}
      />
    );
    // When year is null, display allYear.text
    expect(screen.getByTestId('select-value').textContent).toBe(allYear().text);
  });
});
