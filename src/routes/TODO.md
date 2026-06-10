# TODO

- remove must_do
- fix up rank controls
- don't load all tasks on page load, just load tasks for the active page and
  cache them
- task markdown support
- labels
- duplicate time window in context
- auto sort time windows after save
- context
- next
- sort orders - created, updated, alphabetical, manual drag n drop
- chip picker title should be inline
- chip picker bg color
- chip picker with all items should still show "all picked" with blinking line
  to indicate deletability
- revamp the calendar
- next should have button: defer 1 hour, defer tomorrow
- next should allow you to turn off a context - eg chips for current contexts
  that are then toggleable
- break out components
- update filters for contexts
- tasks/projects should show inherited contexts
- filter for contexts
- filter by task text fuzzy search
- show project/context in task?
- switch to theme generator
- browser plugin to add tasks
- android app to add tasks
- [deno lint plugin for perfectionist](https://github.com/azat-io/eslint-plugin-perfectionist)

```js
{
"lint": {
"plugins": [
"npm:eslint-plugin-perfectionist"
],
"rules": {
"include": [
"perfectionist/sort-imports"
]
}
}
}
deno lint --unstable-lint-plugins
```

- add MD color picker:

```js
  import { Blend, TonalPalette, Hct } from "@anthropic/material-color-utilities";

// The 19 Material base hues (approximate ARGB values for pure hues)
const BASE_COLORS = {
red: 0xFFF44336,
pink: 0xFFE91E63,
purple: 0xFF9C27B0,
deepPurple: 0xFF673AB7,
indigo: 0xFF3F51B5,
blue: 0xFF2196F3,
lightBlue: 0xFF03A9F4,
cyan: 0xFF00BCD4,
teal: 0xFF009688,
green: 0xFF4CAF50,
lightGreen: 0xFF8BC34A,
lime: 0xFFCDDC39,
yellow: 0xFFFFEB3B,
amber: 0xFFFFC107,
orange: 0xFFFF9800,
deepOrange: 0xFFFF5722,
brown: 0xFF795548,
grey: 0xFF9E9E9E,
blueGrey: 0xFF607D8B,
};

function getProjectColorBubbles(themeColorArgb: number) {
return Object.entries(BASE_COLORS).map(([name, baseArgb]) => {
// Harmonize: shifts hue toward theme while keeping recognizable
const harmonized = Blend.harmonize(baseArgb, themeColorArgb);
const palette = TonalPalette.fromInt(harmonized);

    return {
      name,
      // Tones chosen for guaranteed accessibility:
      light: palette.tone(80),   // works as bg with dark text (tone 20)
      medium: palette.tone(40),  // readable on white or light surfaces
      dark: palette.tone(20),    // high contrast on light backgrounds
    };

});
}
```
