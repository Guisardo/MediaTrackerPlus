import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetadataLocaleBadge } from '../MetadataLocaleBadge';

describe('MetadataLocaleBadge', () => {
  describe('when metadataLanguage is null or undefined', () => {
    it('renders nothing when metadataLanguage is null', () => {
      const { container } = render(
        <MetadataLocaleBadge metadataLanguage={null} userLocale="en" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when metadataLanguage is undefined', () => {
      const { container } = render(
        <MetadataLocaleBadge metadataLanguage={undefined} userLocale="en" />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when metadataLanguage is empty string', () => {
      const { container } = render(
        <MetadataLocaleBadge metadataLanguage="" userLocale="en" />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('when metadataLanguage matches user locale', () => {
    it('renders badge when exact language match (en)', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="en" userLocale="en" />
      );
      const badge = screen.getByText('English');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('div')).toHaveClass('bg-secondary');
    });

    it('renders badge when exact language match (fr)', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="fr" userLocale="fr" />
      );
      expect(screen.getByText('French')).toBeInTheDocument();
    });

    it('renders badge when exact language match (es)', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="es" userLocale="es" />
      );
      expect(screen.getByText('Spanish')).toBeInTheDocument();
    });

    it('renders badge when BCP 47 language matches', () => {
      render(
        <MetadataLocaleBadge
          metadataLanguage="pt-BR"
          userLocale="pt-BR"
        />
      );
      const badge = screen.getByText(/Portuguese/);
      expect(badge).toBeInTheDocument();
      expect(badge.closest('div')).toHaveClass('bg-secondary');
    });

    it('renders badge when base language codes match despite different regions (pt vs pt-BR)', () => {
      render(
        <MetadataLocaleBadge
          metadataLanguage="pt-BR"
          userLocale="pt"
        />
      );
      const badge = screen.getByText(/Portuguese/);
      expect(badge).toBeInTheDocument();
      expect(badge.closest('div')).toHaveClass('bg-secondary');
    });

    it('renders badge when base language codes match despite different regions (pt-PT vs pt-BR)', () => {
      render(
        <MetadataLocaleBadge
          metadataLanguage="pt-BR"
          userLocale="pt-PT"
        />
      );
      const badge = screen.getByText(/Portuguese/);
      expect(badge).toBeInTheDocument();
    });

    it('is case-insensitive for comparison', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="EN" userLocale="en" />
      );
      const badge = screen.getByText('English');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('when metadataLanguage does NOT match user locale', () => {
    it('renders fallback indicator when no match (en vs fr)', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="en" userLocale="fr" />
      );
      const fallback = screen.getByText(/Metadata not available in French/);
      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveClass('text-zinc-500', 'dark:text-zinc-400');
    });

    it('includes both user locale and metadata locale names in fallback text', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="es" userLocale="de" />
      );
      const fallback = screen.getByText(/Metadata not available in German, showing Spanish/);
      expect(fallback).toBeInTheDocument();
    });

    it('renders fallback indicator when base languages differ (es vs pt-BR)', () => {
      render(
        <MetadataLocaleBadge
          metadataLanguage="pt-BR"
          userLocale="es"
        />
      );
      expect(screen.getByText(/Metadata not available in Spanish/)).toBeInTheDocument();
    });

    it('renders fallback indicator with proper text styling', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="de" userLocale="fr" />
      );
      const fallback = screen.getByText(/Metadata not available/);
      expect(fallback).toHaveClass('text-sm');
      expect(fallback).toHaveClass('text-zinc-500');
      expect(fallback).toHaveClass('dark:text-zinc-400');
    });
  });

  describe('with various language codes', () => {
    it('handles simple ISO 639-1 codes correctly', () => {
      const languageCodes = [
        'en', 'fr', 'de', 'es', 'it', 'ja', 'zh', 'ru', 'ko', 'pt',
      ];
      languageCodes.forEach((code) => {
        const { unmount, container } = render(
          <MetadataLocaleBadge
            metadataLanguage={code}
            userLocale={code}
          />
        );
        // Just verify no errors occur and badge renders
        expect(container.querySelector('div')).toBeInTheDocument();
        unmount();
      });
    });

    it('handles BCP 47 tags correctly (es-419, pt-BR, etc.)', () => {
      const { rerender } = render(
        <MetadataLocaleBadge
          metadataLanguage="es-419"
          userLocale="es"
        />
      );
      const badge = screen.getByText(/Spanish/);
      expect(badge).toBeInTheDocument();

      rerender(
        <MetadataLocaleBadge
          metadataLanguage="pt-BR"
          userLocale="pt-BR"
        />
      );
      expect(screen.getByText(/Portuguese/)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('badge has proper semantic structure', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="en" userLocale="en" />
      );
      const badge = screen.getByText('English');
      expect(badge.tagName).toBe('DIV');
    });

    it('fallback text is readable and descriptive', () => {
      render(
        <MetadataLocaleBadge metadataLanguage="fr" userLocale="en" />
      );
      const text = screen.getByText(/Metadata not available/);
      // Text should be clear and explain the situation
      expect(text.textContent).toMatch(/Metadata not available in|showing/);
    });
  });
});
