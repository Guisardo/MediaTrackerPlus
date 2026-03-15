---
name: frontend-developer
description: Use when building or modifying MediaTrackerPlus frontend code in client/, including React components, pages, layouts, responsive behavior, dark mode, i18n, Tailwind migration work, shadcn/ui adoption, or styled-components and SCSS removal.
---

# Frontend Developer

Use this skill for UI work in `client/`.

## Use This Skill For

- New or updated React components and pages
- Responsive layout and mobile-first fixes
- Tailwind-first styling and dark-mode support
- Lingui translation updates
- Tailwind, shadcn/ui, styled-components, or SCSS migration work

## Workflow

1. Read the affected files in `client/src/` before changing structure or styling.
2. Check `client/src/components/ui/` for an existing building block before creating a new component.
3. Keep styling Tailwind-first. Avoid adding new styled-components or SCSS, and remove them on contact when the touched scope makes that practical.
4. Wrap all user-visible text in Lingui macros.
5. Design for mobile first, then scale up for larger viewports. Add dark-mode variants for any new or changed visual state.
6. Use the existing typed API and state-management patterns instead of introducing parallel approaches.

## References

- Read [references/COMPONENTS.md](references/COMPONENTS.md) for component patterns, page inventory, and migration notes.
- Read [references/STYLING.md](references/STYLING.md) for Tailwind rules, SCSS-to-Tailwind guidance, and styling migration details.
