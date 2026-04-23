# Iteration X — UX/Product Improvements (screenshots)

Screenshots captured against the local dev server (`pnpm dev` + bundled Go backend) on `2026-04-23`.

| # | File | Requirement |
|---|------|-------------|
| 1 | `01-header-branding.png` | (#9) Header simplified to "H" icon + "Property Tracker" — "Home Searcher" text removed. |
| 2 | `02-settings-page.png` | (#7) New Settings page with Account / Password / Appearance segments and the relocated theme selector. |
| 3 | `03-alerts-expanded-rules.png` | (#8) Alerts page with expanded rule types: Price drop, Price below threshold, Price above threshold, Any change. |
| 4 | `04-source-detail-fields-table.png` | (#1) Structured fields table with row-level Edit/Delete actions and dedicated "Add field" button (separate from "Edit"). |
| 5 | `05-add-field-dialog.png` | (#1) Independent "Add field" modal — modular, fast, scoped to a single field. |
| 6 | `06-new-property-with-retry.png` | (#6) New property form exposing optional Retry attempts and Retry backoff (ms). |
| 7 | `07-property-url-popover.png` | (#3) Truncated URL with on-demand popover revealing full URL and "Open original" link (opens in new tab). |
| 8 | `08-create-alert-from-property.png` | (#2) Contextual "Create alert" dialog launched directly from the property view, scoped to that property. |
| 9 | `09-bulk-run-by-source.png` | (#5) Bulk run confirmation dialog — "Run N properties for &lt;source&gt; sequentially", clear scope before execution. |

Requirement (#4) "Field history charts" is implemented (`SparklineChart` + per-field "View Chart" action) but a screenshot would require successful runs against a real listing URL; not captured in this dry-run environment.
