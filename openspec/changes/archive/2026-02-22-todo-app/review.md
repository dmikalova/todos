# Todo App: Review

## Summary

Reviewing the todo app proposal and design before implementation. This is a
greenfield single-user app with comprehensive requirements. Main areas of focus:
user-defined contexts, friendly recurrence UI, and ensuring the data model
supports all planned features.

## Security

- [x] **Auth via login portal**: Design delegates auth to login.mklv.tech - good
      pattern. Ensure session validation happens on every API request, not just
      initial page load. **Address**: Add middleware check in tasks.

- [x] **SQL injection via filters**: Saved filters store query parameters.
      Ensure filter application uses parameterized queries, not string
      interpolation. **Address**: Use ORM/query builder pattern.

- [x] **Import validation**: Import accepts user-provided JSON. Must validate
      structure and sanitize data to prevent malformed or malicious input.
      **Address**: Strict schema validation with Zod before import processing.

## Patterns

- [x] **Follows email-unsubscribe structure**: Project layout mirrors existing
      app patterns (api/, src/, db/, openspec/). Consistent with portfolio
      conventions.

- [x] **Hono + Zod for validation**: Existing apps use Zod schemas for request
      validation. Apply same pattern here for type-safe API endpoints.

- [x] **User-defined entities with defaults**: Contexts follow the pattern of
      user-editable entities with seeded defaults (can be deleted). Similar
      approach could work for future customization features.

## Alternatives

- [x] **Friendly recurrence over cron**: Instead of cron expressions, use
      structured recurrence fields (frequency, interval, days_of_week). More
      user-friendly and avoids cron parsing complexity. **Address**: Implemented
      in design.

- [x] **No ORM, raw SQL**: Consistent with other apps - use raw SQL with
      parameterized queries. Connection pooling via Supavisor.

- [x] **Multi-context tasks**: Tasks can have multiple contexts via join table.
      More flexible than single context assignment.

## Simplifications

- [x] **Inbox as virtual view**: Rather than separate inbox storage, tasks with
      `project_id IS NULL` are shown in Inbox. Simple and effective.

- [x] **Context detection client-side**: Client determines current context based
      on local time and context definitions. Simplifies server logic.

## Missing Considerations

- [x] **Timezone handling in client**: Client sends local time with requests.
      Server uses client's local time for context detection. This handles
      timezone travel automatically - work hours are always 9-5 in the user's
      current local time. **Address**: Documented in design.

- [x] **Tasks with no contexts**: Tasks without any context assignment are
      always eligible for Next page, regardless of current context filter.
      **Address**: Documented in contexts spec.

- [x] **Deferred tasks respect context**: A work task deferred to 6pm won't show
      until work context is active again (or user manually overrides context).
      **Address**: Documented in next-page spec.

- [x] **Error states in UI**: API failures show as toast notifications at top
      center. Auto-dismiss after 5 seconds. **Address**: Documented in
      web-dashboard spec.

## Testing Strategy

- [x] **Unit tests with Vitest**: Test business logic, API handlers, recurrence
      calculations. **Address**: Added to specs.

- [x] **E2E tests with Playwright**: Test critical user flows (task CRUD, Next
      page navigation, filter application). **Address**: Added to specs.

## Action Items

Items that WILL be addressed in this change:

1. Add auth middleware validating session on every API request
2. Use parameterized queries throughout, no string interpolation
3. Validate import JSON with strict Zod schema
4. Seed default context (work Mon-Fri 9-5) in initial migration
5. Client sends local time for context detection (handles timezone travel)
6. Deferred tasks respect context filter with manual override option
7. Implement unit tests for core business logic
8. Implement E2E tests for critical user flows

## Deferred Items

None. All planned features are included in MVP.

## Updates Required

None. The design is comprehensive and internally consistent. Implementation can
proceed.
