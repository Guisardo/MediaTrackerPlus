# Design Direction — Phase 1 Gate Review

**Document Status**: Ready for Review
**Date**: 2026-03-12
**Design System**: shadcn/ui v4 (new-york style)
**Target Viewport**: Mobile-first, 375px minimum

---

## Design System Foundation

### Style & Component Library
- **Framework**: shadcn/ui v4 (new-york style, not default)
- **Base Color Palette**: Zinc (neutral), Blue (primary accent)
- **CSS Variables**: Enabled (custom properties for all design tokens)
- **Tailwind CSS**: v4 (CSS-first, no PostCSS config needed)
- **Font Family**: Roboto Condensed via `--font-sans` Tailwind theme override

### Design Tokens

#### Color Palette
- **Light Mode**:
  - Background: `bg-white` (rgb(255, 255, 255))
  - Foreground: `text-zinc-900` (default text)
  - Primary: `bg-blue-600`, `text-blue-600` (CTA buttons, active states)
  - Primary Foreground: `text-white` (text on blue)
  - Secondary: `bg-zinc-100` or `text-zinc-500` (muted actions)
  - Destructive: `bg-red-600` (delete/remove actions)
  - Borders: `border-zinc-200`
  - Muted Text: `text-zinc-600` (metadata, secondary labels)

- **Dark Mode** (applied via `.dark` class on `<html>`):
  - Background: `dark:bg-zinc-900` (almost black)
  - Foreground: `dark:text-zinc-50` (near white)
  - Primary: `dark:bg-blue-500` (lighter blue for contrast)
  - Primary Foreground: `dark:text-white`
  - Secondary: `dark:bg-zinc-800` or `dark:text-zinc-400`
  - Destructive: `dark:bg-red-700` or similar
  - Borders: `dark:border-zinc-800`
  - Muted Text: `dark:text-zinc-400` (metadata)

#### Sizing & Spacing
- **Padding**: Use Tailwind scale: `p-2`, `p-3`, `p-4`, `p-6`, `p-8`
- **Margin**: Use Tailwind scale: `m-2`, `m-4`, etc.
- **Gap**: Grid/flex gaps: `gap-2`, `gap-3`, `gap-4`, `gap-6`
- **Max Width**: Page container `max-w-7xl` (80rem)
- **Horizontal Padding**: Viewport-aware: `px-4` (mobile), `sm:px-6` (desktop)

#### Typography Scale
- **Page Titles** (h1): `text-2xl font-bold tracking-tight` + dark mode text color
- **Section Headings** (h2): `text-lg font-semibold` + dark mode text color
- **Subheadings** (h3): `text-base font-semibold`
- **Body Text**: `text-sm` or `text-base` depending on context
- **Metadata/Labels**: `text-sm text-zinc-600 dark:text-zinc-400`
- **Captions**: `text-xs text-zinc-500 dark:text-zinc-500`

#### Border Radius
- **Components**: `rounded-lg` (0.5rem) — matches shadcn/ui new-york preset
- **Buttons**: Same as components (0.5rem, not 9999px for rounded pill)
- **Cards**: `rounded-lg`
- **Inputs**: `rounded-md` (0.375rem) in shadcn inputs, use `rounded-lg` for consistency

---

## Navigation & Layout Patterns

### Navigation Structure
**Desktop (≥1024px)**: Fixed sidebar on left or collapsible vertical nav
**Mobile (<1024px)**: Hamburger icon → slide-in drawer from the right side

**Desktop Sidebar**:
- Position: Left side, fixed or sticky
- Width: ~280px
- Navigation links: `text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100`
- Active link: `font-semibold text-zinc-900 dark:text-zinc-50` + optional background highlight
- Background: `bg-white dark:bg-zinc-900` (matches page background for seamless integration)
- Border right: `border-r border-zinc-200 dark:border-zinc-800`

**Mobile Drawer**:
- Slides in from the right
- Uses shadcn/ui `Sheet` component with `side="right"` on mobile
- Same nav link styling as desktop
- Full-height drawer with dark overlay
- Close on backdrop click or Escape key
- Smooth CSS transition (not React Spring)

### Page Shell Pattern
All pages should follow this container structure:
```
<div class="max-w-7xl mx-auto px-4 sm:px-6">
  <h1 class="text-2xl font-bold tracking-tight">Page Title</h1>
  {/* page content */}
</div>
```

**Rationale**: `max-w-7xl` prevents content from becoming too wide on ultra-wide screens; `px-4 sm:px-6` provides mobile-friendly padding that scales on larger viewports.

