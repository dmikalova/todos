# ADDED Requirements

## Requirement: Parent project selector in project form

The project form SHALL include a dropdown to select a parent project. The
dropdown MUST list all projects the user owns except the project being edited
and its descendants (to prevent circular references).

### Scenario: New project with parent selected

- **WHEN** a user creates a new project and selects a parent project
- **THEN** the project is saved with `parent_project_id` set to the selected
  parent
- **AND** it appears as a child of that parent in the sidebar tree

### Scenario: New project with no parent

- **WHEN** a user creates a project without selecting a parent
- **THEN** the project is saved with `parent_project_id` as null
- **AND** it appears at the top level of the sidebar tree

### Scenario: Edit project parent

- **WHEN** a user edits an existing project and changes its parent
- **THEN** the project's `parent_project_id` is updated
- **AND** the sidebar tree reflects the new hierarchy

### Scenario: Dropdown excludes self and descendants

- **WHEN** a user edits a project that has child projects
- **THEN** the parent dropdown does not include the project itself or any of its
  descendants

### Scenario: Remove parent (move to top level)

- **WHEN** a user edits a child project and clears the parent selection
- **THEN** the project becomes a top-level project with `parent_project_id` set
  to null

## Requirement: Sidebar displays projects as indented tree

The sidebar SHALL render projects in a hierarchical tree structure with visual
indentation. Top-level projects appear at base indentation. Child projects are
indented relative to their parent.

### Scenario: Top-level projects at base indentation

- **WHEN** projects exist with no parent
- **THEN** they render at the base indentation level in the sidebar

### Scenario: Child projects indented under parent

- **WHEN** a project has a parent project
- **THEN** it renders indented one level deeper than its parent

### Scenario: Multi-level nesting displayed correctly

- **WHEN** projects are nested three levels deep (grandparent → parent → child)
- **THEN** each level renders with progressively deeper indentation

### Scenario: Indentation caps at visual maximum

- **WHEN** projects are nested deeper than 4 levels
- **THEN** indentation stops increasing at the 4th level to prevent overflow

### Scenario: Tree ordering preserves alphabetical within each level

- **WHEN** multiple sibling projects exist at the same level
- **THEN** they are ordered alphabetically by name within their parent group

## Requirement: Collapsible tree nodes

Parent projects in the sidebar SHALL have an expand/collapse toggle. When
collapsed, the project's entire subtree is hidden. Collapse state SHALL be
persisted in localStorage so it survives page reloads.

### Scenario: Parent project shows expand/collapse toggle

- **WHEN** a project has child projects
- **THEN** it displays an expand/collapse toggle icon

### Scenario: Leaf project has no toggle

- **WHEN** a project has no children
- **THEN** no expand/collapse toggle is shown

### Scenario: Collapsing hides entire subtree

- **WHEN** a user collapses a parent project
- **THEN** all its children and deeper descendants are hidden from the sidebar

### Scenario: Expanding reveals subtree

- **WHEN** a user expands a previously collapsed project
- **THEN** its children (and their expanded children) become visible again

### Scenario: Collapse state persists across reloads

- **WHEN** a user collapses a project and reloads the page
- **THEN** the project remains collapsed

### Scenario: All projects expanded by default

- **WHEN** no collapse state exists (fresh user)
- **THEN** all parent projects are expanded

## Requirement: Drag-and-drop project re-parenting

The sidebar SHALL support drag-and-drop to re-parent projects by dragging onto
another project. Sibling order is always alphabetical by name — drag-and-drop
does not change ordering.

### Scenario: Drag onto project to re-parent

- **WHEN** a user drags a project and drops it onto another project
- **THEN** the dragged project becomes a child of the drop target
- **AND** `parentProjectId` is updated via the API
- **AND** the project sorts alphabetically among its new siblings

### Scenario: Drag to top level

- **WHEN** a user drags a child project to the top-level area
- **THEN** the project becomes a top-level project with null parent

### Scenario: Circular re-parenting prevented via drag

- **WHEN** a user drags a parent project onto one of its own descendants
- **THEN** the drop is rejected (no API call made)

### Scenario: Visual feedback during drag

- **WHEN** a user is dragging a project over valid drop targets
- **THEN** the drop target area shows a visual indicator (highlight or line)

## Requirement: Backend prevents circular parent references

The project update route SHALL reject setting `parentProjectId` to the project
itself or any of its descendants. The route MUST return 400 Bad Request.

### Scenario: Setting self as parent rejected

- **WHEN** a user sets a project's `parentProjectId` to its own ID
- **THEN** the API returns 400 Bad Request

### Scenario: Setting descendant as parent rejected

- **WHEN** a user sets a project's parent to one of its child projects
- **THEN** the API returns 400 Bad Request

### Scenario: Valid parent change accepted

- **WHEN** a user sets a project's parent to a project that is not itself or a
  descendant
- **THEN** the API returns 200 and the parent is updated

## Requirement: Store provides depth-annotated project tree

The store SHALL provide a computed `projectTree` getter that returns projects
ordered for tree display. Each entry includes the project and its depth level (0
for top-level, 1 for children, etc.).

### Scenario: Flat list produces depth-0 entries

- **WHEN** all projects have no parent
- **THEN** `projectTree` returns all projects with depth 0

### Scenario: Nested projects have correct depth

- **WHEN** projects form a parent → child → grandchild chain
- **THEN** `projectTree` returns them in order with depths 0, 1, 2

### Scenario: Children appear immediately after their parent

- **WHEN** a parent project has multiple children
- **THEN** all children appear in the tree immediately after their parent,
  before any sibling of the parent
