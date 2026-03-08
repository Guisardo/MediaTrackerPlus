#!/usr/bin/env python3
"""
scan_docs.py — Catalog every documentation file in the MediaTrackerPlus repository.

Produces docs-catalog.json at the repository root and prints a human-readable
summary to stdout. Run this before any other documenter script.

Usage:
    python .claude/skills/documenter/scripts/scan_docs.py
    python .claude/skills/documenter/scripts/scan_docs.py --json          # JSON output only
    python .claude/skills/documenter/scripts/scan_docs.py --root /path    # custom repo root
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Directories that are never documentation sources
SKIP_DIRS: frozenset[str] = frozenset(
    {
        "node_modules",
        ".git",
        "build",
        "dist",
        ".next",
        "coverage",
        "__pycache__",
        ".cache",
        "vendor",
    }
)

# File extensions treated as documentation
DOC_EXTENSIONS: frozenset[str] = frozenset({".md", ".mdx", ".rst", ".txt"})

# Patterns for files that are generated (should not be hand-edited)
GENERATED_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"^docs/[^/]+\.html$"),
    re.compile(r"^server/build/"),
    re.compile(r"^client/build/"),
    re.compile(r"^rest-api/index\.js$"),
    re.compile(r"^docs/INDEX\.md$"),
    re.compile(r"^docs/api/README\.md$"),
]


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class DocFile:
    """Represents a single catalogued documentation file."""

    rel_path: str
    abs_path: str
    size_bytes: int
    line_count: int
    title: Optional[str]
    h1_count: int
    h2_sections: list[str]
    has_frontmatter: bool
    is_generated: bool
    links_count: int
    images_count: int
    code_blocks_without_lang: int
    issues: list[str] = field(default_factory=list)


@dataclass
class Catalog:
    """Full documentation catalog for a repository."""

    repo_root: str
    total_files: int
    total_size_bytes: int
    files: list[DocFile]
    generated_files: list[str]
    issue_summary: dict[str, int]


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def extract_title(content: str) -> Optional[str]:
    """Return the text of the first H1 heading, or None."""
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("# ") and not line.startswith("## "):
            return line[2:].strip()
    return None


def count_headings(content: str, level: int) -> list[str]:
    """Return all headings at a specific level (1-indexed)."""
    prefix = "#" * level + " "
    headings: list[str] = []
    in_code_fence = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_code_fence = not in_code_fence
        if not in_code_fence and stripped.startswith(prefix) and not stripped.startswith(
            prefix.replace(" ", "")
        ):
            headings.append(stripped[len(prefix) :].strip())
    return headings


def has_yaml_frontmatter(content: str) -> bool:
    """Return True if the file starts with a YAML frontmatter block."""
    lines = content.splitlines()
    return len(lines) > 1 and lines[0].strip() == "---"


def count_links(content: str) -> int:
    """Count all Markdown links [text](url)."""
    return len(re.findall(r"\[([^\]]+)\]\(([^)]+)\)", content))


def count_images(content: str) -> int:
    """Count all Markdown image references ![alt](src)."""
    return len(re.findall(r"!\[([^\]]*)\]\(([^)]+)\)", content))


def count_bare_code_fences(content: str) -> int:
    """Count fenced code blocks that have no language identifier."""
    pattern = re.compile(r"^```\s*$", re.MULTILINE)
    return len(pattern.findall(content))


def detect_issues(
    content: str,
    rel_path: str,
    h1_count: int,
    bare_fences: int,
    has_frontmatter: bool,
) -> list[str]:
    """Return a list of normalization issues found in the file."""
    issues: list[str] = []

    if h1_count == 0:
        issues.append("missing-h1")
    elif h1_count > 1:
        issues.append(f"multiple-h1:{h1_count}")

    if bare_fences > 0:
        issues.append(f"code-fences-without-lang:{bare_fences}")

    # Check for double blank lines
    if "\n\n\n" in content:
        issues.append("double-blank-lines")

    # Check for trailing whitespace on any line
    if any(line != line.rstrip() for line in content.splitlines()):
        issues.append("trailing-whitespace")

    # Check for Windows line endings
    if "\r\n" in content or "\r" in content:
        issues.append("crlf-line-endings")

    # Check for missing final newline
    if content and not content.endswith("\n"):
        issues.append("missing-final-newline")

    # Check for unordered list markers other than '-'
    if re.search(r"^\s*[\*\+] ", content, re.MULTILINE):
        issues.append("non-standard-list-marker")

    return issues


# ---------------------------------------------------------------------------
# File scanner
# ---------------------------------------------------------------------------


def is_generated(rel_path: str) -> bool:
    """Return True if this path matches a known generated-file pattern."""
    for pattern in GENERATED_PATTERNS:
        if pattern.match(rel_path):
            return True
    return False


def scan_file(path: Path, repo_root: Path) -> DocFile:
    """Scan a single documentation file and return its DocFile descriptor."""
    rel_path = str(path.relative_to(repo_root))
    abs_path = str(path.resolve())
    size_bytes = path.stat().st_size

    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        logger.warning("Could not read %s as UTF-8; skipping content analysis.", rel_path)
        content = ""

    lines = content.splitlines()
    line_count = len(lines)

    h1_sections = count_headings(content, level=1)
    h2_sections = count_headings(content, level=2)
    h1_count = len(h1_sections)
    title = h1_sections[0] if h1_sections else extract_title(content)
    frontmatter = has_yaml_frontmatter(content)
    links = count_links(content)
    images = count_images(content)
    bare_fences = count_bare_code_fences(content)
    generated = is_generated(rel_path)

    issues = detect_issues(
        content=content,
        rel_path=rel_path,
        h1_count=h1_count,
        bare_fences=bare_fences,
        has_frontmatter=frontmatter,
    )

    return DocFile(
        rel_path=rel_path,
        abs_path=abs_path,
        size_bytes=size_bytes,
        line_count=line_count,
        title=title,
        h1_count=h1_count,
        h2_sections=h2_sections,
        has_frontmatter=frontmatter,
        is_generated=generated,
        links_count=links,
        images_count=images,
        code_blocks_without_lang=bare_fences,
        issues=issues,
    )


def scan_repository(repo_root: Path) -> Catalog:
    """Walk the entire repository and catalog every documentation file."""
    logger.info("Scanning repository at: %s", repo_root)

    doc_files: list[DocFile] = []

    for dirpath, dirnames, filenames in os.walk(repo_root):
        # Prune skipped directories in-place
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        for filename in sorted(filenames):
            file_path = Path(dirpath) / filename
            if file_path.suffix.lower() in DOC_EXTENSIONS:
                logger.debug("Scanning: %s", file_path)
                doc_file = scan_file(file_path, repo_root)
                doc_files.append(doc_file)

    total_size = sum(f.size_bytes for f in doc_files)
    generated_paths = [f.rel_path for f in doc_files if f.is_generated]

    # Aggregate issue counts
    issue_counts: dict[str, int] = {}
    for doc in doc_files:
        for issue in doc.issues:
            # Normalize issue key (strip colon-delimited counts)
            key = issue.split(":")[0]
            issue_counts[key] = issue_counts.get(key, 0) + 1

    return Catalog(
        repo_root=str(repo_root),
        total_files=len(doc_files),
        total_size_bytes=total_size,
        files=doc_files,
        generated_files=generated_paths,
        issue_summary=issue_counts,
    )


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------


def print_summary(catalog: Catalog) -> None:
    """Print a human-readable summary of the catalog."""
    print(f"\n{'='*60}")
    print(f" Documentation Catalog — {catalog.repo_root}")
    print(f"{'='*60}")
    print(f" Total files   : {catalog.total_files}")
    print(f" Total size    : {catalog.total_size_bytes / 1024:.1f} KB")
    print(f" Generated     : {len(catalog.generated_files)}")
    print(f"{'='*60}\n")

    print(" Files with issues:")
    for doc in sorted(catalog.files, key=lambda f: f.rel_path):
        if doc.issues:
            print(f"  {doc.rel_path}")
            for issue in doc.issues:
                print(f"    ⚠  {issue}")

    print(f"\n Issue summary:")
    if catalog.issue_summary:
        for issue_type, count in sorted(catalog.issue_summary.items()):
            print(f"  {issue_type:<40} {count:>3} file(s)")
    else:
        print("  No issues found.")

    print(f"\n All catalogued files:")
    for doc in sorted(catalog.files, key=lambda f: f.rel_path):
        gen_marker = " [generated]" if doc.is_generated else ""
        title = doc.title or "(no title)"
        print(f"  {doc.rel_path:<55} {doc.line_count:>5} lines  {title}{gen_marker}")

    print()


def write_catalog_json(catalog: Catalog, output_path: Path) -> None:
    """Serialize the catalog to a JSON file."""
    data = asdict(catalog)
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Catalog written to: %s", output_path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Catalog documentation files in the MediaTrackerPlus repository.",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root directory (default: auto-detected from script location)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print the catalog as JSON to stdout instead of human summary",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write JSON catalog to this path (default: <repo-root>/docs-catalog.json)",
    )
    return parser.parse_args(argv)


def find_repo_root(start: Path) -> Path:
    """Walk upward until we find a directory containing package.json or .git."""
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if (candidate / "package.json").exists() or (candidate / ".git").exists():
            return candidate
    raise FileNotFoundError(
        f"Could not determine repository root from: {start}. "
        "Pass --root explicitly."
    )


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    # Resolve repo root
    if args.root:
        repo_root = args.root.resolve()
        if not repo_root.is_dir():
            logger.error("Specified --root is not a directory: %s", repo_root)
            return 1
    else:
        script_path = Path(__file__).resolve()
        try:
            repo_root = find_repo_root(script_path)
        except FileNotFoundError as exc:
            logger.error("%s", exc, exc_info=True)
            return 1

    catalog = scan_repository(repo_root)

    # Determine JSON output path
    output_path = args.output or (repo_root / "docs-catalog.json")

    # Write JSON catalog
    write_catalog_json(catalog, output_path)

    # Print output
    if args.json:
        print(json.dumps(asdict(catalog), indent=2, ensure_ascii=False))
    else:
        print_summary(catalog)

    return 0 if not catalog.issue_summary else 2


if __name__ == "__main__":
    sys.exit(main())
