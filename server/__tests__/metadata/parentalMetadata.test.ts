import {
  normalizeParentalData,
  normalizeStrictestCertification,
  serializeDescriptors,
  deserializeDescriptors,
  serializeCategories,
  deserializeCategories,
  REGION_PRECEDENCE,
  RATING_AGE_MAP,
  ProviderCertification,
} from 'src/metadata/parentalMetadata';
import { ParentalGuidanceCategory } from 'src/entity/mediaItem';

describe('parentalMetadata module', () => {
  describe('serializeDescriptors / deserializeDescriptors', () => {
    test('round-trips a non-empty string array', () => {
      const input = ['Violence', 'Language', 'Drug Use'];
      const serialized = serializeDescriptors(input);
      expect(typeof serialized).toBe('string');
      expect(deserializeDescriptors(serialized)).toEqual(input);
    });

    test('returns null for null input', () => {
      expect(serializeDescriptors(null)).toBeNull();
      expect(deserializeDescriptors(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(serializeDescriptors(undefined)).toBeNull();
      expect(deserializeDescriptors(undefined)).toBeNull();
    });

    test('returns null for empty array', () => {
      expect(serializeDescriptors([])).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(deserializeDescriptors('')).toBeNull();
    });

    test('returns null for invalid JSON string', () => {
      expect(deserializeDescriptors('not json')).toBeNull();
    });

    test('passes through already-parsed arrays', () => {
      const arr = ['Violence'];
      expect(deserializeDescriptors(arr)).toEqual(arr);
    });
  });

  describe('serializeCategories / deserializeCategories', () => {
    const categories: ParentalGuidanceCategory[] = [
      { category: 'Violence', severity: 'Moderate', description: 'Some fights' },
      { category: 'Language', severity: 'Mild' },
    ];

    test('round-trips a non-empty category array', () => {
      const serialized = serializeCategories(categories);
      expect(typeof serialized).toBe('string');
      const deserialized = deserializeCategories(serialized);
      expect(deserialized).toEqual(categories);
    });

    test('returns null for null input', () => {
      expect(serializeCategories(null)).toBeNull();
      expect(deserializeCategories(null)).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(serializeCategories(undefined)).toBeNull();
      expect(deserializeCategories(undefined)).toBeNull();
    });

    test('returns null for empty array', () => {
      expect(serializeCategories([])).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(deserializeCategories('')).toBeNull();
    });

    test('returns null for invalid JSON string', () => {
      expect(deserializeCategories('invalid')).toBeNull();
    });

    test('passes through already-parsed arrays', () => {
      expect(deserializeCategories(categories)).toEqual(categories);
    });
  });

  describe('REGION_PRECEDENCE', () => {
    test('has US first, then GB, AU, CA', () => {
      expect(REGION_PRECEDENCE).toEqual(['US', 'GB', 'AU', 'CA']);
    });
  });

  describe('RATING_AGE_MAP', () => {
    test('includes MPAA system with expected labels', () => {
      const mpaa = RATING_AGE_MAP['MPAA'];
      expect(mpaa).toBeDefined();
      expect(mpaa['G']).toBe(0);
      expect(mpaa['PG-13']).toBe(13);
      expect(mpaa['R']).toBe(17);
      expect(mpaa['NC-17']).toBe(18);
      expect(mpaa['NR']).toBeNull();
    });

    test('includes ESRB system with expected labels', () => {
      const esrb = RATING_AGE_MAP['ESRB'];
      expect(esrb).toBeDefined();
      expect(esrb['E']).toBe(6);
      expect(esrb['T']).toBe(13);
      expect(esrb['M']).toBe(17);
      expect(esrb['AO']).toBe(18);
    });

    test('includes PEGI system with expected labels', () => {
      const pegi = RATING_AGE_MAP['PEGI'];
      expect(pegi).toBeDefined();
      expect(pegi['3']).toBe(3);
      expect(pegi['12']).toBe(12);
      expect(pegi['18']).toBe(18);
    });

    test('includes TV-PG system with expected labels', () => {
      const tvpg = RATING_AGE_MAP['TV-PG'];
      expect(tvpg).toBeDefined();
      expect(tvpg['TV-Y']).toBe(0);
      expect(tvpg['TV-14']).toBe(14);
      expect(tvpg['TV-MA']).toBe(17);
    });

    test('includes AUDIBLE system with adult/not-adult labels', () => {
      const audible = RATING_AGE_MAP['AUDIBLE'];
      expect(audible).toBeDefined();
      expect(audible['ADULT']).toBe(18);
      expect(audible['NOT_ADULT']).toBe(0);
    });
  });

  describe('normalizeParentalData', () => {
    test('returns all-null for empty certifications', () => {
      const result = normalizeParentalData([]);
      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
      expect(result.contentRatingRegion).toBeNull();
      expect(result.contentRatingLabel).toBeNull();
      expect(result.contentRatingDescriptors).toBeNull();
      expect(result.parentalGuidanceSummary).toBeNull();
      expect(result.parentalGuidanceCategories).toBeNull();
    });

    test('prefers US region over others', () => {
      const certs: ProviderCertification[] = [
        { region: 'GB', system: 'BBFC', label: '15' },
        { region: 'US', system: 'MPAA', label: 'PG-13' },
        { region: 'AU', system: 'ACB', label: 'M' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingRegion).toBe('US');
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('PG-13');
      expect(result.minimumAge).toBe(13);
    });

    test('falls back to GB when US is absent', () => {
      const certs: ProviderCertification[] = [
        { region: 'AU', system: 'ACB', label: 'M' },
        { region: 'GB', system: 'BBFC', label: '18' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingRegion).toBe('GB');
      expect(result.minimumAge).toBe(18);
    });

    test('falls back to AU when US and GB are absent', () => {
      const certs: ProviderCertification[] = [
        { region: 'CA', system: 'MPAA', label: 'R' },
        { region: 'AU', system: 'ACB', label: 'PG' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingRegion).toBe('AU');
      expect(result.minimumAge).toBe(0);
    });

    test('falls back to first recognized when none of the preferred regions exist', () => {
      const certs: ProviderCertification[] = [
        { region: 'DE', system: 'FSK', label: '16' },
        { region: 'JP', system: 'CERO', label: 'B' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingRegion).toBe('DE');
      expect(result.contentRatingSystem).toBe('FSK');
      expect(result.minimumAge).toBe(16);
    });

    test('returns null for unrecognized system', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'UNKNOWN_SYSTEM', label: 'X' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('returns null for unrecognized label within a known system', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'MPAA', label: 'UNKNOWN_LABEL' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('adult flag raises minimumAge to 18 when cert yields lower', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'MPAA', label: 'PG-13' },
      ];
      const result = normalizeParentalData(certs, { adultFlag: true });
      expect(result.minimumAge).toBe(18);
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('PG-13');
    });

    test('adult flag does not lower minimumAge when cert is already 18', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'MPAA', label: 'NC-17' },
      ];
      const result = normalizeParentalData(certs, { adultFlag: true });
      expect(result.minimumAge).toBe(18);
    });

    test('adult flag with no certifications yields minimumAge 18', () => {
      const result = normalizeParentalData([], { adultFlag: true });
      expect(result.minimumAge).toBe(18);
      expect(result.contentRatingSystem).toBeNull();
    });

    test('includes descriptors from the selected certification', () => {
      const certs: ProviderCertification[] = [
        {
          region: 'US',
          system: 'MPAA',
          label: 'R',
          descriptors: ['Violence', 'Language'],
        },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingDescriptors).toEqual(['Violence', 'Language']);
    });

    test('returns null descriptors when selected certification has none', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'MPAA', label: 'PG' },
      ];
      const result = normalizeParentalData(certs);
      expect(result.contentRatingDescriptors).toBeNull();
    });

    test('passes through guidance summary and categories options', () => {
      const categories: ParentalGuidanceCategory[] = [
        { category: 'Violence', severity: 'Moderate' },
      ];
      const result = normalizeParentalData(
        [{ region: 'US', system: 'MPAA', label: 'PG-13' }],
        {
          guidanceSummary: 'Some violence',
          guidanceCategories: categories,
        }
      );
      expect(result.parentalGuidanceSummary).toBe('Some violence');
      expect(result.parentalGuidanceCategories).toEqual(categories);
    });

    test('NR label maps to null minimumAge but is still recognized', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'MPAA', label: 'NR' },
      ];
      const result = normalizeParentalData(certs);
      // NR is a recognized label that maps to null minimumAge (no age gate)
      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBe('MPAA');
      expect(result.contentRatingLabel).toBe('NR');
    });
  });

  describe('normalizeStrictestCertification', () => {
    test('selects the certification with the highest minimumAge', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'ESRB', label: 'T' },    // 13
        { region: 'EU', system: 'PEGI', label: '18' },    // 18
        { region: 'DE', system: 'USK', label: '12' },     // 12
      ];
      const result = normalizeStrictestCertification(certs);
      expect(result.minimumAge).toBe(18);
      expect(result.contentRatingSystem).toBe('PEGI');
      expect(result.contentRatingRegion).toBe('EU');
    });

    test('uses first certification in input order when ages tie', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'ESRB', label: 'AO' },   // 18
        { region: 'EU', system: 'PEGI', label: '18' },    // 18
      ];
      const result = normalizeStrictestCertification(certs);
      expect(result.contentRatingSystem).toBe('ESRB');
      expect(result.contentRatingRegion).toBe('US');
    });

    test('skips unrecognized systems and labels', () => {
      const certs: ProviderCertification[] = [
        { region: 'XX', system: 'FAKE', label: 'ZZZ' },
        { region: 'US', system: 'ESRB', label: 'E' },    // 6
      ];
      const result = normalizeStrictestCertification(certs);
      expect(result.minimumAge).toBe(6);
      expect(result.contentRatingSystem).toBe('ESRB');
    });

    test('returns all-null for empty certifications', () => {
      const result = normalizeStrictestCertification([]);
      expect(result.minimumAge).toBeNull();
      expect(result.contentRatingSystem).toBeNull();
    });

    test('adult flag raises minimumAge to 18', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'ESRB', label: 'T' },    // 13
      ];
      const result = normalizeStrictestCertification(certs, { adultFlag: true });
      expect(result.minimumAge).toBe(18);
    });

    test('adult flag with no certs yields minimumAge 18', () => {
      const result = normalizeStrictestCertification([], { adultFlag: true });
      expect(result.minimumAge).toBe(18);
    });

    test('includes descriptors from the strictest certification', () => {
      const certs: ProviderCertification[] = [
        { region: 'US', system: 'ESRB', label: 'E', descriptors: ['Mild Violence'] },
        {
          region: 'EU',
          system: 'PEGI',
          label: '16',
          descriptors: ['Violence', 'Online'],
        },
      ];
      const result = normalizeStrictestCertification(certs);
      expect(result.minimumAge).toBe(16);
      expect(result.contentRatingDescriptors).toEqual(['Violence', 'Online']);
    });
  });
});
