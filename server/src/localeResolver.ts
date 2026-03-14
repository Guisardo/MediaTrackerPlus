// eslint-disable-next-line @typescript-eslint/no-var-requires
const accept = require('accept');

/**
 * Resolves the best matching locale from an Accept-Language header against
 * the list of available languages configured in METADATA_LANGUAGES.
 *
 * Uses RFC 9110 Accept-Language header parsing via the `accept` package.
 *
 * @param acceptLanguageHeader - The value of the Accept-Language request header,
 *   or undefined if the header is absent.
 * @param availableLanguages - The list of language tags to match against
 *   (typically from getMetadataLanguages()).
 * @returns The matched language tag from availableLanguages, or null if no match
 *   or if the header is absent.
 */
export function resolveLocale(
  acceptLanguageHeader: string | undefined,
  availableLanguages: string[]
): string | null {
  if (!acceptLanguageHeader || availableLanguages.length === 0) {
    return null;
  }

  const matched: string = accept.language(
    acceptLanguageHeader,
    availableLanguages
  );

  if (!matched) {
    return null;
  }

  // Normalize to lowercase to match how language codes are stored in the database
  const normalized = matched.toLowerCase();

  // Verify the normalized match is actually in the available languages list
  // (it should be, but this handles edge cases from the accept package)
  const found = availableLanguages.find(
    (lang) => lang.toLowerCase() === normalized
  );

  return found ?? null;
}
