# Component Reference

Complete inventory and shadcn/ui migration mapping for MediaTrackerPlus `client/src/components/`.

## Migration Status Key

| Symbol | Meaning |
|---|---|
| ✅ | Fully migrated to Tailwind + shadcn/ui |
| 🔄 | Partially migrated — styled-components or SCSS still present |
| ❌ | Not yet migrated — still uses styled-components or SCSS |
| 🆕 | New component — use shadcn/ui from the start |

## Core Layout Components

| Component | File | Status | shadcn/ui Equivalent |
|---|---|---|---|
| `Nav` | `Nav.tsx` | 🔄 | No direct equivalent — keep custom, use shadcn `NavigationMenu` primitives |
| `Modal` | `Modal.tsx` | 🔄 | `Dialog` from shadcn/ui — replaces React Spring animation |
| `Portal` | `Portal.tsx` | ✅ | Keep as-is (React portal, no styling) |
| `FacetDrawer` | `FacetDrawer.tsx` | 🔄 | `Sheet` from shadcn/ui (slide-in panel) |
| `Facets` | `Facets.tsx` | ❌ | Compose using shadcn `Accordion` + `Checkbox` + `Slider` |
| `PaginatedGridItems` | `PaginatedGridItems.tsx` | 🔄 | Keep custom grid, remove styled-components wrapper |

## Media Display Components

| Component | File | Status | shadcn/ui Equivalent |
|---|---|---|---|
| `GridItem` | `GridItem.tsx` | ❌ | Custom — remove styled-components, rewrite with Tailwind |
| `Poster` | `Poster.tsx` | 🔄 | Custom — uses `aspect-[2/3]` Tailwind class |
| `PosterCard` | `PosterCard.tsx` | 🔄 | Compose with shadcn `Card` + custom poster area |
| `MediaTypeBadge` | `MediaTypeBadge.tsx` | 🔄 | `Badge` from shadcn/ui |
| `SeasonList` | `SeasonList.tsx` | ❌ | Custom + shadcn `Collapsible` |
| `EpisodeList` | `EpisodeList.tsx` | ❌ | Custom |

## Interactive / Form Components

| Component | File | Status | shadcn/ui Equivalent |
|---|---|---|---|
| `StarRating` | `StarRating.tsx` | ❌ | Custom — use Radix `Slider` primitive (already installed) |
| `SetProgress` | `SetProgress.tsx` | 🔄 | `Slider` from shadcn/ui (wraps `@radix-ui/react-slider`) |
| `SelectSeenDate` | `SelectSeenDate.tsx` | ❌ | `Popover` + `Calendar` from shadcn/ui |
| `Checkbox` | `Checkbox.tsx` | 🔄 | `Checkbox` from shadcn/ui |
| `AddToListModal` | `AddToListModal.tsx` | ❌ | `Dialog` + `Command` from shadcn/ui |
| `AddOrEditGroupButton` | `AddOrEditGroupButton.tsx` | ❌ | `Dialog` + `Button` from shadcn/ui |
| `GroupSelector` | `GroupSelector.tsx` | ❌ | `Select` or `Combobox` from shadcn/ui |

## Data Display Components

| Component | File | Status | shadcn/ui Equivalent |
|---|---|---|---|
| `StatisticsSummary` | `StatisticsSummary.tsx` | ❌ | `Card` from shadcn/ui |
| `StatisticsSegment` | `StatisticsSegment.tsx` | ❌ | Custom charts — keep custom or add `recharts` |
| `StatisticsGenreSegment` | `StatisticsGenreSegment.tsx` | ❌ | Custom |
| `Calendar` | Calendar components | ❌ | FullCalendar — keep, just style-override with Tailwind |

## shadcn/ui Component Installation

Before writing a custom component, check if a shadcn/ui primitive covers the need:

