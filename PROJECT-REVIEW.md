# Project Review: Database and Improvement Recommendations

**Reviewed:** 2026-11-03

## Database connection

The project does not currently connect to a database. Hobby and journal data are stored in the browser's `localStorage` in [app/page.tsx](./app/page.tsx). The project has no database driver, ORM, API route, or database configuration in [package.json](./package.json). Data is therefore limited to the browser and site origin where it was entered; it does not sync across devices or users.

## Findings

### 🟡 WARNING — Dashboard controls do not reflect real data

**Location:** [app/page.tsx](./app/page.tsx)  
**Confidence:** High

The hobby period and date controls do not change the chart, whose totals are lifetime counts despite the period label. The sleep form has no save handler, and the displayed sleep chart is generated from hobby counts. The daily summary date also does not filter its hobby or sleep information. Connect these controls to real, date-specific records, or clearly identify the sections as demos until that data exists.

### 🟡 WARNING — Clearing all hobbies does not persist

**Location:** [app/page.tsx](./app/page.tsx)  
**Confidence:** High

Loading saved hobbies ignores an empty array, so deleting the final hobby restores the sample hobbies on reload. Preserve an explicitly empty saved list separately from the absence of saved data.

### 🟡 WARNING — Hobby check-ins are not recorded by date

**Location:** [app/page.tsx](./app/page.tsx)  
**Confidence:** High

A hobby stores only a checked flag and aggregate count. Unchecking reduces the count, and there is no history to support daily summaries or period-based charts. Record check-ins by hobby and date, and define whether undoing a check-in removes that date's record.

### 🟡 WARNING — Hobby storage errors can appear as successful saves

**Location:** [app/page.tsx](./app/page.tsx)  
**Confidence:** High

Hobby data is parsed with only an array check, and localStorage writes are not handled for access or quota errors. Invalid saved data may break rendering; failed writes can appear successful until reload. Validate stored records, preserve a clear error state, and consider export or backup support.

### 🟡 WARNING — The hobby dialog is not fully modal or accessible

**Location:** [app/page.tsx](./app/page.tsx), [app/globals.css](./app/globals.css)  
**Confidence:** High

The dialog remains in the accessibility tree when visually closed, yet declares itself modal even then. When opened, it also lacks focus management and a backdrop. Use a dialog implementation that properly handles open and close state, Escape, focus, and interaction with the rest of the page.

### 🔵 INFO — Add journal deletion and regression coverage

**Location:** [app/page.tsx](./app/page.tsx), [package.json](./package.json)  
**Confidence:** Medium

Journal entries can be saved and edited, but not deleted. Add deletion if entries should be removable, and test persistence plus day, week, month, and year filtering and date boundaries. There is no test script or test suite configured.

### 🔵 INFO — Document current storage limitations

**Location:** [README.md](./README.md)  
**Confidence:** High

The README is still the generic Next.js starter guide. Document that data is browser-local, how to reset or back it up, and whether a database-backed multi-device version is planned.

### 🔵 INFO — Lint currently reports an error

**Location:** [app/page.tsx](./app/page.tsx)  
**Confidence:** High

The existing hobby-loading effect triggers the lint rule against synchronous state updates in effects. Refactor that hydration pattern so lint passes cleanly.

## Strengths

- Journal writes report localStorage failures to the user rather than silently claiming success.
- Journal text is rendered as React text, not interpreted as HTML.

## Scope and validation

Reviewed the Next.js page, global stylesheet, layout, package manifest, README, and storage/database references. No source changes were made as part of this review.
