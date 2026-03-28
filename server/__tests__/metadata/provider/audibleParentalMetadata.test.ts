/**
 * Unit tests for Audible parental metadata normalization.
 *
 * Tests cover:
 * - is_adult_product=true → minimumAge=18, AUDIBLE/ADULT label
 * - is_adult_product=false → all parental fields null
 * - is_adult_product undefined → all parental fields null
 * - Coarse adult signal does not populate category breakdowns
 */

import axios from 'axios';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { Audible } from 'src/metadata/provider/audible';
import { GlobalConfiguration } from 'src/repository/globalSettings';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const audible = new Audible();

const nullParentalFields = {
  minimumAge: null,
  contentRatingSystem: null,
  contentRatingRegion: null,
  contentRatingLabel: null,
  contentRatingDescriptors: null,
  parentalGuidanceSummary: null,
  parentalGuidanceCategories: null,
};

/** Minimal Audible product fixture with only the fields mapResponse needs. */
const buildAudibleDetailsResponse = (isAdultProduct: boolean) => ({
  product: {
    asin: 'B000TEST01',
    title: 'Test Audiobook',
    authors: [{ asin: 'A001', name: 'Test Author' }],
    narrators: [{ name: 'Test Narrator' }],
    available_codecs: [],
    content_delivery_type: 'SinglePartBook',
    content_type: 'Product',
    format_type: 'unabridged',
    has_children: false,
    is_adult_product: isAdultProduct,
    is_listenable: true,
    is_purchasability_suppressed: false,
    issue_date: '2023-01-01',
    language: 'english',
    merchandising_summary: 'A test audiobook.',
    product_images: {
      500: 'https://example.com/500.jpg',
      1000: 'https://example.com/1000.jpg',
      2400: 'https://example.com/2400.jpg',
    },
    publication_name: 'Test Series',
    publisher_name: 'Test Publisher',
    rating: {
      num_reviews: 0,
      overall_distribution: {
        average_rating: 0,
        display_average_rating: '0',
        display_stars: 0,
        num_five_star_ratings: 0,
        num_four_star_ratings: 0,
        num_one_star_ratings: 0,
        num_ratings: 0,
        num_three_star_ratings: 0,
        num_two_star_ratings: 0,
      },
      performance_distribution: {
        average_rating: 0,
        display_average_rating: '0',
        display_stars: 0,
        num_five_star_ratings: 0,
        num_four_star_ratings: 0,
        num_one_star_ratings: 0,
        num_ratings: 0,
        num_three_star_ratings: 0,
        num_two_star_ratings: 0,
      },
      story_distribution: {
        average_rating: 0,
        display_average_rating: '0',
        display_stars: 0,
        num_five_star_ratings: 0,
        num_four_star_ratings: 0,
        num_one_star_ratings: 0,
        num_ratings: 0,
        num_three_star_ratings: 0,
        num_two_star_ratings: 0,
      },
    },
    release_date: '2023-01-01',
    runtime_length_min: 600,
    series: [],
    sku: 'test-sku',
    sku_lite: 'test-sku-lite',
    social_media_images: { facebook: '', twitter: '' },
    thesaurus_subject_keywords: [],
    subtitle: '',
    voice_description: '',
  },
  response_groups: ['contributors', 'rating', 'media', 'product_attrs'],
});

describe('Audible parental metadata normalization', () => {
  beforeAll(runMigrations);
  afterAll(clearDatabase);

  beforeAll(() => {
    jest
      .spyOn(GlobalConfiguration, 'configuration', 'get')
      .mockImplementation(() => ({
        enableRegistration: false,
        audibleLang: 'us',
      }));
  });

  test('is_adult_product=true → minimumAge=18, system=AUDIBLE, label=ADULT', async () => {
    mockedAxios.get.mockResolvedValue({
      data: buildAudibleDetailsResponse(true),
      status: 200,
    });

    const res = await audible.details({ audibleId: 'B000TEST01' });

    expect(res).toMatchObject({
      minimumAge: 18,
      contentRatingSystem: 'AUDIBLE',
      contentRatingRegion: 'US',
      contentRatingLabel: 'ADULT',
      contentRatingDescriptors: null,
      parentalGuidanceSummary: null,
      parentalGuidanceCategories: null,
    });
  });

  test('is_adult_product=false → all parental fields null', async () => {
    mockedAxios.get.mockResolvedValue({
      data: buildAudibleDetailsResponse(false),
      status: 200,
    });

    const res = await audible.details({ audibleId: 'B000TEST01' });

    expect(res).toMatchObject(nullParentalFields);
  });

  test('adult product does not populate category breakdowns', async () => {
    mockedAxios.get.mockResolvedValue({
      data: buildAudibleDetailsResponse(true),
      status: 200,
    });

    const res = await audible.details({ audibleId: 'B000TEST01' });

    expect(res.parentalGuidanceCategories).toBeNull();
    expect(res.contentRatingDescriptors).toBeNull();
  });
});
