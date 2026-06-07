# ADDED Requirements

## Requirement: Sidebar and navigation labels use lowercase

All sidebar navigation labels and view titles SHALL use lowercase. This is a
project tenet. Labels MUST NOT use title case, sentence case, or ALL CAPS.

### Scenario: Sidebar labels are lowercase

- **WHEN** the sidebar is rendered
- **THEN** all navigation labels appear in lowercase (e.g., "add task",
  "search", "inbox", "next", "due", "history", "settings")

### Scenario: New labels follow the tenet

- **WHEN** a new sidebar item or navigation label is added
- **THEN** its display text MUST be lowercase

## Requirement: Label strings defined in a single source of truth

All sidebar and navigation label strings SHALL be defined in a central constants
or i18n file. Labels MUST NOT be hardcoded inline in templates or components.

### Scenario: Labels sourced from constants file

- **WHEN** the sidebar component renders a label
- **THEN** the label string is read from the central constants/i18n source, not
  hardcoded in the template
