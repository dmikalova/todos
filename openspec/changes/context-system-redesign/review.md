# Context System Redesign: Review

## Status

Complete - all questions resolved.

## Documentation Impact

No docs update required. This is a personal app with no external consumers or
published API documentation. The OpenSpec artifacts serve as the documentation.

## Questions

### Security

- ~~**Q: Do the new join tables need ownership validation?**~~ **Resolved:**
  Yes. Each context ID in a `contextIds[]` array must be validated as belonging
  to the authenticated user via `assertOwnership` before inserting into join
  tables. Captured in design (existing pattern continues to apply).

### Patterns

- ~~**Q: How does the `GET /api/contexts/:id/tasks` endpoint resolve inheritance
  server-side when the design says resolution is client-side?**~~ **Resolved:**
  Resolution is now fully server-side via Postgres recursive CTE. Decision #4 in
  design.md updated. The CTE walks down from projects with the target context,
  finding children that inherit. Bounded by tree depth (3-4 levels), so it's
  cheap. All view endpoints use server-side resolution.

### Scope

- ~~**Q: Should context rank sorting in Next be deferred?**~~ **Resolved:** No —
  rank is integral to Next. The algorithm is: highest-ranked active context
  first → within that context, group by priority (p1>p2>p3) → random within
  highest priority group. If no eligible tasks in highest-ranked context, fall
  through to next-ranked. Design updated with full pipeline.

- ~~**Q: Should the migration be split into additive-only steps?**~~
  **Resolved:** No. Single migration is fine — no concern about data loss since
  the app is pre-production. The migration creates join tables, copies data, and
  drops old columns in one step.

### Missing

- ~~**Q: How should the frontend handle the transition from `context_id` to
  `context_ids[]` on projects?**~~ **Resolved:** Big-bang frontend change.
  Update the frontend to use new API responses (arrays instead of single
  values), remove old `resolveProjectContext` logic, and delete old API
  compatibility code. No transition period needed.

- ~~**Q: What happens to the scoring service (`services/scoring.ts`) when
  `must_do` is removed?**~~ **Resolved:** Remove `services/scoring.ts` entirely.
  Next selection uses precedence ordering (context rank → task priority →
  random), not numerical scoring. The scoring service has no other consumers.
  Design updated.
