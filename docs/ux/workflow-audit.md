# UX Workflow Audit Report

## Workflow Inventory

| Workflow | Entry point | Classification | Primary steps | Key decisions | Exit states |
| --- | --- | --- | --- | --- | --- |
| Properties list and review | `/properties` | Core | Open portfolio table → scan rows → filter/sort → open property | Filters vs columns, bookmark/run actions | property opened, run started, bookmark updated |
| Property creation | `/properties/new` | Core | Add URL/price → optionally select source → expand optional sections → create | URL-based vs manual entry, template vs manual fields, advanced settings | property created, validation blocked |
| Property detail and editing | `/properties/:propertyId` | Core | Review overview → switch section → edit/save/run/configure alerts/tags | which section to open, whether to edit or run, whether to change config/history | property updated, run started, config saved |
| Navigation between sections | global shell nav | Core | choose section → land on page → return to related workflow | section grouping, active location recognition | destination page loaded |
| Source list | `/sources` | Secondary | scan templates → open row → run bulk or delete | open row vs secondary menu, whether to bulk run | source opened, bulk run started, delete confirmed |
| Source create/edit | `/sources/new`, `/sources/:sourceId` | Secondary | create template or review existing → edit fields → save | create vs edit modal, field-level vs full-template edits | template created/updated/deleted |
| Alerts management | `/alerts`, property alert dialog | Secondary | open create flow → choose property/rule → save | rule type, threshold requirement, page-level vs property-level entry | alert created, validation blocked |
| Triage inbox | `/triage` | Secondary | filter severity → open related property/run → take row action | review vs run now vs open | review completed, run started, destination opened |
| Settings updates | `/settings` | Secondary | switch tab → change profile/preferences/operations → save | which settings group persists, user vs workspace scope | settings saved, validation blocked |
| Runs, fields, analytics, bookmarks, notifications, tags | route-specific pages | Rare/supporting | open page → inspect data → take local action | page-specific filters and actions | page-specific |

## Evaluation Summary

### Clarity
- Core page titles are clear, but some action labels were inconsistent for the same workflow.
- Source rows exposed overlapping “open/edit” affordances.
- Settings save labels were too generic for the scope they persist.

### Cognitive Load
- Property creation intentionally keeps the required path minimal, but repeated optional toggles still increase branching.
- Properties table remains dense for repeat use; column controls needed clearer dismissal behavior.
- Triage actions needed clearer per-row feedback to avoid global uncertainty.

### Step Efficiency
- Alerts had duplicated terminology across page-level and property-level creation.
- Source list duplicated the open path in both row click and row menu.
- Settings save actions needed clearer intent without increasing steps.

### Consistency
- Alert creation terminology diverged between the global page and property dialog.
- Settings used mixed form-control patterns for similar select interactions.
- Row-level async feedback patterns were inconsistent across workflows.

### Feedback and State Visibility
- Alert creation lacked inline failure feedback on the global alerts page.
- Triage actions used global pending states that obscured which item was in progress.
- Properties column controls stayed open until manually toggled, reducing state clarity.

## Friction Register

| Severity | Workflow | Location | Problem | Impact on behavior |
| --- | --- | --- | --- | --- |
| High | Alerts | `app/src/features/engagement/AlertsPage.tsx` | Global alert creation lacked consistent success/error feedback and used inconsistent copy | users can hesitate or mistrust alert creation |
| High | Triage | `app/src/features/operators/TriageInboxPage.tsx` | One pending mutation disabled all similar row actions | users cannot tell which work item is processing |
| Medium | Sources | `app/src/features/backoffice/SourcesPage.tsx` | Row click, icon action, and menu action overlapped for the same destination | extra decision-making on every row |
| Medium | Settings | `app/src/features/settings/SettingsPage.tsx` | Save labels were generic and one select used a different UI control pattern | less confidence about what will be saved |
| Medium | Properties | `app/src/features/properties/PropertiesPage.tsx` | Column controls lacked escape/outside-dismiss behavior | extra friction for first-time exploration |

## Audit Outcomes Applied in This Phase

1. Standardized alert creation labels and failure handling.
2. Moved triage feedback to the row being processed.
3. Removed duplicated source-list navigation affordance.
4. Clarified settings save labels and standardized the severity select.
5. Improved the properties-table column menu dismissal behavior.
