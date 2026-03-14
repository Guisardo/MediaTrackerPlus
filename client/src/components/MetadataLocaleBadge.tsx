import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getLanguageDisplayName } from '@/utils/locale';

export interface MetadataLocaleBadgeProps {
  /**
   * The language code of the metadata that was served.
   * Can be a language code (e.g., 'en', 'fr') or BCP 47 tag (e.g., 'pt-BR').
   * If null or undefined, no badge or indicator is rendered.
   */
  metadataLanguage: string | null | undefined;

  /**
   * The user's active UI locale (from Lingui i18n.locale).
   * Used to determine if metadata was served in the user's preferred language.
   */
  userLocale: string;
}

/**
 * Display badge and fallback indicator for metadata language.
 *
 * Renders:
 * - A badge showing the language code's native name when metadata matches user locale
 * - A fallback indicator when metadata is in a different language than requested
 * - Nothing when metadataLanguage is null (no translations available)
 *
 * @example
 * <MetadataLocaleBadge metadataLanguage="es" userLocale="es" /> // Shows badge "Español"
 * <MetadataLocaleBadge metadataLanguage="en" userLocale="es" /> // Shows fallback indicator
 * <MetadataLocaleBadge metadataLanguage={null} userLocale="es" /> // Renders nothing
 */
export const MetadataLocaleBadge: React.FC<MetadataLocaleBadgeProps> = ({
  metadataLanguage,
  userLocale,
}) => {
  // No indicator when metadataLanguage is null
  if (!metadataLanguage) {
    return null;
  }

  // Normalize both languages to lowercase for comparison
  const normalizedMetadata = metadataLanguage.toLowerCase();
  const normalizedUser = userLocale.toLowerCase();

  // Extract base language code for comparison (e.g., 'pt' from 'pt-BR')
  const metadataBase = normalizedMetadata.split('-')[0];
  const userBase = normalizedUser.split('-')[0];

  // When metadata matches user locale, show the language badge
  if (normalizedMetadata === normalizedUser || metadataBase === userBase) {
    const displayName = getLanguageDisplayName(metadataLanguage);

    return (
      <Badge variant="secondary" className="text-xs">
        {displayName}
      </Badge>
    );
  }

  // When metadata doesn't match user locale, show fallback indicator
  const userDisplayName = getLanguageDisplayName(userLocale);
  const metadataDisplayName = getLanguageDisplayName(metadataLanguage);

  return (
    <div className="text-sm text-zinc-500 dark:text-zinc-400">
      Metadata not available in {userDisplayName}, showing {metadataDisplayName}
    </div>
  );
};

MetadataLocaleBadge.displayName = 'MetadataLocaleBadge';
