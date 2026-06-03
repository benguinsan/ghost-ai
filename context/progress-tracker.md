# Progress Tracker

Update this file whenever the current phase, active feature, or implementation state changes.

## Current Phase

- Feature 02: Editor Chrome Shell (completed)
- Feature 03: Authentication and Clerk Integration (completed)
- Feature 04: Project Dialogs and Editor Home (completed)
- Feature 05: Prisma Models, Client Singleton, and Initial Migration (completed)
- Feature 06: Project APIs (completed)
- Feature 07: Wire Editor Home to Project APIs (completed)

## Current Goal

- Prepare for the next feature unit after editor home API wiring.

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
- `context/feature-specs/04-project-dialogs.md` implemented:
  - Replaced the `/editor` center placeholder with a minimal home screen containing the specified heading, description, and `New Project` button wired to the create dialog.
  - Added a dedicated project dialog state hook/provider at `components/editor/project-dialog-state.tsx` to manage dialog state, form state, loading state, and mock project data operations.
  - Added Create, Rename, and Delete project dialogs using the existing dialog pattern, including live slug preview, rename prefill + autofocus + Enter submit behavior, and destructive delete confirmation.
  - Updated `components/editor/project-sidebar.tsx` to render mock owned/shared project lists, wire sidebar actions (`create`, `rename`, `delete`), and show rename/delete actions only on owned projects.
  - Added mobile sidebar backdrop scrim with outside-tap close behavior while preserving existing sidebar open/close mechanics.
- `context/feature-specs/05-prisma.md` implemented:
  - Added `prisma/models/project.prisma` with `ProjectStatus` enum (`DRAFT`, `ARCHIVED`) and `Project` model fields: Clerk owner ID, name, optional description, optional `canvasJsonPath`, timestamps, relation to collaborators, and indexes on owner and creation date.
  - Added `ProjectCollaborator` model with required project relation (`onDelete: Cascade`), collaborator email, creation timestamp, unique constraint on `[projectId, email]`, and indexes on `email` and `[projectId, createdAt]`.
  - Added `lib/prisma.ts` singleton client that branches by `DATABASE_URL`: `accelerateUrl` for `prisma+postgres://` and `PrismaPg` adapter for direct PostgreSQL URLs, with global caching in development.
  - Created and applied first migration at `prisma/migrations/20260602145805_add_project_models/migration.sql`.
  - Regenerated Prisma client output in `app/generated/prisma`.
- `context/feature-specs/06-project-apis.md` implemented:
  - Added `app/api/projects/route.ts` with `GET` and `POST` handlers to list and create owner-scoped projects for the authenticated Clerk user.
  - Enforced explicit `401` responses for unauthenticated requests in both handlers.
  - Implemented create behavior with input validation and default project name fallback to `Untitled Project` when name is omitted.
  - Added `app/api/projects/[projectId]/route.ts` with `PATCH` and `DELETE` handlers for owner-only rename and delete operations.
  - Enforced ownership checks for project mutations, returning `403` when the requester is not the owner (or the project is inaccessible to them).
- `context/feature-specs/07-wire-editor-home.md` implemented:
  - Added `lib/project-data.ts` helper and moved sidebar project loading to server rendering in `app/editor/layout.tsx`, fetching owned and shared lists for the authenticated user before hydrating editor chrome.
  - Added `hooks/use-project-actions.ts` to centralize create, rename, and delete dialog state plus API-backed project mutations.
  - Wired create flow to generate a slug-based room ID preview with unique suffix, call `POST /api/projects`, and navigate to `/editor/[projectId]` on success.
  - Wired rename flow to prefill the current name, call `PATCH /api/projects/[projectId]`, and refresh server data on success.
  - Wired delete flow to show the selected project name, call `DELETE /api/projects/[projectId]`, and redirect to `/editor` when deleting the active workspace route.
  - Updated editor home to remain a server component by moving the create trigger into a dedicated client button component.
  - Added `app/editor/[projectId]/page.tsx` so newly created projects resolve to a workspace route.
  - Updated `POST /api/projects` to accept optional `roomId` and persist it as the project `id` to keep project IDs aligned with room IDs.

## In Progress

- No active implementation item.

## Next Up

- Start the next feature unit after editor home wiring is verified against build and lint expectations.

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
- Feature 04 implementation note: project dialogs and sidebar actions currently use in-memory mock project data only, with no API calls or persistence by design.
- Verification complete for Feature 04 unit: `npm run lint` and `npm run build` both pass after editor home, project dialogs, sidebar actions, and mobile scrim updates.
- Feature 05 implementation note: migration was applied successfully against the configured PostgreSQL datasource and generated Prisma client types now include `Project` and `ProjectCollaborator`.
- Verification complete for Feature 05 unit: `npx prisma migrate dev --name add_project_models`, `npx prisma generate`, and `npm run build` pass.
- Feature 06 implementation note: project API routes are backend-only and currently not wired into editor UI dialogs.
- Feature 07 implementation note: sidebar project lists are server-fetched and dialogs now mutate persisted projects via API routes.
- Verification complete for Feature 07 unit: `npm run build` passes after server-side project loading, API-backed dialog actions, and workspace route wiring.
- Runtime stability fix: normalized direct PostgreSQL `DATABASE_URL` SSL aliases (`prefer` / `require` / `verify-ca`) to `sslmode=verify-full` in `lib/prisma.ts` to remove pg warning noise and keep current secure semantics.
- Workspace access hardening: `app/editor/[projectId]/page.tsx` now verifies authenticated access via owner or collaborator email before rendering and returns `notFound()` for unauthorized/non-existent projects.
