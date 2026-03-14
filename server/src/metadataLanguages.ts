import { tmdbLang } from 'src/entity/configuration';
import { Config } from 'src/config';
import { logger } from 'src/logger';

/**
 * Extracts the ISO 639-1 base language subtag from a BCP 47 tag.
 * For example, 'es-419' -> 'es', 'pt-BR' -> 'pt', 'en' -> 'en'.
 * Validates the base against the TMDB supported language list and throws
 * if invalid (callers that want to skip invalid codes should use getMetadataLanguages()).
 *
 * @param tag - BCP 47 language tag (e.g., 'es-419', 'pt-BR', 'en')
 * @returns ISO 639-1 base subtag (e.g., 'es', 'pt', 'en')
 */
export function toTmdbLang(tag: string): string {
  const base = tag.split('-')[0].toLowerCase();
  return base;
}

let _metadataLanguagesCache: string[] | null = null;

/**
 * Returns the list of configured metadata languages from the METADATA_LANGUAGES
 * environment variable. Falls back to ['en'] if not set. Memoizes the result
 * after first call.
 *
 * Supports BCP 47 language tags with region subtags (e.g., 'es-419', 'pt-BR').
 * Invalid base codes (not in tmdbLang) are logged as warnings and excluded.
 *
 * @returns Array of BCP 47 language tags (e.g., ['en', 'es-419'])
 */
export function getMetadataLanguages(): string[] {
  if (_metadataLanguagesCache !== null) {
    return _metadataLanguagesCache;
  }

  const raw = Config.METADATA_LANGUAGES;

  if (!raw || raw.length === 0) {
    _metadataLanguagesCache = ['en'];
    return _metadataLanguagesCache;
  }

  const validated: string[] = [];

  for (const tag of raw) {
    const base = toTmdbLang(tag);
    if ((tmdbLang as string[]).includes(base)) {
      validated.push(tag);
    } else {
      logger.warn(
        `METADATA_LANGUAGES: invalid base language code '${base}' in tag '${tag}' — skipping`
      );
    }
  }

  if (validated.length === 0) {
    logger.warn(
      `METADATA_LANGUAGES: no valid language codes found, falling back to ['en']`
    );
    validated.push('en');
  }

  _metadataLanguagesCache = validated;
  return _metadataLanguagesCache;
}

/**
 * Resets the memoized metadata languages cache. Used in tests.
 */
export function _resetMetadataLanguagesCache(): void {
  _metadataLanguagesCache = null;
}

let _audibleLangMapCache: Map<string, string> | null = null;

/**
 * Default Audible language-to-country-code map used when AUDIBLE_LANG_MAP is not set.
 */
const DEFAULT_AUDIBLE_LANG_MAP: Map<string, string> = new Map([
  ['en', 'us'],
  ['de', 'de'],
  ['es', 'es'],
  ['fr', 'fr'],
  ['it', 'it'],
  ['ja', 'jp'],
]);

/**
 * Returns the Audible language-to-country-code map from the AUDIBLE_LANG_MAP
 * environment variable, or falls back to the default map if not set.
 *
 * The AUDIBLE_LANG_MAP env var format is comma-separated 'lang:country' pairs,
 * e.g., 'en:us,de:de,es:es'. Invalid entries (missing colon, empty parts) are
 * logged as warnings and skipped.
 *
 * @returns Map from ISO 639-1 language code to Audible country code string
 */
export function getAudibleLangMap(): Map<string, string> {
  if (_audibleLangMapCache !== null) {
    return _audibleLangMapCache;
  }

  const raw = Config.AUDIBLE_LANG_MAP;

  if (!raw || raw.trim().length === 0) {
    _audibleLangMapCache = new Map(DEFAULT_AUDIBLE_LANG_MAP);
    return _audibleLangMapCache;
  }

  const map = new Map<string, string>();
  const entries = raw.split(',');

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      logger.warn(
        `AUDIBLE_LANG_MAP: invalid entry '${trimmed}' — missing colon, skipping`
      );
      continue;
    }

    const lang = trimmed.substring(0, colonIdx).trim();
    const country = trimmed.substring(colonIdx + 1).trim();

    if (!lang || !country) {
      logger.warn(
        `AUDIBLE_LANG_MAP: invalid entry '${trimmed}' — empty lang or country part, skipping`
      );
      continue;
    }

    map.set(lang, country);
  }

  if (map.size === 0) {
    logger.warn(
      `AUDIBLE_LANG_MAP: no valid entries found, falling back to default map`
    );
    _audibleLangMapCache = new Map(DEFAULT_AUDIBLE_LANG_MAP);
    return _audibleLangMapCache;
  }

  _audibleLangMapCache = map;
  return _audibleLangMapCache;
}

/**
 * Resets the memoized Audible lang map cache. Used in tests.
 */
export function _resetAudibleLangMapCache(): void {
  _audibleLangMapCache = null;
}
