# Styling Guide

Rules, patterns, and migration guide for the MediaTrackerPlus `client/` styling system.

## The Problem (Current State)

The codebase has four overlapping styling systems — this causes inconsistency and makes dark mode / mobile support fragile:

| System | Where Used | Migration Action |
|---|---|---|
| **Tailwind CSS v3** (primary) | Most components, pages | Keep — upgrade to v4 |
| **styled-components v5** | GridItem, some modals | Remove on contact |
| **SCSS/SASS** | `main.scss` (grid mixins, base) | Remove on contact |
| **Plain CSS** | `dark.css`, `fullcalendar.css`, `materialIcons.css` | Consolidate into Tailwind |

## The Rule: Tailwind Only

All new styling goes through Tailwind. No exceptions.

```tsx
// ✅ Correct
<div className="flex flex-col gap-4 rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm">

// ❌ Wrong — new styled-component
const Card = styled.div`...`

// ❌ Wrong — new SCSS
import './Card.module.scss'

// ❌ Wrong — inline style
<div style={{ padding: '16px', borderRadius: '12px' }}>
```

## Tailwind v3 → v4 Migration

Tailwind v4 (stable, Jan 2025) changes configuration from `tailwind.config.js` to CSS `@theme {}` blocks.

### Key changes:

**Before (v3 — current):**
```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: '#6366f1' },
      borderRadius: { xl: '12px' },
    },
  },
  plugins: [
    plugin(function({ addUtilities }) {
      addUtilities({ '.btn': { padding: '8px 16px' } });
    }),
  ],
};
```

**After (v4 — target):**
```css
/* src/styles/tailwind.css */
@import "tailwindcss";

@theme {
  --color-brand: #6366f1;
  --radius-xl: 12px;
}

/* Custom utilities replacing the plugin */
@utility btn {
  padding: 8px 16px;
}
```

**Import change:**
```css
/* v3 */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* v4 */
@import "tailwindcss";
```

### Run the automated migration:
```bash
npx @tailwindcss/upgrade
```

This handles most of the v3 → v4 config conversion automatically.

## Mobile-First Rules

Tailwind is mobile-first by default. Write base classes for mobile, then override with `sm:`, `md:`, `lg:`:

| Breakpoint | Width | Use for |
|---|---|---|
| (base) | 0–639px | Mobile phones — **write here first** |
| `sm:` | ≥640px | Large phones, small tablets |
| `md:` | ≥768px | Tablets |
| `lg:` | ≥1024px | Desktop |
| `xl:` | ≥1280px | Wide desktop |

```tsx
// ✅ Mobile-first
<div className="flex-col sm:flex-row">           // column on mobile, row on sm+
<div className="text-sm md:text-base">           // smaller text on mobile
<div className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4">  // poster grid
<div className="p-3 md:p-6">                     // tighter padding on mobile
<div className="w-full sm:w-auto">               // full width on mobile

// ❌ Desktop-first (wrong direction)
<div className="flex-row max-sm:flex-col">
```

## Dark Mode Rules

The app uses `dark:` class-based dark mode (set on `<html>`). Every colour token needs a dark variant:

```tsx
// ✅ Always pair light + dark
<div className="bg-white dark:bg-gray-900">
<p className="text-gray-900 dark:text-gray-100">
<div className="border-gray-200 dark:border-gray-700">
<button className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
<div className="shadow-sm dark:shadow-gray-800">

// ❌ Light only — breaks in dark mode
<div className="bg-white">
<p className="text-gray-900">
```

### Toggling dark mode (for Selenium testing):
```js
// Enable dark mode
document.documentElement.classList.add('dark');
// Disable dark mode
document.documentElement.classList.remove('dark');
// Toggle
document.documentElement.classList.toggle('dark');
```

## Container Queries (Tailwind v4)

Container queries let components respond to their container width rather than the viewport. Use them for reusable components that appear in variable-width contexts (poster grids, detail panels, sidebars):

```tsx
// Mark a container
<div className="@container">
  <div className="flex-col @sm:flex-row">   // switches layout at container ≥640px
    <img className="w-full @sm:w-32" />     // constrained width when container is wide enough
  </div>
</div>
```

This is especially useful for `GridItem` — it can be used in both a 2-column and 4-column grid and adapt to each without hardcoded breakpoints.

## Removing styled-components

When you encounter a file using styled-components, follow this migration process:

