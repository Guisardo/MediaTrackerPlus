import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../ui/button';

describe('shadcn/ui Button', () => {
  describe('accessible role and rendering', () => {
    it('renders with button role by default', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders button text content', () => {
      render(<Button>Save changes</Button>);
      expect(screen.getByText('Save changes')).toBeInTheDocument();
    });

    it('renders as an anchor when using asChild with an anchor element', () => {
      render(
        <Button asChild>
          <a href="/settings">Settings</a>
        </Button>
      );
      const link = screen.getByRole('link', { name: 'Settings' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/settings');
    });
  });

  describe('variants', () => {
    it('renders default variant with correct class', () => {
      render(<Button variant="default">Default</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-primary');
    });

    it('renders destructive variant with correct class', () => {
      render(<Button variant="destructive">Delete</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-destructive');
    });

    it('renders outline variant with correct class', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('border');
    });

    it('renders secondary variant with correct class', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary');
    });

    it('renders ghost variant with correct class', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-accent');
    });

    it('renders link variant with correct class', () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('text-primary');
    });
  });

  describe('sizes', () => {
    it('renders default size', () => {
      render(<Button size="default">Default size</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-9');
    });

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10');
    });

    it('renders icon size', () => {
      render(<Button size="icon" aria-label="Search">🔍</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('size-9');
    });
  });

  describe('disabled state', () => {
    it('is disabled when disabled prop is set', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('does not call onClick when disabled', async () => {
      const onClick = jest.fn();
      const user = userEvent.setup();
      render(
        <Button disabled onClick={onClick}>
          Disabled
        </Button>
      );
      await user.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('calls onClick when clicked', async () => {
      const onClick = jest.fn();
      const user = userEvent.setup();
      render(<Button onClick={onClick}>Click me</Button>);
      await user.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('className merging', () => {
    it('merges additional className with variant classes', () => {
      render(<Button className="my-custom-class">Custom</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('my-custom-class');
      expect(button).toHaveClass('bg-primary');
    });
  });

  describe('accessibility labels', () => {
    it('accepts aria-label for icon-only buttons', () => {
      render(
        <Button size="icon" aria-label="Close dialog">
          ✕
        </Button>
      );
      expect(screen.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
    });

    it('accepts aria-describedby for additional context', () => {
      render(
        <>
          <span id="desc">Permanently removes the item</span>
          <Button aria-describedby="desc" variant="destructive">
            Delete
          </Button>
        </>
      );
      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button).toHaveAttribute('aria-describedby', 'desc');
    });
  });
});
