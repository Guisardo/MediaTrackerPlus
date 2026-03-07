import axios from 'axios';
import { OpenLibrary } from 'src/metadata/provider/openlibrary';
import { clearDatabase, runMigrations } from '__tests__/__utils__/utils';
import { SimilarItem } from 'src/services/recommendations/types';

import searchResponse from './mock/openlibrary/searchResponse.json';
import detailsResponse from './mock/openlibrary/detailsResponse.json';
import detailsResponse2 from './mock/openlibrary/detailsResponse2.json';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const openlibraryApi = new OpenLibrary();

describe('openlibrary', () => {
  beforeAll(runMigrations);
  afterAll(clearDatabase);

  test('search', async () => {
    mockedAxios.get.mockResolvedValue({ data: searchResponse });

    const res = await openlibraryApi.search('Harry Potter');

    expect(res).toStrictEqual(searchResult);
  });

  test('details', async () => {
    mockedAxios.get.mockResolvedValue({ data: detailsResponse });

    const res = await openlibraryApi.details({
      openlibraryId: 'works/OL82563W',
      numberOfPages: 123,
      externalPosterUrl: 'poster',
    });

    expect(res).toStrictEqual(detailsResult);
  });

  test('details 2', async () => {
    mockedAxios.get.mockResolvedValue({ data: detailsResponse2 });

    const res = await openlibraryApi.details({
      openlibraryId: 'works/OL2019091W',
    });

    expect(res).toStrictEqual(detailsResult2);
  });

  describe('OpenLibrary.similar', () => {
    test('returns empty array when openlibraryId is not provided', async () => {
      const res = await openlibraryApi.similar({});
      expect(res).toStrictEqual([]);
    });

    test('returns empty array when work has no subjects', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { title: 'Some Book' } });

      const res = await openlibraryApi.similar({
        openlibraryId: '/works/OL82563W',
      });
      expect(res).toStrictEqual([]);
    });

    test('returns empty array when subjects list is empty', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { title: 'Some Book', subjects: [] },
      });

      const res = await openlibraryApi.similar({
        openlibraryId: '/works/OL82563W',
      });
      expect(res).toStrictEqual([]);
    });

    test('returns mapped SimilarItem array from subject works', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { title: "Harry Potter and the Philosopher's Stone", subjects: ['Fantasy Fiction'] },
        })
        .mockResolvedValueOnce({
          data: openLibrarySubjectWorksResponse,
        });

      const res = await openlibraryApi.similar({
        openlibraryId: '/works/OL82563W',
      });
      expect(res).toStrictEqual(openLibrarySimilarResult);
    });

    test('strips leading /works/ prefix when building the work details URL', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { title: 'Some Book', subjects: ['Fantasy Fiction'] },
        })
        .mockResolvedValueOnce({ data: { works: [] } });

      await openlibraryApi.similar({ openlibraryId: '/works/OL82563W' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://openlibrary.org/works/OL82563W.json'
      );
    });

    test('normalizes subject to lowercase with underscores for the subjects URL', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { title: 'Some Book', subjects: ['Young Adult Fiction'] },
        })
        .mockResolvedValueOnce({ data: { works: [] } });

      await openlibraryApi.similar({ openlibraryId: '/works/OL82563W' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://openlibrary.org/subjects/young_adult_fiction.json'
      );
    });

    test('throws when work details request fails', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 404 } });

      await expect(
        openlibraryApi.similar({ openlibraryId: '/works/OL82563W' })
      ).rejects.toThrow('OpenLibrary work details request failed with HTTP 404');
    });

    test('throws when subject works request fails', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { title: 'Some Book', subjects: ['Fantasy Fiction'] },
        })
        .mockRejectedValueOnce({ response: { status: 503 } });

      await expect(
        openlibraryApi.similar({ openlibraryId: '/works/OL82563W' })
      ).rejects.toThrow('OpenLibrary subjects request failed with HTTP 503');
    });

    test('sets externalRating to null for all returned books', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { title: "Harry Potter and the Philosopher's Stone", subjects: ['Fantasy Fiction'] },
        })
        .mockResolvedValueOnce({
          data: openLibrarySubjectWorksResponse,
        });

      const res = await openlibraryApi.similar({
        openlibraryId: '/works/OL82563W',
      });
      expect(res.every((item) => item.externalRating === null)).toBe(true);
    });
  });
});

