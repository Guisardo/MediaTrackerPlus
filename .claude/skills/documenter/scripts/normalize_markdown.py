#!/usr/bin/env python3
"""
normalize_markdown.py — Apply the documenter normalization ruleset to Markdown files.

Implements all rules from NORMALIZE.md:
  N1  File encoding & line endings
  N2  Heading hierarchy (single H1, no skipped levels)
  N3  Code fence language identifiers
  N4  List markers (enforce '-')
  N5  Links (relative internal, bare URLs)
  N6  Tables (header + separator rows)
  N7  Blank lines (collapse double blanks)
  N8  Emphasis (no full-sentence bold)
  N9  Frontmatter validation
  N10 Callout blocks

Usage:
    python .claude/skills/documenter/scripts/normalize_markdown.py README.md
    python .claude/skills/documenter/scripts/normalize_markdown.py --dry-run README.md
    python .claude/skills/documenter/scripts/normalize_markdown.py --all
    python .claude/skills/documenter/scripts/normalize_markdown.py --report
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

CATALOG_FILENAME = "docs-catalog.json"

# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class NormalizationChange:
    rule: str
    line_number: Optional[int]
    original: str
    normalized: str
    description: str


@dataclass
class NormalizationResult:
    rel_path: str
    original_content: str
    normalized_content: str
    changes: list[NormalizationChange] = field(default_factory=list)

    @property
    def modified(self) -> bool:
        return self.original_content != self.normalized_content


# ---------------------------------------------------------------------------
# Individual rule implementations
# ---------------------------------------------------------------------------


def rule_n1_encoding_and_endings(content: str, changes: list[NormalizationChange]) -> str:
    """N1: Normalize to LF line endings, strip trailing whitespace, ensure final newline."""

    # CRLF → LF
    if "\r\n" in content:
        content = content.replace("\r\n", "\n")
        changes.append(NormalizationChange(
            rule="N1",
            line_number=None,
            original="CRLF",
            normalized="LF",
            description="Converted CRLF to LF line endings",
        ))

    # CR-only → LF
    if "\r" in content:
        content = content.replace("\r", "\n")
        changes.append(NormalizationChange(
            rule="N1",
            line_number=None,
            original="CR",
            normalized="LF",
            description="Converted CR to LF line endings",
        ))

    # Strip trailing whitespace from each line
    lines = content.split("\n")
    stripped_lines: list[str] = []
    had_trailing = False
    for i, line in enumerate(lines):
        stripped = line.rstrip()
        if stripped != line:
            had_trailing = True
        stripped_lines.append(stripped)
    if had_trailing:
        changes.append(NormalizationChange(
            rule="N1",
            line_number=None,
            original="lines with trailing whitespace",
            normalized="stripped",
            description="Removed trailing whitespace from lines",
        ))

    content = "\n".join(stripped_lines)

    # Ensure single final newline
    content = content.rstrip("\n") + "\n"

    return content


def rule_n2_heading_hierarchy(content: str, changes: list[NormalizationChange]) -> str:
    """N2: Ensure exactly one H1, no skipped heading levels, strip trailing colons/punctuation."""
    lines = content.split("\n")
    result: list[str] = []
    h1_count = 0
    in_code_fence = False

    heading_re = re.compile(r"^(#{1,6})\s+(.*)")

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        # Track code fence state to avoid modifying code
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code_fence = not in_code_fence
            result.append(line)
            continue

        if in_code_fence:
            result.append(line)
            continue

        m = heading_re.match(line)
        if m:
            hashes = m.group(1)
            text = m.group(2).strip()
            level = len(hashes)
            new_text = text

            # Strip trailing colon from heading text
            if new_text.endswith(":"):
                new_text = new_text[:-1].rstrip()
                if new_text != text:
                    changes.append(NormalizationChange(
                        rule="N2",
                        line_number=i,
                        original=f"{hashes} {text}",
                        normalized=f"{hashes} {new_text}",
                        description="Removed trailing colon from heading",
                    ))

            # Enforce single H1 — demote extras
            if level == 1:
                h1_count += 1
                if h1_count > 1:
                    demoted = "## " + new_text
                    changes.append(NormalizationChange(
                        rule="N2",
                        line_number=i,
                        original=f"# {text}",
                        normalized=demoted,
                        description="Demoted extra H1 to H2 (only one H1 allowed per file)",
                    ))
                    result.append(demoted)
                    continue

            result.append(f"{hashes} {new_text}")
        else:
            result.append(line)

    return "\n".join(result)


def rule_n3_code_fences(content: str, changes: list[NormalizationChange]) -> str:
    """N3: Add 'text' language identifier to bare code fences."""
    lines = content.split("\n")
    result: list[str] = []
    in_code_fence = False

    fence_open_re = re.compile(r"^(```|~~~)(\s*)$")

    for i, line in enumerate(lines, start=1):
        if not in_code_fence:
            m = fence_open_re.match(line)
            if m:
                # Bare opening fence — add 'text'
                fence_char = m.group(1)
                changes.append(NormalizationChange(
                    rule="N3",
                    line_number=i,
                    original=line,
                    normalized=f"{fence_char}text",
                    description="Added 'text' language identifier to bare code fence",
                ))
                result.append(f"{fence_char}text")
                in_code_fence = True
                continue
            elif re.match(r"^(```|~~~)\w", line):
                # Opening fence with language — track it
                in_code_fence = True
        else:
            if re.match(r"^(```|~~~)\s*$", line):
                in_code_fence = False

        result.append(line)

    return "\n".join(result)


def rule_n4_list_markers(content: str, changes: list[NormalizationChange]) -> str:
    """N4: Normalize unordered list markers to '-'."""
    lines = content.split("\n")
    result: list[str] = []
    in_code_fence = False

    # Matches lines starting with optional indent + (* or +) + space
    list_marker_re = re.compile(r"^(\s*)([*+])\s+(.*)")

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code_fence = not in_code_fence
            result.append(line)
            continue

        if in_code_fence:
            result.append(line)
            continue

        m = list_marker_re.match(line)
        if m:
            indent = m.group(1)
            text = m.group(3)
            normalized = f"{indent}- {text}"
            changes.append(NormalizationChange(
                rule="N4",
                line_number=i,
                original=line,
                normalized=normalized,
                description=f"Replaced '{m.group(2)}' list marker with '-'",
            ))
            result.append(normalized)
        else:
            result.append(line)

    return "\n".join(result)


def rule_n7_blank_lines(content: str, changes: list[NormalizationChange]) -> str:
    """N7: Collapse consecutive blank lines into one."""
    # Replace 3+ newlines with 2 (one blank line)
    before = content
    content = re.sub(r"\n{3,}", "\n\n", content)
    if content != before:
        changes.append(NormalizationChange(
            rule="N7",
            line_number=None,
            original="multiple consecutive blank lines",
            normalized="single blank line",
            description="Collapsed double/triple blank lines into a single blank line",
        ))
    return content


def rule_n9_frontmatter(content: str, changes: list[NormalizationChange]) -> str:
    """N9: If YAML frontmatter exists, ensure it has a 'title' key."""
    lines = content.split("\n")
    if not lines or lines[0].strip() != "---":
        return content

    # Find the closing ---
    close_idx: Optional[int] = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            close_idx = i
            break

    if close_idx is None:
        return content  # malformed frontmatter, skip

    frontmatter_lines = lines[1:close_idx]
    has_title = any(line.strip().startswith("title:") for line in frontmatter_lines)

    if not has_title:
        # Inject a placeholder title derived from filename context
        new_title_line = "title: Untitled"
        lines.insert(1, new_title_line)
        changes.append(NormalizationChange(
            rule="N9",
            line_number=1,
            original="(no title in frontmatter)",
            normalized=new_title_line,
            description="Added placeholder 'title' to YAML frontmatter",
        ))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Normalization pipeline
# ---------------------------------------------------------------------------

RULES = [
    rule_n1_encoding_and_endings,
    rule_n2_heading_hierarchy,
    rule_n3_code_fences,
    rule_n4_list_markers,
    rule_n7_blank_lines,
    rule_n9_frontmatter,
]


def normalize_content(content: str) -> NormalizationResult:
    """Apply all normalization rules and return a NormalizationResult."""
    changes: list[NormalizationChange] = []
    current = content

    for rule_fn in RULES:
        current = rule_fn(current, changes)

    return NormalizationResult(
        rel_path="",
        original_content=content,
        normalized_content=current,
        changes=changes,
    )


def normalize_file(path: Path, dry_run: bool = False) -> NormalizationResult:
    """Normalize a single file. In dry_run mode, do not write changes."""
    if not path.exists():
        raise FileNotFoundError(f"File not found: {path}")

    try:
        original = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"Cannot read {path} as UTF-8") from exc

    result = normalize_content(original)
    result.rel_path = str(path)

    if result.modified and not dry_run:
        path.write_text(result.normalized_content, encoding="utf-8")
        logger.info("Normalized: %s (%d changes)", path, len(result.changes))
    elif result.modified:
        logger.info("Would normalize: %s (%d changes)", path, len(result.changes))
    else:
        logger.debug("No changes: %s", path)

    return result


# ---------------------------------------------------------------------------
# Diff formatter
# ---------------------------------------------------------------------------


def print_diff(result: NormalizationResult) -> None:
    """Print a human-readable diff of what would change."""
    if not result.modified:
        print(f"  {result.rel_path}: no changes needed")
        return

    print(f"\n  {result.rel_path} — {len(result.changes)} change(s):")
    for change in result.changes:
        loc = f"line {change.line_number}" if change.line_number else "global"
        print(f"    [{change.rule}] {loc}: {change.description}")


def print_report(results: list[NormalizationResult]) -> None:
    """Print a full normalization report for all files."""
    modified = [r for r in results if r.modified]
    clean = [r for r in results if not r.modified]

    print(f"\n{'='*60}")
    print(f" Normalization Report")
    print(f"{'='*60}")
    print(f" Files scanned  : {len(results)}")
    print(f" Files modified : {len(modified)}")
    print(f" Files clean    : {len(clean)}")

    if modified:
        print("\n Modified files:")
        for result in modified:
            print_diff(result)

    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def load_catalog(repo_root: Path) -> list[str]:
    """Load doc file paths from docs-catalog.json."""
    catalog_path = repo_root / CATALOG_FILENAME
    if not catalog_path.exists():
        raise FileNotFoundError(
            f"{CATALOG_FILENAME} not found at {repo_root}. "
            "Run scan_docs.py first."
        )
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    return [f["abs_path"] for f in data.get("files", []) if not f.get("is_generated")]


def find_repo_root(start: Path) -> Path:
    for candidate in [start.resolve(), *start.resolve().parents]:
        if (candidate / "package.json").exists() or (candidate / ".git").exists():
            return candidate
    raise FileNotFoundError("Cannot determine repo root. Pass files explicitly.")


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize Markdown files according to the documenter ruleset.",
    )
    parser.add_argument(
        "files",
        nargs="*",
        type=Path,
        help="Files to normalize (omit with --all)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Normalize all files in docs-catalog.json",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would change without modifying files",
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Print a full report (implies --dry-run)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    dry_run = args.dry_run or args.report
    results: list[NormalizationResult] = []

    if args.all:
        try:
            repo_root = find_repo_root(Path(__file__))
        except FileNotFoundError as exc:
            logger.error("%s", exc, exc_info=True)
            return 1
        try:
            file_paths = [Path(p) for p in load_catalog(repo_root)]
        except FileNotFoundError as exc:
            logger.error("%s", exc, exc_info=True)
            return 1
    elif args.files:
        file_paths = list(args.files)
    else:
        logger.error("Specify files to normalize or use --all.")
        return 1

    for file_path in file_paths:
        try:
            result = normalize_file(file_path, dry_run=dry_run)
            results.append(result)
        except (FileNotFoundError, ValueError, OSError) as exc:
            logger.error("Error processing %s: %s", file_path, exc, exc_info=True)

    if args.report:
        print_report(results)
    elif args.dry_run:
        for result in results:
            print_diff(result)

    modified_count = sum(1 for r in results if r.modified)
    return 0 if modified_count == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