### Step 1 — Identify all styled components in the file
```bash
grep -n "styled\." client/src/components/GridItem.tsx
```

### Step 2 — Map styled props to Tailwind conditional classes
```tsx
// Before
const Card = styled.div<{ active?: boolean; compact?: boolean }>`
  background: ${p => p.active ? '#3b82f6' : '#fff'};
  padding: ${p => p.compact ? '4px' : '12px'};
  border-radius: 8px;
`;
<Card active={isActive} compact={isCompact} />

// After
import { clsx } from 'clsx';

<div className={clsx(
  'rounded-lg',
  isActive ? 'bg-blue-500' : 'bg-white dark:bg-gray-900',
  isCompact ? 'p-1' : 'p-3',
)} />
```

### Step 3 — Handle dynamic colour values
If a styled-component uses a colour that comes from JavaScript (e.g., genre colour from API), use inline style for that specific value:
```tsx
// Genre colour comes from the API — no Tailwind class exists for it
<div
  className="rounded-full px-2 py-0.5 text-xs font-medium"
  style={{ backgroundColor: genre.color }}
>
  {genre.name}
</div>
```

### Step 4 — Verify there are no remaining imports
```bash
grep "styled-components" client/src/components/GridItem.tsx  # should return nothing
```

## Removing SCSS

### Current SCSS grid mixins (to replace)

The `main.scss` file defines grid mixins like:
```scss
// Current SCSS — main.scss
@mixin item-grid($cols) {
  display: grid;
  grid-template-columns: repeat($cols, 1fr);
  gap: 12px;
}

.items-grid-mobile { @include item-grid(2); }
.items-grid-tablet { @include item-grid(3); }
.items-grid-desktop { @include item-grid(4); }
```

Tailwind replacement:
```tsx
// Replace SCSS grid classes with Tailwind
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
```

### When SCSS is fully removed from a file:
1. Delete the SCSS import in the component
2. Check if `main.scss` still imports the removed partial — if so, remove that `@use` too
3. Run `npm start` and confirm no build error

## Tailwind Token Reference (MediaTrackerPlus)

Use these standard tokens. Do not hardcode hex values:

### Spacing
- Card padding: `p-3` mobile, `p-4` desktop
- Grid gap: `gap-3` mobile, `gap-4` desktop
- Section spacing: `py-6` mobile, `py-8` desktop

### Border radius
- Cards: `rounded-lg` (8px)
- Badges: `rounded-full`
- Buttons: `rounded-md` (6px)
- Input: `rounded-md`

### Typography
- Page title: `text-xl font-bold` mobile, `text-2xl` desktop
- Section heading: `text-base font-semibold`
- Body: `text-sm`
- Caption / metadata: `text-xs text-gray-500 dark:text-gray-400`

### Shadows
- Cards: `shadow-sm dark:shadow-none`
- Modals: `shadow-xl`
- Dropdowns: `shadow-md`

### Focus / interactive states
Always include focus-visible ring for keyboard accessibility:
```tsx
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
```

## Colour Palette

The app supports light and dark mode. Use Tailwind's built-in colour scale:

| Use | Light | Dark |
|---|---|---|
| Page background | `bg-gray-50` | `dark:bg-gray-950` |
| Card background | `bg-white` | `dark:bg-gray-900` |
| Border | `border-gray-200` | `dark:border-gray-700` |
| Body text | `text-gray-900` | `dark:text-gray-100` |
| Muted text | `text-gray-500` | `dark:text-gray-400` |
| Primary action | `bg-blue-600` | `dark:bg-blue-500` |
| Destructive action | `bg-red-600` | `dark:bg-red-500` |
| Star rating | `text-yellow-400` | `text-yellow-400` |
| Success | `text-green-600` | `dark:text-green-400` |

## Transition & Animation

Replace React Spring with Tailwind CSS transitions and shadcn/ui built-ins:

```tsx
// ✅ CSS transitions (fast, no JS dependency)
<div className="transition-all duration-200 ease-out">

// ✅ @starting-style (Tailwind v4) — enter/exit without JS
<div className="opacity-0 [&:not([hidden])]:opacity-100 transition-opacity duration-150">

// ❌ React Spring for simple show/hide transitions
import { useSpring, animated } from '@react-spring/web';
const style = useSpring({ opacity: show ? 1 : 0 });
<animated.div style={style}>
```

shadcn/ui Dialog, Sheet, and Tooltip already have built-in CSS animations. Do not add React Spring on top of them.
