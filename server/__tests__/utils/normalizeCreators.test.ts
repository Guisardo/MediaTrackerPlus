import {
  normalizeCreatorField,
  splitCreatorField,
} from 'src/utils/normalizeCreators';

describe('normalizeCreatorField', () => {
  test('preserves First Last format for a single author', () => {
    expect(normalizeCreatorField(['Stephen King'])).toEqual(['Stephen King']);
  });

  test('handles multiple distinct authors', () => {
    expect(
      normalizeCreatorField(['J.K. Rowling', 'George R.R. Martin'])
    ).toEqual(['J.K. Rowling', 'George R.R. Martin']);
  });

  test('trims leading and trailing whitespace from each name', () => {
    expect(
      normalizeCreatorField(['  J.K. Rowling ', '  George R.R. Martin  '])
    ).toEqual(['J.K. Rowling', 'George R.R. Martin']);
  });

  test('filters out empty strings', () => {
    expect(normalizeCreatorField(['Stephen King', '', '  '])).toEqual([
      'Stephen King',
    ]);
  });

  test('deduplicates while preserving first occurrence order', () => {
    expect(
      normalizeCreatorField(['J.K. Rowling', 'Stephen King', 'J.K. Rowling'])
    ).toEqual(['J.K. Rowling', 'Stephen King']);
  });

  test('deduplicates after trimming whitespace', () => {
    expect(
      normalizeCreatorField(['J.K. Rowling', '  J.K. Rowling  '])
    ).toEqual(['J.K. Rowling']);
  });

  test('returns empty array for all-empty input', () => {
    expect(normalizeCreatorField(['', '  ', ''])).toEqual([]);
  });

  test('returns empty array for empty input array', () => {
    expect(normalizeCreatorField([])).toEqual([]);
  });

  test('preserves First Last name format (no Last, First conversion)', () => {
    expect(
      normalizeCreatorField(['John Ronald Reuel Tolkien'])
    ).toEqual(['John Ronald Reuel Tolkien']);
  });

  test('handles single-word names', () => {
    expect(normalizeCreatorField(['Voltaire', 'Homer'])).toEqual([
      'Voltaire',
      'Homer',
    ]);
  });
});

describe('splitCreatorField', () => {
  test('splits CSV with multiple authors', () => {
    expect(splitCreatorField('J.K. Rowling, George R.R. Martin')).toEqual([
      'J.K. Rowling',
      'George R.R. Martin',
    ]);
  });

  test('splits CSV with a single author', () => {
    expect(splitCreatorField('Stephen King')).toEqual(['Stephen King']);
  });

  test('returns empty array for null input', () => {
    expect(splitCreatorField(null)).toEqual([]);
  });

  test('returns empty array for empty string input', () => {
    expect(splitCreatorField('')).toEqual([]);
  });

  test('trims leading whitespace from tokens (join with ", " pattern)', () => {
    // Simulates the leading-space problem from join(', ') storage:
    // 'J.K. Rowling, George R.R. Martin' -> split(',') -> ['J.K. Rowling', ' George R.R. Martin']
    expect(splitCreatorField('J.K. Rowling, George R.R. Martin')).toEqual([
      'J.K. Rowling',
      'George R.R. Martin',
    ]);
  });

  test('trims trailing whitespace from tokens', () => {
    expect(splitCreatorField('Stephen King ,Agatha Christie ')).toEqual([
      'Stephen King',
      'Agatha Christie',
    ]);
  });

  test('filters out empty tokens after trimming', () => {
    expect(splitCreatorField('Stephen King,,')).toEqual(['Stephen King']);
  });

  test('preserves First Last name format for each token', () => {
    expect(splitCreatorField('John Ronald Reuel Tolkien')).toEqual([
      'John Ronald Reuel Tolkien',
    ]);
  });

  test('handles whitespace-only string', () => {
    expect(splitCreatorField('   ')).toEqual([]);
  });

  test('handles comma-only string', () => {
    expect(splitCreatorField(',')).toEqual([]);
  });
});
