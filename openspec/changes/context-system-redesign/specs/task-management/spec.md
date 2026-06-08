## MODIFIED Requirements

### Requirement: Create task

The system SHALL allow users to create a task with the following fields:

- Title (required, text with basic markdown support)
- Description (optional, text with basic markdown support)
- Due date (optional, date)
- Priority (required, enum: low, medium, high)
- Project (optional, foreign key to project; null = Inbox)
- Contexts (optional, multi-select from user-defined contexts; overrides
  inherited project contexts when set)

Basic markdown support includes: links `[text](url)`, bold `**text**`, italic
`*text*`, and inline code `` `code` ``. No block-level elements (headers, lists,
code blocks) in titles.

#### Scenario: Create minimal task

- **WHEN** user submits a task with only title and priority
- **THEN** system creates the task in Inbox with no direct contexts

#### Scenario: Create full task

- **WHEN** user submits a task with all fields including multiple contexts
- **THEN** system creates the task with all provided values

#### Scenario: Create task with context override

- **WHEN** user creates a task in a "work" project but assigns context "weekend"
- **THEN** the task's effective context is "weekend" (overriding project)

## REMOVED Requirements

### Requirement: Must-do flag on tasks

**Reason**: `must_do` is removed from the system. The priority system (1-3)
provides sufficient urgency signaling without a separate boolean.

**Migration**: Drop `must_do` column from tasks table. Column is unused in
production.
