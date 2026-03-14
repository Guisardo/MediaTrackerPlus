jest.mock('axios');
jest.mock('src/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import axios from 'axios';
import { OpenLibrary } from 'src/metadata/provider/openlibrary';
import { logger } from 'src/logger';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

const openLibrary = new OpenLibrary();

/**
 * OpenLibrary.details primary-language debug log tests.
 *
 * OpenLibrary does not support per-language fetches — details() always fetches
 * the single primary language available and logs a DEBUG message noting this.
 */
describe('OpenLibrary.details — primary language only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function buildDetailsResponse(
    overrides: Record<string, unknown> = {}
  ): Record<string, unknown> {
    return {
      title: 'The Great Gatsby',
      description: 'A classic novel',
      covers: [12345],
      subject_places: [],
      subjects: ['American fiction'],
      subject_people: [],
      key: '/works/OL468431W',
      authors: [{ author: { key: '/authors/OL12345A' }, type: { key: '/type/author_role' } }],
      first_publish_date: '1925',
      subject_times: [],
      type: { key: '/type/work' },
      latest_revision: 10,
      revision: 10,
      created: { type: '/type/datetime', value: '2009-10-15T11:34:21.437852' },
      last_modified: { type: '/type/datetime', value: '2020-10-15T11:34:21.437852' },
      ...overrides,
    };
  }

  test('logs a DEBUG message "OpenLibrary: no language filter, storing primary language only"', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/authors/')) {
        return Promise.resolve({ data: { name: 'F. Scott Fitzgerald', key: '/authors/OL12345A' } });
      }
      return Promise.resolve({ data: buildDetailsResponse() });
    });

    await openLibrary.details({
      openlibraryId: '/works/OL468431W',
      numberOfPages: 180,
    });

    expect(mockedLogger.debug).toHaveBeenCalledWith(
      'OpenLibrary: no language filter, storing primary language only'
    );
  });

  test('logs the debug message on every call to details()', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/authors/')) {
        return Promise.resolve({ data: { name: 'F. Scott Fitzgerald', key: '/authors/OL12345A' } });
      }
      return Promise.resolve({ data: buildDetailsResponse() });
    });

    await openLibrary.details({ openlibraryId: '/works/OL468431W' });
    await openLibrary.details({ openlibraryId: '/works/OL468431W' });

    expect(mockedLogger.debug).toHaveBeenCalledTimes(2);
    expect(mockedLogger.debug).toHaveBeenNthCalledWith(
      1,
      'OpenLibrary: no language filter, storing primary language only'
    );
    expect(mockedLogger.debug).toHaveBeenNthCalledWith(
      2,
      'OpenLibrary: no language filter, storing primary language only'
    );
  });

  test('still returns the correct book data after logging', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.includes('/authors/')) {
        return Promise.resolve({ data: { name: 'F. Scott Fitzgerald', key: '/authors/OL12345A' } });
      }
      return Promise.resolve({
        data: buildDetailsResponse({
          title: 'The Great Gatsby',
          description: 'A novel about the American Dream',
          covers: [9876],
        }),
      });
    });

    const result = await openLibrary.details({
      openlibraryId: '/works/OL468431W',
      numberOfPages: 180,
    });

    expect(result.title).toBe('The Great Gatsby');
    expect(result.overview).toBe('A novel about the American Dream');
    expect(result.numberOfPages).toBe(180);
    expect(result.mediaType).toBe('book');
    expect(result.source).toBe('openlibrary');
  });

  test('does NOT implement localizedDetails (no such method on OpenLibrary)', () => {
    expect(typeof (openLibrary as unknown as Record<string, unknown>).localizedDetails).toBe('undefined');
  });
});