const openLibrarySubjectWorksResponse = {
  works: [
    { key: '/works/OL3120537W', title: 'The Hobbit' },
    { key: '/works/OL7109345W', title: 'Eragon' },
  ],
};

const openLibrarySimilarResult: SimilarItem[] = [
  {
    externalId: '/works/OL3120537W',
    mediaType: 'book',
    title: 'The Hobbit',
    externalRating: null,
  },
  {
    externalId: '/works/OL7109345W',
    mediaType: 'book',
    title: 'Eragon',
    externalRating: null,
  },
];

const searchResult = [
  {
    mediaType: 'book',
    source: 'openlibrary',
    title: "Harry Potter and the Philosopher's Stone",
    externalPosterUrl: 'https://covers.openlibrary.org/b/id/10521270.jpg',
    releaseDate: '1997',
    numberOfPages: 296,
    authors: ['J. K. Rowling'],
    openlibraryId: '/works/OL82563W',
  },
  {
    mediaType: 'book',
    source: 'openlibrary',
    title: 'Harry Potter and the Deathly Hallows',
    externalPosterUrl: 'https://covers.openlibrary.org/b/id/10110415.jpg',
    releaseDate: '2007',
    numberOfPages: 640,
    authors: ['J. K. Rowling'],
    openlibraryId: '/works/OL82586W',
  },
  {
    mediaType: 'book',
    source: 'openlibrary',
    title: 'Harry Potter and the Chamber of Secrets',
    externalPosterUrl: 'https://covers.openlibrary.org/b/id/8234423.jpg',
    releaseDate: '1998',
    numberOfPages: 341,
    authors: ['J. K. Rowling'],
    openlibraryId: '/works/OL82537W',
  },
  {
    mediaType: 'book',
    source: 'openlibrary',
    title: 'Harry Potter and the Half-Blood Prince',
    externalPosterUrl: 'https://covers.openlibrary.org/b/id/10716273.jpg',
    releaseDate: '2001',
    numberOfPages: 652,
    authors: ['J. K. Rowling'],
    openlibraryId: '/works/OL82565W',
  },
];

const detailsResult = {
  mediaType: 'book',
  source: 'openlibrary',
  title: "Harry Potter and the Philosopher's Stone",
  overview:
    'Harry Potter #1\r\n' +
    '\r\n' +
    'When mysterious letters start arriving on his doorstep, Harry Potter has never heard of Hogwarts School of Witchcraft and Wizardry.\r\n' +
    '\r\n' +
    'They are swiftly confiscated by his aunt and uncle.\r\n' +
    '\r\n' +
    'Then, on Harry’s eleventh birthday, a strange man bursts in with some important news: Harry Potter is a wizard and has been awarded a place to study at Hogwarts.\r\n' +
    '\r\n' +
    'And so the first of the Harry Potter adventures is set to begin.\r\n' +
    '([source][1])\r\n' +
    '\r\n' +
    '\r\n' +
    '  [1]: https://www.jkrowling.com/book/harry-potter-philosophers-stone/',
  releaseDate: undefined,
  numberOfPages: 123,
  externalPosterUrl: 'poster',
} as unknown;

const detailsResult2 = {
  mediaType: 'book',
  source: 'openlibrary',
  title: 'Oraciones y pensamientos',
  overview:
    'En medio del ritmo acelerado del mundo actual, es necesario recogerse y elevar la mente y el corazón hacia el Señor. Estas concisas plegarias y reflexiones de Luis Fernando Figari, fundador de diversas asociaciones de la Iglesia, ofrecen la ocasión de centrarse en lo esencial y de recorrer el sendero de la existencia desde el realismo de la esperanza, con la mirada puesta en Aquel que es el Camino, la Verdad y la Vida.',
  releaseDate: '2009',
  numberOfPages: undefined,
  externalPosterUrl: 'https://covers.openlibrary.org/b/id/5732360.jpg',
} as unknown;
