# Nestable Projects: Design

## Context

The todos app already has full backend and data model support for nested
projects: `parent_project_id` column on the projects table, self-referential FK,
API endpoints that accept/return `parentProjectId`, and a
`resolveProjectContext()` store method that walks the ancestor chain for context
inheritance. However, the frontend never exposes this — projects appear as a
flat list in the sidebar, and the project form has no parent selector.

Test coverage is at 65.6% branch / 52.2% line. Many route files and services
have significant coverage gaps, particularly `middleware.ts`,
`routes/contexts.ts`, `routes/recurrence.ts`, `services/history.ts`, and
`services/ownership.ts`.

## Goals / Non-Goals

**Goals:**

- Add parent project selector to the project form
- Display projects as an indented tree in the sidebar
- Show inherited context indicator when a project has no direct context but
  inherits one from an ancestor
- Reach 100% line and branch coverage on all `src/` files

**Non-Goals:**

- Maximum nesting depth limits (trust the user)
- E2E Playwright tests (out of scope — unit and integration only)

## Decisions

### Tree computation in the store

**Decision:** Add a `projectTree` computed getter to the store that builds a
flat, depth-annotated list from the projects array. Each entry includes the
project and its depth level. Top-level projects (no parent) have depth 0, their
children depth 1, etc.

**Rationale:** The sidebar renders a flat list — a depth-annotated flat array is
simpler to render than a recursive tree structure. The store already has all
projects loaded; computing the tree is a cheap O(n) operation.

**Alternative considered:** Recursive component rendering. Rejected — lit-html
templates work better with flat iteration than recursive calls.

---

### Parent selector excludes self and descendants

**Decision:** When editing a project, the parent project dropdown SHALL exclude
the project itself and all its descendants to prevent circular references.

**Rationale:** Setting a project as its own parent or as a child of its
descendant would create a cycle in the tree. The backend could also validate
this, but preventing it in the UI is the better UX.

---

### Inherited context shown as read-only indicator

**Decision:** When a project has no direct context but inherits one through the
ancestor chain, the project form's context selector shows the inherited context
name as placeholder text (e.g., "inherited: morning") but the actual value
remains null/unset.

**Rationale:** Users need to see which context applies to understand the
inheritance, but the stored value should remain null so that changing the
parent's context automatically propagates.

---

### Sidebar tree rendering with indentation

**Decision:** Projects in the sidebar render as a flat list with left padding
based on depth level (e.g., `pl-4` per level via Tailwind). Parent projects with
children display an expand/collapse toggle. All projects are expanded by
default.

**Rationale:** For a personal todo app with a modest number of projects,
defaulting to expanded is the simplest starting UX. Collapse state lets users
hide subtrees they aren't working on. Indentation is sufficient visual
hierarchy.

---

### Collapsible tree nodes persisted in localStorage

**Decision:** Collapsed project IDs are stored as a `Set<string>` in the store
and persisted to `localStorage` under a key like `todos:collapsedProjects`. When
a parent project is collapsed, its entire subtree is hidden from the rendered
list. The `projectTree` getter filters out children of collapsed parents.

**Rationale:** Collapse state is a UI preference, not data — `localStorage` is
the right persistence layer. No API calls or DB columns needed. Persisting
across page reloads avoids the annoyance of re-collapsing on every visit.

**Alternative considered:** Storing collapse state in the database. Rejected —
this is purely a UI preference with no multi-device sync benefit for a personal
todo app.

---

### Drag-and-drop for re-parenting

**Decision:** Implement drag-and-drop using the HTML5 Drag and Drop API directly
(no library). Dragging a project onto another project re-parents the dragged
project under the drop target. Dragging to the top-level area removes the
parent. Siblings are always sorted alphabetically by name — there is no
user-defined ordering.

**Rationale:** HTML5 DnD is natively supported in all modern browsers and avoids
a dependency. For a sidebar with tens of projects, the native API is sufficient.
Alphabetical ordering eliminates the need for a `sort_order` column and reorder
endpoint, keeping the backend unchanged.

**Alternative considered:** Adding a `sort_order` column for user-defined
ordering. Rejected — alphabetical is predictable and requires no schema changes
or reorder API.

---

### Coverage strategy: integration tests for routes, unit tests for services

**Decision:** Close coverage gaps primarily through integration tests for route
files (they exercise multiple code paths per test) and targeted unit tests for
service functions. This maximizes coverage per test written.

**Rationale:** Route files are best tested through HTTP integration tests that
exercise the full middleware → route → DB path. Service files have pure or
near-pure functions well suited to unit tests.

---

### Preventing circular parent references

**Decision:** Add a backend validation check in the project update route that
rejects setting `parentProjectId` to the project itself or any of its
descendants. Return 400 Bad Request with a clear error message.

**Rationale:** While the frontend filters the dropdown, a direct API call could
still create a cycle. Belt-and-suspenders approach prevents data corruption.

## Risks / Trade-offs

- **Deep nesting readability:** With unlimited nesting depth, deeply nested
  projects could overflow sidebar width. Mitigation: cap visual indentation at 4
  levels (further nesting still indents at level 4 max).
- **Circular reference prevention:** Walking descendants for validation is O(n)
  over all projects. Mitigation: with a personal todo app's project count (tens,
  not thousands), this is negligible.
- **Coverage 100% may require testing generated/boilerplate code:** Some files
  like `src/main.ts` or `src/app.ts` are thin wrappers. Mitigation: integration
  tests that start the app exercise these paths naturally.
- **HTML5 DnD touch support:** Native HTML5 Drag and Drop has limited mobile/
  touch support. Mitigation: acceptable for a desktop-focused personal todo app.
  Touch support can be added later with a polyfill if needed.
