type LanguagePreference = {
  quality: number;
  tag: string;
};

type AvailableLanguage = {
  normalized: string;
  original: string;
};

export type MetadataLanguageResolution = {
  primary: string | null;
  candidates: string[];
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
      const quality = qualityParam ? Number(qualityParam.trim().slice(2)) : 1;

      return {
        quality:
          Number.isFinite(quality) && quality >= 0 && quality <= 1
            ? quality
            : 0,
        tag,
      };
    })
    .filter((preference) => preference.tag.length > 0 && preference.quality > 0)
    .sort((left, right) => right.quality - left.quality);

const normalizeAvailableLanguages = (
  availableLanguages: string[]
): AvailableLanguage[] =>
  availableLanguages.map((language) => ({
    normalized: language.toLowerCase(),
    original: language,
  }));

const getBaseTag = (tag: string): string =>
  tag.split('-')[0]?.trim().toLowerCase() ?? '';

const findExactLanguage = (
  tag: string,
  availableLanguages: AvailableLanguage[]
): AvailableLanguage | undefined =>
  availableLanguages.find((language) => language.normalized === tag);

const findBaseLanguage = (
  tag: string,
  availableLanguages: AvailableLanguage[]
): AvailableLanguage | undefined => {
  const baseTag = getBaseTag(tag);
  if (!baseTag || baseTag === tag) {
    return undefined;
  }

  return availableLanguages.find((language) => language.normalized === baseTag);
};

const appendUniqueLanguage = (
  target: string[],
  seen: Set<string>,
  language: string | null | undefined
): void => {
  if (!language) {
    return;
  }

  const normalized = language.toLowerCase();
  if (seen.has(normalized)) {
    return;
  }

  seen.add(normalized);
  target.push(language);
};

/**
 * Resolves the best matching locale from an Accept-Language header against
 * the list of available languages configured in METADATA_LANGUAGES.
 *
 * Uses RFC 9110 Accept-Language quality negotiation with exact tag matching,
 * then falls back from a regional tag to its non-regional base language.
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

  const normalizedLanguages = normalizeAvailableLanguages(availableLanguages);
  const preferences = parseAcceptLanguageHeader(acceptLanguageHeader);

  for (const preference of preferences) {
    if (preference.tag === '*') {
      return normalizedLanguages[0]?.original ?? null;
    }

    const exactLanguage = findExactLanguage(
      preference.tag,
      normalizedLanguages
    );
    if (exactLanguage) {
      return exactLanguage.original;
    }

    const baseLanguage = findBaseLanguage(preference.tag, normalizedLanguages);
    if (baseLanguage) {
      return baseLanguage.original;
    }
  }

  return null;
}

/**
 * Resolves the ordered metadata language candidates for translation overlays.
 *
 * For each Accept-Language preference, this helper adds:
 * 1. the exact configured locale, if present
 * 2. the non-regional base locale, if present
 *
 * After evaluating all header preferences, it appends the default configured
 * locale (the first entry in availableLanguages) as the final fallback.
 */
export function resolveMetadataLanguagePreferences(
  acceptLanguageHeader: string | undefined,
  availableLanguages: string[]
): MetadataLanguageResolution {
  if (availableLanguages.length === 0) {
    return {
      primary: null,
      candidates: [],
    };
  }

  const normalizedLanguages = normalizeAvailableLanguages(availableLanguages);
  const candidates: string[] = [];
  const seen = new Set<string>();

  if (acceptLanguageHeader) {
    const preferences = parseAcceptLanguageHeader(acceptLanguageHeader);

    for (const preference of preferences) {
      if (preference.tag === '*') {
        appendUniqueLanguage(
          candidates,
          seen,
          normalizedLanguages[0]?.original ?? null
        );
        continue;
      }

      appendUniqueLanguage(
        candidates,
        seen,
        findExactLanguage(preference.tag, normalizedLanguages)?.original
      );
      appendUniqueLanguage(
        candidates,
        seen,
        findBaseLanguage(preference.tag, normalizedLanguages)?.original
      );
    }
  }

  appendUniqueLanguage(
    candidates,
    seen,
    normalizedLanguages[0]?.original ?? null
  );

  return {
    primary: candidates[0] ?? null,
    candidates,
  };
}