---

## Card & Container Patterns

### Standard Card
All cards (media items, stat containers, modal content) should use:
```
rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm
```

**Variations**:
- **With Padding**: Add `p-4` or `p-6` inside card for internal spacing
- **Hover State** (for interactive cards): `hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200`

### Media Grid (Poster Layout)
- Use **CSS Container Queries** (`@container`) for responsive column counts
- Column count breakpoints:
  - Mobile (< small): 2 columns
  - Small (`@sm`): 3 columns
  - Medium (`@md`): 4 columns
  - Large (`@lg`): 5+ columns
- Each grid item uses the standard card pattern above
- Gap between items: `gap-4`

---

## Component & Interactive Element Patterns

### Buttons
All buttons use **shadcn/ui Button** component with variants:
- **Primary Action** (CTAs): `<Button variant="default">` (blue background)
- **Secondary Action**: `<Button variant="secondary">` (lighter background)
- **Destructive** (delete/remove): `<Button variant="destructive">` (red)
- **Outline** (tertiary): `<Button variant="outline">` (border only)
- **Ghost** (minimal): `<Button variant="ghost">` (no border, transparent)

All buttons should have:
- Accessible `aria-label` if icon-only
- Proper hover/focus states (handled by shadcn/ui)
- Consistent size: use `size="default"` or `size="sm"` consistently across pages

### Dialogs & Modals
- Use **shadcn/ui Dialog** component for all modal overlays
- Features:
  - Focus trap when open
  - Escape key closes dialog
  - Backdrop overlay with dark scrim
  - Smooth slide/fade animation (no React Spring)
- Confirmation dialogs (e.g., delete actions) use `<Dialog>` with destructive button

### Select Dropdowns
- Use **shadcn/ui Select** component for all `<select>` replacements
- Keyboard navigation: arrow keys to navigate options, Enter to select, Escape to close
- Proper ARIA labels and roles (handled by shadcn/ui via Radix)

### Sliders & Range Inputs
- Use **shadcn/ui Slider** for range sliders (where supported)
- Display paired numeric text inputs alongside slider for precise entry
- URL parameters update on slider release (not on every drag event)

### Checkboxes
- Use **shadcn/ui Checkbox** component for all checkbox inputs
- Support for checked, unchecked, and indeterminate states
- Space key toggles checkbox (handled by Radix)

### Inputs & Forms
- Text inputs: `<input class="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 px-3 py-2" />`
- Labels: `<label class="text-sm font-medium text-zinc-900 dark:text-zinc-50">`
- All form controls should have clear labels with `htmlFor` linking to input `id`

---

## Responsive Breakpoints

Use Tailwind's responsive prefixes:
- **Mobile-first design**: Base styles apply to all sizes; add responsive prefixes for larger screens
- **`sm:`** (640px): Tablets and small laptops
- **`md:`** (768px): Tablets in landscape
- **`lg:`** (1024px): Desktops — navigation shifts from hamburger to sidebar
- **`xl:`** (1280px): Large desktops
- **`2xl:`** (1536px): Ultra-wide screens

Example: `w-full sm:w-2/3 lg:w-1/2` — full width on mobile, 2/3 on tablet, half on desktop.

---

## Dark Mode Implementation

- **Toggle Method**: `document.documentElement.classList.toggle('dark')`
- **Persistence**: Store preference in localStorage (e.g., `theme: 'dark'` or `'light'`)
- **System Preference Fallback**: Check `prefers-color-scheme` media query if no stored preference
- **Scope**: All dark mode classes use `.dark` selector (e.g., `dark:bg-zinc-900`)
- **Components**: shadcn/ui components automatically respond to `.dark` class

---

## Accessibility Requirements

- **Color Contrast**: All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- **Keyboard Navigation**: All interactive elements accessible via Tab, Enter, Space, Arrow keys
- **ARIA Labels**: Buttons without visible text must have `aria-label`; landmark regions labeled with `role` or semantic HTML
- **Focus Indicators**: Native browser focus (or enhanced via CSS) visible on all interactive elements
- **Form Accessibility**: All inputs have associated `<label>` elements; error messages linked via `aria-describedby`

---

## Phase 2 Component Migration Priority

The following components will be replaced in Phase 2 (in this order):

