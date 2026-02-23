# Web Dashboard Spec

## ADDED Requirements

### Requirement: Web dashboard at todos.mklv.tech

The system SHALL provide a Vue.js web dashboard accessible at todos.mklv.tech
with responsive design for desktop and mobile browsers.

#### Scenario: Access dashboard

- **WHEN** user navigates to todos.mklv.tech
- **THEN** system displays the todo dashboard (or login redirect if not
  authenticated)

### Requirement: Authentication via login portal

The system SHALL authenticate users via the centralized login portal at
login.mklv.tech. Unauthenticated requests redirect to login.

#### Scenario: Redirect to login

- **WHEN** unauthenticated user accesses todos.mklv.tech
- **THEN** system redirects to login.mklv.tech with return URL

#### Scenario: Authenticated session

- **WHEN** user has valid session from login portal
- **THEN** system grants access to dashboard

### Requirement: Navigation structure

The dashboard SHALL include navigation to:

- Next: Smart task selection page (default landing)
- Tasks: Full task list with filters
- Projects: Project management
- History: Task activity log
- Settings: Context configuration, import/export

#### Scenario: Navigate to task list

- **WHEN** user clicks "Tasks" in navigation
- **THEN** system displays the full task list view

### Requirement: Responsive layout

The dashboard SHALL adapt layout for mobile screens (<768px) and desktop screens
(>=768px).

#### Scenario: Mobile navigation

- **WHEN** user views dashboard on mobile device
- **THEN** navigation collapses to hamburger menu

#### Scenario: Desktop navigation

- **WHEN** user views dashboard on desktop
- **THEN** navigation displays as sidebar or top bar

### Requirement: Real-time feedback

The dashboard SHALL provide immediate visual feedback for user actions
(completing tasks, creating tasks, applying filters).

#### Scenario: Task completion feedback

- **WHEN** user completes a task
- **THEN** system shows visual confirmation and removes task from list

#### Scenario: Real-time sync via Supabase

- **WHEN** data changes in the database (from any source)
- **THEN** dashboard automatically updates via Supabase Realtime subscription
- **AND** no polling or manual refresh required

### Requirement: Markdown rendering

The dashboard SHALL render basic markdown formatting in task titles and
descriptions. Links open in a new tab.

#### Scenario: Render link in task

- **WHEN** task title contains `[text](url)` markdown
- **THEN** system renders it as a clickable link that opens in new tab

#### Scenario: Render formatting

- **WHEN** task contains bold, italic, or inline code markdown
- **THEN** system renders the appropriate formatting

### Requirement: Action toasts with undo

The system SHALL display confirmation toasts for destructive or deferral
actions, with an "Undo" button that reverses the action.

#### Scenario: Defer with undo option

- **WHEN** user defers a task
- **THEN** system shows toast "Task deferred until [time]" with Undo button
- **AND** clicking Undo clears the defer immediately

#### Scenario: Complete with undo option

- **WHEN** user completes a task
- **THEN** system shows toast "Task completed" with Undo button
- **AND** clicking Undo restores the task to incomplete

### Requirement: Error toast notifications

The system SHALL display error messages as toast notifications at the top center
of the viewport, auto-dismissing after a reasonable delay.

#### Scenario: API error display

- **WHEN** an API request fails
- **THEN** system displays error toast at top center with error message

#### Scenario: Toast auto-dismiss

- **WHEN** error toast is displayed
- **THEN** system auto-dismisses after 5 seconds (user can dismiss manually
  sooner)

### Requirement: Keyboard shortcuts

The system SHALL support keyboard shortcuts for common actions. Shortcuts are
disabled when focus is in a text input.

Shortcuts:

- `a` - Open add task dialog (assigns to current project if viewing one)
- `n` - Navigate to Next page
- `t` - Navigate to Tasks page
- `p` - Navigate to Projects page
- `?` - Show keyboard shortcuts help dialog
- `Escape` - Close any open dialog

#### Scenario: Add task with keyboard

- **WHEN** user presses 'a' key while not in input
- **THEN** system opens add task dialog
- **AND** if viewing a project, pre-selects that project

#### Scenario: Keyboard navigation

- **WHEN** user presses 'n' key while not in input
- **THEN** system navigates to Next page

#### Scenario: Show shortcuts help

- **WHEN** user presses '?' key
- **THEN** system displays dialog listing all keyboard shortcuts

### Requirement: Context selector in header

The dashboard header SHALL include a context selector showing the current
context (auto-detected or manually overridden).

#### Scenario: View current context

- **WHEN** user views dashboard
- **THEN** header displays current context name (or "All" if no context active)

#### Scenario: Manual context override

- **WHEN** user clicks context selector
- **THEN** system shows dropdown with all contexts plus "All" option
- **AND** selecting a context filters Next page to that context

### Requirement: Import/export in settings

The settings page SHALL include import and export functionality for data backup
and migration.

#### Scenario: Export data

- **WHEN** user clicks "Export" in settings
- **THEN** system downloads JSON file containing all tasks, projects, contexts,
  and filters

#### Scenario: Import data

- **WHEN** user uploads JSON file via import button
- **THEN** system validates and imports data, showing progress and any errors

#### Scenario: Import conflict handling

- **WHEN** imported data conflicts with existing data
- **THEN** system offers options: skip duplicates, overwrite, or merge

### Requirement: History page

The dashboard SHALL include a History page showing all task activity.

#### Scenario: View history

- **WHEN** user navigates to History page
- **THEN** system displays chronological list of task events (created,
  completed, edited, deleted, deferred)

#### Scenario: Filter history by task

- **WHEN** user views task details
- **THEN** system shows history entries for that specific task
