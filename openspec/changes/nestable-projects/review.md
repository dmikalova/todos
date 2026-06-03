# Nestable Projects: Review

## Summary

The plan is well-scoped. Backend and schema are already complete — this change
is purely frontend UI + test coverage. The main risks are around circular
reference prevention and coverage strategy. Two action items identified.

## Security

- [x] **Circular reference prevention**: Design includes both frontend filtering
      (dropdown excludes self/descendants) and backend validation (400 on
      circular parent). Address: included in tasks.
- [x] **Ownership validation on parentProjectId**: Already enforced via
      `assertOwnership` in the existing project routes. No changes needed.

## Patterns

- [x] **Tree computation follows store getter pattern**: Design proposes a
      computed `projectTree` getter, consistent with existing `inboxTasks`,
      `dueTasks`, `pipelineTasks` getters. No issues.
- [x] **Context inheritance reuses `resolveProjectContext`**: No new inheritance
      logic needed — existing function already handles the full ancestor walk.

## Alternatives

- [x] **Recursive component vs flat list with depth**: Design correctly chose
      flat depth-annotated list. lit-html templates iterate naturally over flat
      arrays. No better alternative.

## Simplifications

- [x] **No drag-and-drop library**: Using native HTML5 Drag and Drop API instead
      of a library dependency. Sufficient for a simple vertical list with tens
      of items. Touch support not critical for desktop-focused personal app.
- [x] **localStorage for collapse state**: Collapse state is a UI preference,
      not data. No DB column or API needed. Persists across reloads.

## Missing Considerations

- [x] **Alphabetical ordering within siblings**: The tree builder must
      explicitly sort children alphabetically by name within each parent group.
      Address: ensure `projectTree` implementation sorts siblings by name.
- [x] **What happens when a project's parent is deleted?**: Backend already sets
      `parent_project_id = NULL` via the delete route (re-parents to top level).
      Integration test should verify this. Address: included in test specs.

## Valuable Additions

- [x] **Show child count on parent projects**: Could show number of sub-projects
      next to parent. Defer: nice-to-have, not needed for MVP.

## Action Items

- Include sibling alphabetical sort in the `projectTree` implementation
- Backend circular reference check in PATCH /api/projects/:id
- Implement collapse toggle with localStorage persistence
- Implement HTML5 drag-and-drop for re-parenting (no sibling reordering)

## Deferred Items

- Child project count badge on parent projects in sidebar
- Touch/mobile drag-and-drop polyfill

## Updates Required

- Proposal updated: drag-and-drop is re-parenting only, no schema changes
- Design updated: removed sort_order column/reorder endpoint, DnD is re-parent
  only, siblings always alphabetical