```bash
# Install a specific component
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add sheet
npx shadcn@latest add slider
npx shadcn@latest add checkbox
npx shadcn@latest add badge
npx shadcn@latest add card
npx shadcn@latest add select
npx shadcn@latest add command
npx shadcn@latest add popover
npx shadcn@latest add accordion
npx shadcn@latest add collapsible
npx shadcn@latest add navigation-menu
```

Components are installed into `client/src/components/ui/`. Always check there before creating something from scratch.

## GridItem Migration Guide

`GridItem.tsx` is the most-used component and the most critical to migrate. It uses `styled-components` extensively.

Current pattern (to remove):
```tsx
// ❌ Current — styled-components
const StyledCard = styled.div<{ highlighted?: boolean }>`
  background: ${props => props.highlighted ? '#ff0' : 'transparent'};
  border-radius: 8px;
  padding: 12px;
`;

return <StyledCard highlighted={isHighlighted}>...</StyledCard>;
```

Migrated pattern:
```tsx
// ✅ Target — Tailwind + clsx
import { clsx } from 'clsx';

return (
  <div
    className={clsx(
      'rounded-lg p-3',
      'bg-white dark:bg-gray-900',
      isHighlighted && 'ring-2 ring-yellow-400'
    )}
  >
    ...
  </div>
);
```

## Poster Grid Layout

The poster grid is the most visible UI element. Target layout:

```tsx
// Mobile-first grid — 2 cols → 3 → 4 → 5
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
  {items.map(item => <GridItem key={item.id} item={item} />)}
</div>

// Individual poster — always 2:3 aspect ratio
<div className="aspect-[2/3] w-full overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800">
  <img
    src={posterUrl}
    alt={title}
    className="h-full w-full object-cover"
    loading="lazy"
  />
</div>
```

## Modal Pattern

Replace React Spring modals with shadcn/ui `Dialog`:

```tsx
// ✅ shadcn/ui Dialog pattern
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AddToWatchlistDialog({ open, onOpenChange, item }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add to Watchlist</Trans>
          </DialogTitle>
        </DialogHeader>
        {/* content */}
      </DialogContent>
    </Dialog>
  );
}
```

On mobile, `DialogContent` is full-screen by default in shadcn. Add `sm:max-w-*` to constrain it on larger screens.

## Facet Drawer Pattern

Replace the custom FacetDrawer with shadcn `Sheet`:

```tsx
// ✅ shadcn/ui Sheet pattern (mobile slide-in panel)
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function FilterSheet({ open, onOpenChange, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px]">
        <SheetHeader>
          <SheetTitle><Trans>Filters</Trans></SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
```

## Star Rating Pattern

The current `StarRating` uses custom logic. Migrate to a Radix `Slider` for accessibility:

```tsx
// ✅ Accessible star rating using Radix Slider
import * as SliderPrimitive from '@radix-ui/react-slider';
import { Trans } from '@lingui/macro';

interface StarRatingProps {
  value: number; // 0–10
  onChange: (value: number) => void;
  readonly?: boolean;
}

export function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  return (
    <SliderPrimitive.Root
      className="relative flex h-5 w-full touch-none select-none items-center"
      min={0}
      max={10}
      step={1}
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      disabled={readonly}
      aria-label={t`Rating`}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow rounded-full bg-gray-200 dark:bg-gray-700">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-yellow-400" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-yellow-400 bg-white shadow focus:outline-none focus-visible:ring-2 dark:bg-gray-900" />
    </SliderPrimitive.Root>
  );
}
```

## Component Composition Checklist

When writing any component, verify:

- [ ] Props interface defined with `readonly` fields
- [ ] `React.FC<Props>` explicit type
- [ ] All user-visible strings wrapped in `<Trans>` or `t\`\``
- [ ] Tailwind `dark:` variants for every colour token
- [ ] Base (mobile) styles written first, responsive overrides after
- [ ] Semantic HTML element chosen (not `div` when `button`, `nav`, `header` is correct)
- [ ] ARIA labels on all interactive elements without visible text
- [ ] `loading="lazy"` on non-critical images
- [ ] `clsx` used for conditional class merging (not string concatenation)
