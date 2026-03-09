# Normalization Reference

Normalization enforces consistent form across all Markdown files without altering their content. Apply these rules in the order listed.

---

## Rule Set

### N1 — File Encoding & Line Endings

- Encoding: **UTF-8 without BOM**
- Line endings: **LF** (`\n`) — enforced by `.prettierrc.json` (`"endOfLine": "lf"`)
- Trailing whitespace: **strip** from every line
- Final newline: **one blank line** at end of file

### N2 — Heading Hierarchy

```
H1 (#)       → Document title (exactly ONE per file, first non-frontmatter line)
H2 (##)      → Top-level sections
H3 (###)     → Subsections
H4 (####)    → Rarely used; prefer bullet lists instead
H5/H6        → Do not use
```

**Violations to fix:**
- Multiple H1s → keep the first, demote the rest by one level
- Skipped levels (H1 → H3) → insert the missing level or demote
- Headings ending with `:` → remove the colon
- Headings with trailing spaces or punctuation → strip

### N3 — Code Fences

Every fenced code block **must** have a language identifier:

```
```bash          # shell commands
```typescript    # TypeScript
```javascript    # JavaScript
```json          # JSON / openapi snippets
```yaml          # YAML / docker-compose
```sql           # SQL
```text          # plain text / output with no syntax
```

Blocks with no identifier → add `text` as a safe fallback.
Inline code for commands, file paths, env vars, and config keys: use single backticks.

### N4 — Lists

- Use `-` for unordered lists (not `*` or `+`)
- Indent nested lists with **2 spaces**
- No blank lines between tightly coupled list items
- One blank line before and after every list block

### N5 — Links

| Link type | Rule |
|-----------|------|
| Internal doc | Relative path: `[ORGANIZE.md](ORGANIZE.md)` |
| Internal anchor | Lowercase, hyphens: `[heading](#n2--heading-hierarchy)` |
| External URL | Full HTTPS URL with display text |
| Bare URLs | Wrap in angle brackets: `<https://example.com>` |
| Image alt text | Always present: `![descriptive text](path/to/img.png)` |

### N6 — Tables

- Every table must have a header row and a separator row with at least 3 dashes per cell: `|---|`
- Align columns consistently (left-align text, right-align numbers)
- No trailing spaces inside cells
- Surround table with blank lines

Example well-formed table:

```markdown
| Name | Type | Default | Description |
|------|------|---------|-------------|
| PORT | number | `9000` | HTTP listening port |
```

### N7 — Blank Lines

- One blank line between paragraphs
- One blank line before and after headings
- One blank line before and after code blocks
- One blank line before and after tables
- No double blank lines (collapse to one)

### N8 — Emphasis

- Bold (`**text**`) for UI labels, warnings, key terms
- Italic (`_text_`) for titles of external works, technical terms on first use
- Do not bold entire sentences or headings

### N9 — Frontmatter

If a file uses YAML frontmatter (between `---` delimiters), it must:

- Be the very first content in the file
- Contain only valid YAML
- Have at minimum a `title` key

Files without frontmatter: do not add it unless required by the toolchain.

### N10 — Callouts / Admonitions

Use blockquote prefixes for callout blocks when native admonition syntax is not available:

```markdown
> **Note:** This is informational.

> **Warning:** This may cause data loss.

> **Tip:** Helpful shortcut.
```

---

## Normalization Checklist

Before marking a file normalized, verify:

- [ ] UTF-8, LF, no trailing whitespace, final newline
- [ ] Exactly one H1 as document title
- [ ] No skipped heading levels
- [ ] All code fences have language identifiers
- [ ] Lists use `-` and 2-space indent
- [ ] All internal links are relative and resolve
- [ ] Tables have header + separator rows
- [ ] No double blank lines
- [ ] Frontmatter (if present) has `title`

---

## Running the Normalizer Script

```bash
# Check a single file (dry run — show diff only)
python .claude/skills/documenter/scripts/normalize_markdown.py --dry-run README.md

# Apply fixes to a single file
python .claude/skills/documenter/scripts/normalize_markdown.py README.md

# Apply fixes to all files in docs-catalog.json
python .claude/skills/documenter/scripts/normalize_markdown.py --all

# Show a summary report without modifying files
python .claude/skills/documenter/scripts/normalize_markdown.py --report
```

The script logs every change to `stderr` and writes the modified file to `stdout` (or in-place with `--all`).
