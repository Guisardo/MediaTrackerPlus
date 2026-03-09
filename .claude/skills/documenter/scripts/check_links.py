#!/usr/bin/env python3
"""
check_links.py — Validate all internal Markdown links in the repository.

Checks three categories (from REINDEX.md R3):
  1. File links  — [text](path/to/file.md) → target file must exist
  2. Anchor links — [text](file.md#anchor) → anchor must exist in target
  3. Image links  — ![alt](path/to/img.png) → image file must exist

Exits with code 0 if no broken links are found, 2 if any are found.

Usage:
    python .claude/skills/documenter/scripts/check_links.py
    python .claude/skills/documenter/scripts/check_links.py --json
    python .claude/skills/documenter/scripts/check_links.py --fix-anchors
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)

CATALOG_FILENAME = "docs-catalog.json"
EXTERNAL_SCHEMES = frozenset({"http", "https", "mailto", "ftp"})


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class BrokenLink:
    source_file: str
    line_number: int
    link_text: str
    link_target: str
    issue: str
    link_type: str  # "file" | "anchor" | "image"


@dataclass
class LinkReport:
    total_links_checked: int
    broken_links: list[BrokenLink]
    files_with_broken_links: int
    clean_files: int

    @property
    def has_errors(self) -> bool:
        return len(self.broken_links) > 0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def find_repo_root(start: Path) -> Path:
    for candidate in [start.resolve(), *start.resolve().parents]:
        if (candidate / "package.json").exists() or (candidate / ".git").exists():
            return candidate
    raise FileNotFoundError("Cannot determine repository root.")


def load_catalog(repo_root: Path) -> dict:
    catalog_path = repo_root / CATALOG_FILENAME
    if not catalog_path.exists():
        raise FileNotFoundError(
            f"{CATALOG_FILENAME} not found. Run scan_docs.py first."
        )
    return json.loads(catalog_path.read_text(encoding="utf-8"))


def is_external(href: str) -> bool:
    """Return True if the href is an external URL."""
    parsed = urlparse(href)
    return parsed.scheme in EXTERNAL_SCHEMES


def is_anchor_only(href: str) -> bool:
    """Return True if href is a same-file anchor reference (starts with '#')."""
    return href.startswith("#")


def heading_to_anchor(text: str) -> str:
    """Convert heading text to GFM anchor slug."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def extract_anchors(content: str) -> frozenset[str]:
    """
    Extract all valid anchor targets from a Markdown file.
    Includes headings and explicit HTML id attributes.
    """
    anchors: set[str] = set()
    in_fence = False

    for line in content.splitlines():
        stripped = line.strip()

        # Track code fences
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence

        if in_fence:
            continue

        # Headings → auto-generated anchors
        m = re.match(r"^(#{1,6})\s+(.*)", stripped)
        if m:
            text = m.group(2).strip()
            anchors.add(heading_to_anchor(text))

        # Explicit HTML anchors: <a id="foo"> or <div id="foo">
        for html_m in re.finditer(r'\bid=["\']([^"\']+)["\']', line):
            anchors.add(html_m.group(1).lower())

    return frozenset(anchors)


# ---------------------------------------------------------------------------
# Link extraction
# ---------------------------------------------------------------------------


LINK_RE = re.compile(
    r"""
    (?P<is_image>!?)                  # optional ! for images
    \[(?P<text>[^\]]*)\]              # link text
    \((?P<href>[^)]+)\)               # href in parens
    """,
    re.VERBOSE,
)


@dataclass
class ExtractedLink:
    line_number: int
    text: str
    href: str
    is_image: bool


def extract_links(content: str) -> list[ExtractedLink]:
    """Extract all Markdown links and images from content."""
    links: list[ExtractedLink] = []
    in_fence = False

    for line_num, line in enumerate(content.splitlines(), start=1):
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
        if in_fence:
            continue

        for m in LINK_RE.finditer(line):
            href = m.group("href").strip()
            # Strip title attribute from href if present: (path "title")
            href = re.sub(r'\s+"[^"]*"$', "", href).strip()
            links.append(ExtractedLink(
                line_number=line_num,
                text=m.group("text"),
                href=href,
                is_image=bool(m.group("is_image")),
            ))

    return links


# ---------------------------------------------------------------------------
# Link validation
# ---------------------------------------------------------------------------


def resolve_link(href: str, source_file: Path, repo_root: Path) -> tuple[Optional[Path], Optional[str]]:
    """
    Resolve a relative href to an absolute path and optional anchor.
    Returns (resolved_path, anchor) or (None, None) on parse failure.
    """
    # Strip anchor
    anchor: Optional[str] = None
    if "#" in href:
        href, anchor = href.rsplit("#", 1)

    if not href:
        # Same-file anchor reference
        return source_file, anchor

    # Clean up the path
    href_path = href.strip()

    # Resolve relative to source file's directory
    resolved = (source_file.parent / href_path).resolve()

    return resolved, anchor


