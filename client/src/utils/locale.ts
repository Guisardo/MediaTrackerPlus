/**
 * Locale display name utility for rendering language codes as human-readable names.
 * Uses the native Intl.DisplayNames API for locale-specific language names.
 */

/**
 * Get a human-readable display name for a language code.
 * For example: 'en' → 'English', 'fr' → 'Français', 'pt-BR' → 'Português (Brasil)'
 *
 * Falls back to uppercase language code if DisplayNames is unavailable or unsupported.
 *
 * @param languageCode - ISO 639-1 language code or BCP 47 locale tag (e.g., 'en', 'pt-BR', 'es-419')
 * @returns Human-readable language name or uppercase code as fallback
 */
export function getLanguageDisplayName(languageCode: string): string {
  if (!languageCode) {
    return '';
  }

  try {
    const displayNames = new Intl.DisplayNames(['en'], {
      type: 'language',
    });
    return displayNames.of(languageCode) || languageCode.toUpperCase();
  } catch (error) {
    // Fallback for unsupported browsers or invalid language codes
    return languageCode.toUpperCase();
  }
}

/**
 * Get a human-readable display name for a language code in a specific display locale.
 * For example: with locale='fr', 'en' → 'anglais', 'fr' → 'français'
 *
 * @param languageCode - ISO 639-1 language code or BCP 47 locale tag
 * @param displayLocale - The locale for the display names (e.g., 'en', 'fr', 'es')
 * @returns Human-readable language name in the specified locale, or uppercase code as fallback
 */
export function getLanguageDisplayNameInLocale(
  languageCode: string,
  displayLocale: string
): string {
  if (!languageCode) {
    return '';
  }

  try {
    const displayNames = new Intl.DisplayNames([displayLocale], {
      type: 'language',
    });
    return displayNames.of(languageCode) || languageCode.toUpperCase();
  } catch (error) {
    // Fallback for unsupported browsers or invalid language codes
    return languageCode.toUpperCase();
  }
}
