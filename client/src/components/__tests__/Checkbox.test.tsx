import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckboxWithTitleAndDescription } from '../Checkbox';

describe('CheckboxWithTitleAndDescription', () => {
  it('renders the title', () => {
    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={false}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByText('Enable notifications')).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        description="Receive email alerts for new releases"
        checked={false}
        onChange={jest.fn()}
      />
    );

    expect(
      screen.getByText('Receive email alerts for new releases')
    ).toBeInTheDocument();
  });

  it('does not render the description when omitted', () => {
    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={false}
        onChange={jest.fn()}
      />
    );

    expect(
      screen.queryByText('Receive email alerts for new releases')
    ).not.toBeInTheDocument();
  });

  it('reflects the checked state on the input', () => {
    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={true}
        onChange={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('reflects the unchecked state on the input', () => {
    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={false}
        onChange={jest.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('calls onChange with true when unchecked checkbox is clicked', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={false}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange with false when checked checkbox is clicked', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    render(
      <CheckboxWithTitleAndDescription
        title="Enable notifications"
        checked={true}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
