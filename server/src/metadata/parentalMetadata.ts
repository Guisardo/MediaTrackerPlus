import { ParentalGuidanceCategory } from 'src/entity/mediaItem';

/**
 * Serialize contentRatingDescriptors (string[]) to a JSON string for DB storage.
 * Returns null when the input is null/undefined/empty.
 */
export const serializeDescriptors = (
  descriptors: string[] | null | undefined
): string | null => {
  if (!descriptors || descriptors.length === 0) {
    return null;
  }
  return JSON.stringify(descriptors);
};

/**
 * Deserialize contentRatingDescriptors from a JSON string (DB) to string[].
 * Returns null for null/undefined/empty values or invalid JSON.
 */
export const deserializeDescriptors = (
  raw: unknown
): string[] | null => {
  if (raw == null || raw === '') {
    return null;
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Serialize parentalGuidanceCategories (ParentalGuidanceCategory[]) to a JSON
 * string for DB storage.
 * Returns null when the input is null/undefined/empty.
 */
export const serializeCategories = (
  categories: ParentalGuidanceCategory[] | null | undefined
): string | null => {
  if (!categories || categories.length === 0) {
    return null;
  }
  return JSON.stringify(categories);
};

/**
 * Deserialize parentalGuidanceCategories from a JSON string (DB) to
 * ParentalGuidanceCategory[].
 * Returns null for null/undefined/empty values or invalid JSON.
 */
export const deserializeCategories = (
  raw: unknown
): ParentalGuidanceCategory[] | null => {
  if (raw == null || raw === '') {
    return null;
  }
  if (Array.isArray(raw)) {
    return raw as ParentalGuidanceCategory[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Content rating systems known to the normalization module.
 * Each system maps labels to a minimumAge integer (or null for unknown).
 */
export type ContentRatingSystem =
  | 'MPAA'
  | 'BBFC'
  | 'ACB'
  | 'CBFC'
  | 'FSK'
  | 'TV-PG'
  | 'ESRB'
  | 'PEGI'
  | 'USK'
  | 'CERO'
  | 'GRAC'
  | 'AUDIBLE';

/**
 * Deterministic region precedence for provider certifications that return
 * multi-region data.
 *
 * When a provider returns certifications for multiple regions, the normalizer
 * picks the first recognized region from this ordered list. If none of the
 * preferred regions are present, it falls back to the first entry with a
 * recognized rating system.
 */
export const REGION_PRECEDENCE: readonly string[] = [
  'US',
  'GB',
  'AU',
  'CA',
] as const;

/**
 * Maps known content rating labels to a minimumAge integer.
 *
 * The outer key is the rating system; the inner key is the provider-specific
 * label (case-sensitive as returned by the provider).
 *
 * A value of `null` means the label is recognized but does not translate to
 * a meaningful age gate (e.g. "NR" / "Not Rated").
 */
export const RATING_AGE_MAP: Record<string, Record<string, number | null>> = {
  // MPAA (US film ratings)
  MPAA: {
    'G': 0,
    'PG': 0,
    'PG-13': 13,
    'R': 17,
    'NC-17': 18,
    'NR': null,
  },

  // BBFC (UK film/TV ratings)
  BBFC: {
    'U': 0,
    'PG': 0,
    '12A': 12,
    '12': 12,
    '15': 15,
    '18': 18,
    'R18': 18,
  },

  // ACB (Australia)
  ACB: {
    'G': 0,
    'PG': 0,
    'M': 15,
    'MA15+': 15,
    'MA 15+': 15,
    'R18+': 18,
    'R 18+': 18,
    'X18+': 18,
    'RC': null,
  },

  // US TV content ratings
  'TV-PG': {
    'TV-Y': 0,
    'TV-Y7': 7,
    'TV-G': 0,
    'TV-PG': 0,
    'TV-14': 14,
    'TV-MA': 17,
    'NR': null,
  },

  // FSK (Germany)
  FSK: {
    '0': 0,
    '6': 6,
    '12': 12,
    '16': 16,
    '18': 18,
  },

  // ESRB (US video game ratings)
  ESRB: {
    'EC': 3,
    'E': 6,
    'E10+': 10,
    'E10': 10,
    'T': 13,
    'M': 17,
    'AO': 18,
    'RP': null,
  },

  // PEGI (Europe video game ratings)
  PEGI: {
    '3': 3,
    '7': 7,
    '12': 12,
    '16': 16,
    '18': 18,
  },

  // USK (Germany video game ratings)
  USK: {
    '0': 0,
    '6': 6,
    '12': 12,
    '16': 16,
    '18': 18,
  },

  // CERO (Japan video game ratings)
  CERO: {
    'A': 0,
    'B': 12,
    'C': 15,
    'D': 17,
    'Z': 18,
  },

  // GRAC (South Korea video game ratings)
  GRAC: {
    'ALL': 0,
    '12': 12,
    '15': 15,
    '18': 18,
  },

  // Audible (coarse adult flag only)
  AUDIBLE: {
    'ADULT': 18,
    'NOT_ADULT': 0,
  },
};

/**
 * Canonical result of normalizing a provider's parental/rating data.
 */
export type NormalizedParentalData = {
  minimumAge: number | null;
  contentRatingSystem: string | null;
  contentRatingRegion: string | null;
  contentRatingLabel: string | null;
  contentRatingDescriptors: string[] | null;
  parentalGuidanceSummary: string | null;
  parentalGuidanceCategories: ParentalGuidanceCategory[] | null;
};

/**
 * A single certification entry from a provider. Providers map their raw
 * payloads into this shape before calling `normalizeParentalData`.
 */
export type ProviderCertification = {
  /** ISO 3166-1 alpha-2 region code (e.g. "US", "GB"). */
  region: string;
  /** Rating system identifier (must be a key in RATING_AGE_MAP). */
  system: string;
  /** Provider-specific label (must be a key inside the system's map). */
  label: string;
  /**
   * Optional provider-supplied descriptors (e.g. "Violence", "Language").
   * Only populated when the provider exposes them.
   */
  descriptors?: string[] | null;
};

// ---------------------------------------------------------------------------
// Private helpers shared by both public normalization functions
// ---------------------------------------------------------------------------

type NormalizeOptions = {
  adultFlag?: boolean;
  guidanceSummary?: string | null;
  guidanceCategories?: ParentalGuidanceCategory[] | null;
};

/**
 * Construct an all-null NormalizedParentalData, optionally seeded with
 * guidance fields from the caller's options.
 */
const buildEmptyParentalData = (
  options?: NormalizeOptions
): NormalizedParentalData => ({
  minimumAge: null,
  contentRatingSystem: null,
  contentRatingRegion: null,
  contentRatingLabel: null,
  contentRatingDescriptors: null,
  parentalGuidanceSummary: options?.guidanceSummary ?? null,
  parentalGuidanceCategories: options?.guidanceCategories ?? null,
});

/**
 * Apply the adult flag to a raw minimumAge value.
 *
 * When `adultFlag` is true the returned age is at least 18. If `age` is
 * already >= 18 or `adultFlag` is falsy the original value is returned as-is
 * (null coalesced to null).
 */
const applyAdultFlagToAge = (
  age: number | null | undefined,
  adultFlag: boolean | undefined
): number | null => {
  if (adultFlag && (age == null || age < 18)) {
    return 18;
  }
  return age ?? null;
};

/**
 * Build the final non-empty NormalizedParentalData from a selected
 * ProviderCertification and a pre-computed (possibly adjusted) minimumAge.
 */
const buildResultFromCert = (
  cert: ProviderCertification,
  minimumAge: number | null,
  options?: NormalizeOptions
): NormalizedParentalData => ({
  minimumAge,
  contentRatingSystem: cert.system,
  contentRatingRegion: cert.region,
  contentRatingLabel: cert.label,
  contentRatingDescriptors:
    cert.descriptors && cert.descriptors.length > 0
      ? cert.descriptors
      : null,
  parentalGuidanceSummary: options?.guidanceSummary ?? null,
  parentalGuidanceCategories: options?.guidanceCategories ?? null,
});

/**
 * Two-step region-precedence selection used by `normalizeParentalData`.
 *
 * Step 1: walk REGION_PRECEDENCE and return the first certification whose
 *   region and system+label are all recognized.
 * Step 2: fall back to the first certification with any recognized
 *   system+label regardless of region.
 *
 * Returns `undefined` when no recognized certification is found.
 */
const selectBestCertificationByRegion = (
  certifications: ProviderCertification[]
): ProviderCertification | undefined => {
  for (const preferredRegion of REGION_PRECEDENCE) {
    const match = certifications.find(
      (cert) =>
        cert.region === preferredRegion &&
        RATING_AGE_MAP[cert.system] != null &&
        RATING_AGE_MAP[cert.system][cert.label] !== undefined
    );
    if (match) {
      return match;
    }
  }

  return certifications.find(
    (cert) =>
      RATING_AGE_MAP[cert.system] != null &&
      RATING_AGE_MAP[cert.system][cert.label] !== undefined
  );
};

/**
 * Scan all certifications and return the one with the highest minimumAge
 * together with that age value. Returns `null` when no recognized
 * certification is found.
 *
 * Ties are broken by input order (first wins).
 */
const findStrictestCertification = (
  certifications: ProviderCertification[]
): { cert: ProviderCertification; age: number } | null => {
  let strictest: { cert: ProviderCertification; age: number } | null = null;

  for (const cert of certifications) {
    const systemMap = RATING_AGE_MAP[cert.system];
    if (!systemMap) {
      continue;
    }
    const age = systemMap[cert.label];
    if (age == null) {
      continue;
    }
    if (strictest == null || age > strictest.age) {
      strictest = { cert, age };
    }
  }

  return strictest;
};

// ---------------------------------------------------------------------------
// Public normalization functions
// ---------------------------------------------------------------------------

/**
 * Normalize a list of provider certifications into canonical parental fields.
 *
 * Region precedence: US > GB > AU > CA > first recognized.
 *
 * When multiple certifications are provided, the normalizer selects the single
 * best-matching certification using region precedence and falls back to the
 * first entry whose system is recognized.
 *
 * `minimumAge` is the only gating field. Unknown / unsupported labels yield
 * null rather than fabricated data.
 *
 * @param certifications  Provider-mapped certification entries.
 * @param options.adultFlag  When true, raises minimumAge to 18 if the selected
 *   certification yields a lower threshold (e.g. TMDB `adult: true`).
 * @param options.guidanceSummary  Optional textual guidance from the provider.
 * @param options.guidanceCategories  Optional structured category breakdowns.
 */
export const normalizeParentalData = (
  certifications: ProviderCertification[],
  options?: NormalizeOptions
): NormalizedParentalData => {
  const empty = buildEmptyParentalData(options);

  if (!certifications || certifications.length === 0) {
    return options?.adultFlag ? { ...empty, minimumAge: 18 } : empty;
  }

  const selected = selectBestCertificationByRegion(certifications);

  if (!selected) {
    return options?.adultFlag ? { ...empty, minimumAge: 18 } : empty;
  }

  const rawAge = RATING_AGE_MAP[selected.system][selected.label];
  const minimumAge = applyAdultFlagToAge(rawAge, options?.adultFlag);

  return buildResultFromCert(selected, minimumAge, options);
};

/**
 * Select the strictest certification from a list and return its normalized data.
 *
 * Used for providers like IGDB that may return multiple ratings (e.g. both ESRB
 * and PEGI). The strictest means the highest `minimumAge`.
 *
 * Descriptors are taken from the strictest certification. If multiple
 * certifications tie on minimumAge, the first in the input order wins.
 *
 * @param certifications  Provider-mapped certification entries.
 * @param options  Same as `normalizeParentalData` options.
 */
export const normalizeStrictestCertification = (
  certifications: ProviderCertification[],
  options?: NormalizeOptions
): NormalizedParentalData => {
  const empty = buildEmptyParentalData(options);

  if (!certifications || certifications.length === 0) {
    return options?.adultFlag ? { ...empty, minimumAge: 18 } : empty;
  }

  const strictest = findStrictestCertification(certifications);

  if (!strictest) {
    return options?.adultFlag ? { ...empty, minimumAge: 18 } : empty;
  }

  const minimumAge = applyAdultFlagToAge(strictest.age, options?.adultFlag);

  return buildResultFromCert(strictest.cert, minimumAge, options);
};
