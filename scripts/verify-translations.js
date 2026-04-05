const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const rootArgIndex = args.indexOf('--root');
const rootDir = path.resolve(
  rootArgIndex >= 0 && args[rootArgIndex + 1]
    ? args[rootArgIndex + 1]
    : path.join(__dirname, '..')
);

const fail = (errors) => {
  for (const error of errors) {
    console.error(error);
  }

  process.exit(1);
};

const readFile = (relativePath) =>
  fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const parseJsonConfigLocales = (relativePath) => {
  const config = JSON.parse(readFile(relativePath));
  return config.locales;
};

const parsePoCatalog = (contents) => {
  const lines = contents.split(/\r?\n/);
  const entries = [];
  let currentEntry = null;
  let activeField = null;

  const flush = () => {
    if (currentEntry != null && currentEntry.msgid !== '') {
      entries.push(currentEntry);
    }

    currentEntry = null;
    activeField = null;
  };

  const appendValue = (rawValue) => {
    const value = JSON.parse(rawValue);

    if (Array.isArray(activeField)) {
      const [fieldName, index] = activeField;
      currentEntry[fieldName][index] += value;
      return;
    }

    currentEntry[activeField] += value;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }

    if (line.startsWith('#~')) {
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    const msgidMatch = line.match(/^msgid\s+(".*")$/);
    if (msgidMatch != null) {
      flush();
      currentEntry = {
        msgid: JSON.parse(msgidMatch[1]),
        msgstr: '',
        msgstr_plural: {},
      };
      activeField = 'msgid';
      continue;
    }

    const msgstrMatch = line.match(/^msgstr\s+(".*")$/);
    if (msgstrMatch != null) {
      currentEntry.msgstr = JSON.parse(msgstrMatch[1]);
      activeField = 'msgstr';
      continue;
    }

    const pluralMatch = line.match(/^msgstr\[(\d+)\]\s+(".*")$/);
    if (pluralMatch != null) {
      currentEntry.msgstr_plural[pluralMatch[1]] = JSON.parse(pluralMatch[2]);
      activeField = ['msgstr_plural', pluralMatch[1]];
      continue;
    }

    const continuationMatch = line.match(/^(".*")$/);
    if (continuationMatch != null && currentEntry != null && activeField != null) {
      appendValue(continuationMatch[1]);
    }
  }

  flush();

  return entries;
};

const isPoTranslationEmpty = (entry) => {
  if (entry.msgstr.trim() !== '') {
    return false;
  }

  const pluralValues = Object.values(entry.msgstr_plural ?? {});
  return pluralValues.length === 0 || pluralValues.every((value) => value.trim() === '');
};

const verifyClientTranslations = () => {
  const locales = parseJsonConfigLocales('client/.linguirc');
  const catalogRoot = path.join(rootDir, 'client', 'src', 'i18n', 'locales');
  const englishCatalogPath = path.join(catalogRoot, 'en', 'translation.po');
  const englishEntries = parsePoCatalog(fs.readFileSync(englishCatalogPath, 'utf8'));
  const englishEntriesById = new Map(
    englishEntries.map((entry) => [entry.msgid, entry])
  );
  const errors = [];

  for (const locale of locales) {
    const catalogPath = path.join(catalogRoot, locale, 'translation.po');

    if (!fs.existsSync(catalogPath)) {
      errors.push(`Missing client catalog for locale "${locale}": ${catalogPath}`);
      continue;
    }

    if (locale === 'en') {
      continue;
    }

    const localeEntries = parsePoCatalog(fs.readFileSync(catalogPath, 'utf8'));
    const localeEntriesById = new Map(
      localeEntries.map((entry) => [entry.msgid, entry])
    );

    for (const [msgid] of englishEntriesById) {
      const localeEntry = localeEntriesById.get(msgid);

      if (localeEntry == null) {
        errors.push(`Missing client translation for locale "${locale}": ${msgid}`);
        continue;
      }

      if (isPoTranslationEmpty(localeEntry)) {
        errors.push(`Empty client translation for locale "${locale}": ${msgid}`);
      }
    }
  }

  return errors;
};

const verifyServerTranslations = () => {
  const locales = parseJsonConfigLocales('server/.linguirc');
  const catalogRoot = path.join(rootDir, 'server', 'src', 'i18n', 'locales');
  const englishCatalogPath = path.join(catalogRoot, 'en', 'translation.json');
  const englishCatalog = JSON.parse(fs.readFileSync(englishCatalogPath, 'utf8'));
  const englishKeys = Object.keys(englishCatalog);
  const errors = [];

  for (const locale of locales) {
    const catalogPath = path.join(catalogRoot, locale, 'translation.json');

    if (!fs.existsSync(catalogPath)) {
      errors.push(`Missing server catalog for locale "${locale}": ${catalogPath}`);
      continue;
    }

    if (locale === 'en') {
      continue;
    }

    const localeCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

    for (const key of englishKeys) {
      if (!Object.prototype.hasOwnProperty.call(localeCatalog, key)) {
        errors.push(`Missing server translation for locale "${locale}": ${key}`);
        continue;
      }

      if (localeCatalog[key] === '') {
        errors.push(`Empty server translation for locale "${locale}": ${key}`);
      }
    }
  }

  return errors;
};

try {
  const errors = [
    ...verifyClientTranslations(),
    ...verifyServerTranslations(),
  ];

  if (errors.length > 0) {
    fail(errors);
  }

  console.log('Translation verification passed.');
} catch (error) {
  fail([error instanceof Error ? error.message : String(error)]);
}
