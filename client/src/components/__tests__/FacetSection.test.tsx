import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FacetSection } from '../Facets/FacetSection';

describe('FacetSection', () => {
  it('renders the title in the trigger button', () => {
    render(
      <FacetSection title="Genre">
        <span>content</span>
      </FacetSection>
    );

    expect(screen.getByText('Genre')).toBeInTheDocument();
  });

  it('starts collapsed by default and hides children', () => {
    render(
      <FacetSection title="Genre">
        <span>content inside</span>
      </FacetSection>
    );

    expect(screen.queryByText('content inside')).not.toBeInTheDocument();
  });

  it('expands when the trigger button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <FacetSection title="Genre">
        <span>content inside</span>
      </FacetSection>
    );

    await user.click(screen.getByRole('button', { name: /genre/i }));

    expect(screen.getByText('content inside')).toBeInTheDocument();
  });

  it('collapses when the trigger is clicked a second time', async () => {
    const user = userEvent.setup();
    render(
      <FacetSection title="Genre">
        <span>content inside</span>
      </FacetSection>
    );

    const button = screen.getByRole('button', { name: /genre/i });
    await user.click(button);
    expect(screen.getByText('content inside')).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText('content inside')).not.toBeInTheDocument();
  });

  it('auto-expands when hasActiveSelection is true', () => {
    render(
      <FacetSection title="Genre" hasActiveSelection={true}>
        <span>active content</span>
      </FacetSection>
    );

    expect(screen.getByText('active content')).toBeInTheDocument();
  });

  it('sets aria-expanded on the trigger button', async () => {
    const user = userEvent.setup();
    render(
      <FacetSection title="Genre">
        <span>content</span>
      </FacetSection>
    );

    const button = screen.getByRole('button', { name: /genre/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('links trigger and content via aria-controls (Radix Collapsible)', () => {
    render(
      <FacetSection title="Genre" hasActiveSelection={true}>
        <span>content</span>
      </FacetSection>
    );

    const button = screen.getByRole('button', { name: /genre/i });
    // Radix Collapsible automatically sets aria-controls on the trigger
    const controlsId = button.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    // The content region exists in the DOM (Radix handles role and aria)
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders the expand_more chevron icon', () => {
    render(
      <FacetSection title="Genre">
        <span>content</span>
      </FacetSection>
    );

    expect(screen.getByText('expand_more')).toBeInTheDocument();
  });
});
