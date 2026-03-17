type LanguagePreference = {
  quality: number;
  tag: string;
};

const parseAcceptLanguageHeader = (
  acceptLanguageHeader: string
): LanguagePreference[] =>
  acceptLanguageHeader
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [tagPart, ...params] = entry.split(';');
      const tag = tagPart.trim().toLowerCase();
      const qualityParam = params.find((param) =>
        param.trim().toLowerCase().startsWith('q=')
      );
      const quality = qualityParam
        ? Number(qualityParam.trim().slice(2))
        : 1;

      return {
        quality:
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
        tag,
      };
    })
    .filter(
      (preference) => preference.tag.length > 0 && preference.quality > 0
    )
    .sort((left, right) => right.quality - left.quality);

/**
 * Resolves the best matching locale from an Accept-Language header against
 * the list of available languages configured in METADATA_LANGUAGES.
 *
 * Uses RFC 9110 Accept-Language quality negotiation with exact tag matching.
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

  const normalizedLanguages = availableLanguages.map((language) => ({
    normalized: language.toLowerCase(),
    original: language,
  }));

  const preferences = parseAcceptLanguageHeader(acceptLanguageHeader);

  for (const preference of preferences) {
    if (preference.tag === '*') {
      return normalizedLanguages[0]?.original ?? null;
    }

    const matchedLanguage = normalizedLanguages.find(
      (language) => language.normalized === preference.tag
    );

    if (matchedLanguage) {
      return matchedLanguage.original;
    }
  }

  return null;
}