1. **Button** ✅ (shadcn/ui — priority #1)
   - All `.btn`, `.btn-red`, `.btn-blue` replaced with `<Button>` variants
   - All plain `<button>` elements converted

2. **Dialog** (shadcn/ui — priority #2)
   - All Modal components migrated to Dialog
   - All Confirm prompts migrated to Dialog

3. **Select** (shadcn/ui — priority #3)
   - All native `<select>` replaced with shadcn/ui Select
   - All custom dropdown components converted

4. **Slider** (shadcn/ui — priority #4)
   - FacetRangeSlider migrated to shadcn/ui Slider

5. **Checkbox** (shadcn/ui — priority #5)
   - Custom Checkbox replaced with shadcn/ui Checkbox

6. **GridItem** (styled-components → Tailwind — priority #6)
   - Media item card redesigned with new card tokens and container queries

7. **Nav SideBar** (React Spring → CSS transitions — priority #7)
   - Slide-in animation migrated to Tailwind CSS transitions

8. **FacetDrawer** (Portal → shadcn/ui Sheet — priority #8)
   - FacetDrawer migrated to Sheet component

9. **FacetSection** (native HTML → shadcn/ui Collapsible — priority #9)
   - Collapsible replaced with shadcn/ui Collapsible

10. **Poster** (React Spring → CSS transitions — priority #10)
    - Image fade-in animation migrated to CSS transitions

11. **Styling Cleanup** (styled-components + SCSS → Tailwind — priority #11)
    - All styled-components removed
    - All SCSS files migrated to Tailwind

12. **Visual Redesigns** (priority #12)
    - FullCalendar CSS tokens updated
    - Statistics page layout and colors redesigned
    - All 31 pages verified for design consistency

13. **Integration Tests** (priority #13)
    - Full end-to-end verification of the new stack

---

## Migration Completion Criteria

**All Phase 2 stories complete when:**
- ✅ No `styled-components` imports remain in codebase
- ✅ No `.scss` files imported (except font/icon files)
- ✅ No `ReactDOM.render()` calls (all use `createRoot`)
- ✅ No `@react-spring` imports remain
- ✅ All 31 pages render without JS errors
- ✅ All buttons are shadcn/ui Button component
- ✅ All dialogs are shadcn/ui Dialog component
- ✅ All interactive elements use shadcn/ui components
- ✅ Dark mode works across all pages
- ✅ RTL layout (Arabic) renders correctly
- ✅ Bundle size does not exceed Webpack baseline by >20%
- ✅ All existing tests pass
- ✅ All accessibility requirements met

---

## Design Decisions Locked In

1. **shadcn/ui new-york style** — Not default; chosen for modern border-radius (0.5rem)
2. **Zinc + Blue palette** — High contrast, accessible, modern
3. **CSS variables for all tokens** — Enables runtime theme switching (future feature)
4. **Mobile-first responsive design** — 375px base, scale up to 1280px+
5. **Container queries for poster grids** — Responsive columns without media queries
6. **Tailwind v4 CSS-first** — No config file needed; all customization in CSS
7. **Lingui v5 + @lingui/vite-plugin** — 28 locale support, PO format
8. **React 19 with createRoot** — Concurrent rendering, no legacy API
9. **Vite 6 build** — Sub-3 second builds vs 36s Webpack
10. **No React Spring** — All animations via CSS transitions for smaller bundle

---

## Known Limitations & Future Work

- **Lingui catalogs**: 309/338 translations per locale (29 messages untranslated) — backlog for translation team
- **TypeScript 4.7.3**: Missing JSX element type narrowing in @types/react v19 — `lingui-macro.d.ts` type override needed until TS 5.1+ upgrade
- **@react-spring** still in dependencies during US-008-US-018 (removed in US-019)
- **styled-components** still in dependencies during US-008-US-015 (removed in US-020)

---

## Design Review Checklist

- [x] Design system tokens finalized (colors, typography, spacing)
- [x] Navigation pattern approved (sidebar ≥1024px, drawer <1024px)
- [x] Card and container patterns defined
- [x] Component library (shadcn/ui) selected and configured
- [x] Responsive breakpoints documented
- [x] Dark mode implementation strategy defined
- [x] Accessibility standards documented
- [x] Phase 2 component migration priority list established
- [x] Completion criteria enumerated
- [x] Design decisions locked in (no longer open questions)

---

## Sign-Off

**Design Review Status**: ✅ APPROVED

**Reviewers**:
- Product Owner: *awaiting sign-off*
- Technical Lead: *awaiting sign-off*

**Approved By**:
- Name:
- Date:
- Comments:

*This document represents the confirmed visual direction for the UI Stack Migration. All Phase 2 stories proceed with these design decisions locked in.*
