# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 02: Editor Chrome Shell (completed)
- Feature 03: Authentication and Clerk Integration (completed)

## Current Goal

- Prepare for the next feature unit after auth integration completion.

## Completed

- `context/feature-specs/01-design-system.md` implemented:
  - `shadcn/ui` initialized and configured.
  - Added `Button`, `Card`, `Dialog`, `Input`, `Tabs`, `Textarea`, and `ScrollArea`.
  - `lucide-react` installed.
  - Shared `cn()` helper available at `lib/utils.ts`.
  - Default app rendering uses dark mode (`html.dark`) to avoid light styling.
  - `app/globals.css` remapped to Ghost AI token palette (including `--color-bg-base`, `--color-text-primary`, etc.) and bridged to shadcn variables.
- `context/feature-specs/02-editor.md` implemented:
  - Added `components/editor/editor-navbar.tsx` with fixed-height three-section layout and sidebar toggle icon state (`PanelLeftOpen` / `PanelLeftClose`).
  - Added `components/editor/project-sidebar.tsx` as a floating, non-layout-shifting, left slide-over shell with `isOpen` and `onClose` props.
  - Implemented sidebar header, tabbed views (`My Projects`, `Shared`) with empty placeholders, and bottom full-width `New Project` action with `Plus` icon.
  - Added `components/editor/dialog-pattern.tsx` as a reusable dialog scaffold supporting title, description, and footer actions using existing token-based styling.
  - Added `components/editor/editor-layout.tsx` and wired route-level layout usage under `app/editor/layout.tsx`.
  - Added `app/editor/page.tsx` as editor content placeholder and updated `app/page.tsx` to redirect to `/editor`.
- `context/feature-specs/03-auth.md` implemented:
  - Installed `@clerk/ui` and wrapped `app/layout.tsx` with `ClerkProvider` using Clerk `dark` theme (`@clerk/ui/themes`) plus CSS variable-based appearance overrides.
  - Added root-level `proxy.ts` and protected routes by default while keeping auth routes public via configured sign-in/sign-up env URL values.
  - Added minimal auth pages at `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` with responsive two-panel layout (form-only on small screens).
  - Updated `app/page.tsx` to redirect authenticated users to `/editor` and unauthenticated users to `/sign-in`.
  - Added Clerk `UserButton` to the right section of `components/editor/editor-navbar.tsx` with default Clerk menu/profile flows.

## In Progress

- Add active implementation item here when work starts.

## Next Up

- Start the next feature unit after auth verification is complete.

## Open Questions

- Add unresolved product or implementation questions here.

## Architecture Decisions

- Add decisions that affect the system design or data model.

## Session Notes

- Verification complete for design-system unit: `npm run lint` and `npm run build` both pass.
- Token remap verification re-run after `globals.css` update: `npm run lint` and `npm run build` both pass.
- Verification complete for editor chrome unit: `npm run lint` and `npm run build` both pass.
- Scope alignment update: replaced `editor-shell` with `editor-layout` to keep composition explicit as layout-based usage.
- Route alignment update: `/editor` now uses a dedicated layout with editor chrome components.
- Verification complete for auth unit: `npm run lint` and `npm run build` both pass after Clerk provider, proxy protection, auth routes, and navbar user menu integration.
- UX fix: set `afterSignOutUrl="/sign-in"` on `UserButton` to avoid slow intermediate rendering after sign-out.
- Compatibility fix: moved `afterSignOutUrl="/sign-in"` from `UserButton` to `ClerkProvider` because current `@clerk/nextjs` `UserButton` props do not expose `afterSignOutUrl`.
