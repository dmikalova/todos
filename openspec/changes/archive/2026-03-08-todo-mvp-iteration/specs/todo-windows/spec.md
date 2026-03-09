# ADDED Requirements

## Requirement: Define recurring windows on a context

A context SHALL support one or more recurring windows. A window is defined by a
set of days-of-week and a local time range (start time, end time). The system
MUST persist windows and associate them with their parent context.

### Scenario: Create a window on a context

- **WHEN** a user defines a window with days-of-week, a start time, and an end
  time on a context
- **THEN** the backend persists the window linked to that context

### Scenario: Fetch context includes its windows

- **WHEN** the system fetches a context
- **THEN** the response includes the list of recurring windows defined on that
  context

### Scenario: Multiple windows on one context

- **WHEN** a context has multiple windows (e.g., "weekday mornings" and "weekend
  afternoons")
- **THEN** all windows are stored and returned with the context

## Requirement: Client-side window active state evaluation

The client SHALL evaluate whether a window is currently active by comparing the
device's local day-of-week and time against the window's schedule. A window is
active if today's day matches one of the window's days AND the current local
time is within the window's start–end range.

### Scenario: Window is active during its scheduled time

- **WHEN** the current local day and time fall within a window's schedule
- **THEN** the window is evaluated as active

### Scenario: Window is inactive outside its scheduled time

- **WHEN** the current local day or time is outside a window's schedule
- **THEN** the window is evaluated as inactive

### Scenario: Multiple windows — any active makes context active

- **WHEN** a context has multiple windows and at least one is currently active
- **THEN** the context is considered active for the purpose of the Next view

## Requirement: Window times are in local time

Windows are defined and evaluated in the user's local time. The system SHALL
store window times as HH:MM strings (timezone-naive) and evaluate them against
the device's local clock.

### Scenario: Window stored as HH:MM local time

- **WHEN** a window is created with a start and end time
- **THEN** the backend stores them as HH:MM strings with no timezone offset

### Scenario: Evaluation uses device local clock

- **WHEN** the client evaluates window active state
- **THEN** it compares against the device's current local time and day-of-week