def validate_links(
    source_path: Path,
    content: str,
    repo_root: Path,
    anchor_cache: dict[Path, frozenset[str]],
) -> list[BrokenLink]:
    """Validate all links in a single file. Populates anchor_cache as a side-effect."""
    broken: list[BrokenLink] = []
    links = extract_links(content)

    for link in links:
        href = link.href

        # Skip external URLs — not validated (would require network)
        if is_external(href):
            continue

        # Skip anchor-only refs in the same file
        if is_anchor_only(href):
            anchor = href[1:]
            # Validate anchor exists in this file
            if source_path not in anchor_cache:
                anchor_cache[source_path] = extract_anchors(content)
            if anchor not in anchor_cache[source_path]:
                broken.append(BrokenLink(
                    source_file=str(source_path),
                    line_number=link.line_number,
                    link_text=link.text,
                    link_target=href,
                    issue=f"Anchor '#{anchor}' not found in this file",
                    link_type="anchor",
                ))
            continue

        # Resolve relative path
        try:
            resolved_path, anchor = resolve_link(href, source_path, repo_root)
        except (ValueError, OSError) as exc:
            broken.append(BrokenLink(
                source_file=str(source_path),
                line_number=link.line_number,
                link_text=link.text,
                link_target=href,
                issue=f"Cannot resolve path: {exc}",
                link_type="image" if link.is_image else "file",
            ))
            continue

        if resolved_path is None:
            continue

        # Check file existence
        if not resolved_path.exists():
            broken.append(BrokenLink(
                source_file=str(source_path),
                line_number=link.line_number,
                link_text=link.text,
                link_target=href,
                issue=f"Target file not found: {resolved_path}",
                link_type="image" if link.is_image else "file",
            ))
            continue

        # Check anchor exists in target file
        if anchor:
            if resolved_path not in anchor_cache:
                try:
                    target_content = resolved_path.read_text(encoding="utf-8", errors="replace")
                    anchor_cache[resolved_path] = extract_anchors(target_content)
                except OSError as exc:
                    logger.warning("Cannot read target file %s: %s", resolved_path, exc)
                    anchor_cache[resolved_path] = frozenset()

            if anchor not in anchor_cache[resolved_path]:
                broken.append(BrokenLink(
                    source_file=str(source_path),
                    line_number=link.line_number,
                    link_text=link.text,
                    link_target=href,
                    issue=f"Anchor '#{anchor}' not found in {resolved_path.name}",
                    link_type="anchor",
                ))

    return broken


# ---------------------------------------------------------------------------
# Main validation run
# ---------------------------------------------------------------------------


def run_validation(repo_root: Path, catalog: dict) -> LinkReport:
    """Run link validation across all non-generated doc files."""
    all_broken: list[BrokenLink] = []
    total_links = 0
    files_with_errors: set[str] = set()
    anchor_cache: dict[Path, frozenset[str]] = {}

    for file_info in catalog.get("files", []):
        if file_info.get("is_generated"):
            continue

        file_path = Path(file_info["abs_path"])
        if not file_path.exists():
            logger.warning("File in catalog not found on disk: %s", file_path)
            continue

        content = file_path.read_text(encoding="utf-8", errors="replace")
        links = extract_links(content)
        total_links += len(links)

        broken = validate_links(file_path, content, repo_root, anchor_cache)
        if broken:
            all_broken.extend(broken)
            files_with_errors.add(file_info["rel_path"])

    clean_files = len(catalog.get("files", [])) - len(files_with_errors)

    return LinkReport(
        total_links_checked=total_links,
        broken_links=all_broken,
        files_with_broken_links=len(files_with_errors),
        clean_files=clean_files,
    )


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------


def print_report(report: LinkReport) -> None:
    print(f"\n{'='*60}")
    print(f" Link Validation Report")
    print(f"{'='*60}")
    print(f" Links checked         : {report.total_links_checked}")
    print(f" Broken links          : {len(report.broken_links)}")
    print(f" Files with errors     : {report.files_with_broken_links}")
    print(f" Clean files           : {report.clean_files}")
    print(f"{'='*60}\n")

    if not report.broken_links:
        print(" No broken links found.\n")
        return

    # Group by source file
    by_file: dict[str, list[BrokenLink]] = {}
    for bl in report.broken_links:
        by_file.setdefault(bl.source_file, []).append(bl)

    for source_file in sorted(by_file.keys()):
        print(f" {source_file}")
        for bl in sorted(by_file[source_file], key=lambda b: b.line_number):
            link_type_label = {"file": "FILE", "anchor": "ANCH", "image": "IMG "}.get(
                bl.link_type, "LINK"
            )
            print(
                f"   [{link_type_label}] line {bl.line_number:4d} — "
                f"[{bl.link_text}]({bl.link_target})"
            )
            print(f"         {bl.issue}")
        print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate all internal Markdown links in the documentation.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output report as JSON",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=None,
        help="Repository root (default: auto-detected)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])

    if args.root:
        repo_root = args.root.resolve()
    else:
        try:
            repo_root = find_repo_root(Path(__file__))
        except FileNotFoundError as exc:
            logger.error("%s", exc, exc_info=True)
            return 1

    try:
        catalog = load_catalog(repo_root)
    except FileNotFoundError as exc:
        logger.error("%s", exc, exc_info=True)
        return 1

    report = run_validation(repo_root, catalog)

    if args.json:
        data = asdict(report)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print_report(report)

    return 0 if not report.has_errors else 2


if __name__ == "__main__":
    sys.exit(main())
