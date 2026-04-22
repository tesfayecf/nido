# Selector System – Research & Redesign

> Status: design accepted. Targeted implementation has landed in this PR; deeper
> data-model/UX work is tracked as follow-ups.

This document is the deliverable for the *Research* and *Final selector system
design* items called out in the refactor brief. It evaluates element-selection
strategies for the property-extraction pipeline, picks a direction, and records
the concrete changes that ship in this PR plus the changes deferred to future
PRs.

---

## 1. Problem recap

The product needs a small number of users to point Home Searcher at a property
listing URL and reliably extract a handful of fields (price, title, location,
…) over time, even as upstream sites mutate their DOM.

The previous iteration leaned on free-form CSS selectors. That created three
recurring failure modes:

1. **Fragility** – class-name churn on the upstream site silently breaks a
   field; users only notice when their alert stops firing.
2. **High configuration friction** – a non-technical user has to crack open
   devtools, copy a selector, and guess which one will survive.
3. **Opaque failures** – when extraction fails, the user sees a generic
   message and cannot tell whether the page changed, the network call failed,
   or their selector is wrong.

The current code already supports CSS, XPath, attribute extraction, and an
ordered list of fallback selectors per field (`FieldSelector` in
`server/internal/ingestion/domain/property.go`). The bones of a hybrid system
exist; the surface around them needs to be more deliberate.

---

## 2. Strategy evaluation

Each candidate is scored on Robustness (R), Ease of use for non-technical users
(E), Cross-site applicability (X), Runtime cost (P), and Implementation
complexity (C). Scores are 1 (poor) – 5 (excellent). They are relative, not
absolute.

| Strategy                                  | R | E | X | P | C | Verdict |
| ----------------------------------------- | - | - | - | - | - | ------- |
| CSS selectors (current baseline)          | 2 | 3 | 4 | 5 | 5 | Cheap and familiar but fragile in isolation. Keep as the default. |
| XPath                                     | 3 | 2 | 4 | 4 | 4 | More expressive than CSS (text predicates, ancestor traversal); harder for users to author by hand. Keep as a power-user mode. |
| Attribute-based selection (`data-*`, `id`)| 4 | 3 | 3 | 5 | 5 | Excellent when sites expose stable hooks but coverage is patchy. Best modelled as a *flavour* of CSS rather than its own type. |
| Text-anchor (e.g. label "Price" → sibling)| 4 | 5 | 4 | 3 | 3 | Resilient to layout changes because it follows semantics rather than DOM paths. High UX value. Worth adding once the data model can describe an anchor + relative traversal. |
| Hybrid / fallback chain                   | 5 | 4 | 5 | 4 | 3 | Captures the upside of every primary strategy. Already present today; needs to be the system default rather than an afterthought. |
| DOM-path normalisation (e.g. trimmed XPath, structural fingerprints) | 4 | 4 | 3 | 3 | 2 | Useful as an *automated* fallback generated from a user click; not a strategy a user authors. Defer until the visual picker exists. |
| Visual / structural selection (point-and-click) | 4 | 5 | 4 | 2 | 1 | The right long-term answer for non-technical users. Requires either a server-rendered preview iframe or a browser extension and is out of scope for this PR. |

**Conclusion** – no single strategy wins on every axis. The system stays
*hybrid* with CSS as the default authoring surface, XPath for power users,
attribute and text-anchor as resilience features, and a visual picker as the
strategic UX direction.

---

## 3. Final design

### 3.1 Selector model

`FieldSelector` keeps its shape: one **primary selector** plus an ordered list
of **fallback selectors**, all sharing the same `selector_type`,
`extraction_mode`, attribute name, text mode, transform, and `required` flag.
This keeps the wire format compact and makes "the user wrote a CSS selector
with two backups" trivial to reason about.

Notable refinements landing in this PR:

- **Transforms become a small, explicit vocabulary**: `trim`, `lowercase`,
  `uppercase`, `integer` (alias `number`), `decimal`, `currency`. Anything else
  is rejected up front so we never silently ignore a typo. `currency` and
  `decimal` correctly preserve a single decimal separator – the previous
  `number` transform turned `$1,200.99` into `120099`, which wrecked
  change-tracking.
- **`text_mode` is now honoured at extraction time**. `innerText` strips
  `<script>` / `<style>` content and collapses whitespace the way a human
  would read the page; `textContent` returns the raw concatenation. Previously
  both modes did the same thing, which made the UI control misleading.
- **Structured `error_code` on each preview field result.** Free-form messages
  remain for humans, but the UI (and future automated retries) get a stable
  enum to branch on: `ok`, `selector_invalid`, `no_match`,
  `attribute_missing`, `empty_value`, `transform_failed`, `unsupported_type`.

### 3.2 Selector resolution algorithm

Given a field, the engine walks `[primary, ...fallbacks]` in order. For each
selector it:

1. Resolves the strategy (CSS for `css`/`attribute`/`text`/empty, XPath for
   `xpath`).
2. Validates the selector. XPath uses a conservative allow-list to keep
   user-supplied expressions cheap and safe.
3. Runs the query. Zero matches → continue to the next fallback.
4. Reads the value (text per `text_mode`, or the named attribute).
5. Applies the transform. Empty result after transform → continue.
6. On the first success, records the matched selector, whether a fallback was
   used, and the match count.

Failures are deterministic: every code path produces an `error_code`, never a
panic, and a missing required field surfaces as `degraded` status rather than
breaking the run.

### 3.3 UX contract

The authoring surface stays a structured form rather than a raw selector
textarea:

- One row per field with name, selector type, primary selector, fallbacks,
  extraction mode, attribute (when needed), text mode (for text extraction),
  and transform.
- Live preview wired to the new `error_code` so the UI can show
  field-specific guidance ("No element matched – try adding a fallback")
  instead of a generic warning.
- Default transform set widened so the dropdown matches the backend vocabulary
  – users no longer need to type `currency` by hand.

### 3.4 Data model

The on-disk shape – `properties`, `property_extraction_configs` (versioned
JSON blob of fields), `property_snapshots` – stays put. The redesign brief
allows breaking changes, but the existing schema already supports versioning
and multi-selector fields. The cost of a destructive migration outweighs the
benefit. A future PR can introduce per-selector metadata (e.g. last-success
timestamp) once the visual picker generates richer data.

---

## 4. What ships in this PR

- This research/design document.
- Backend (`server/internal/ingestion/...`):
  - Extended transform vocabulary with safe currency/decimal handling.
  - `extractNodeValue` honours `TextMode` (`innerText` vs `textContent`).
  - `PropertyPreviewFieldResult` exposes a structured `error_code`.
  - Validation rejects unknown transforms at config-save time.
  - Tests covering each new transform, both text modes, and the
    `error_code` contract.
- Frontend (`app/src/...`):
  - Transform dropdown surfaces the new options.
  - `PropertyPreviewFieldResult` typing exposes `error_code`.

---

## 5. Deferred work

Tracked but intentionally out of scope here to keep the diff reviewable:

1. **Visual element picker.** Server-rendered preview iframe with a JS
   overlay that produces both a CSS path and a normalised XPath, plus an
   anchor-based fallback. Largest UX win; needs a dedicated PR.
2. **Text-anchor selector type.** First-class support for "find the label
   *Price*, then read the next sibling" – requires a new selector subtype and
   form controls.
3. **Selector health telemetry.** Track per-selector success rate over time
   and surface "this selector has been failing for 3 runs" in the UI.
4. **Per-site templates.** Pre-fill selectors for known portals (Idealista,
   Fotocasa, …) so onboarding a new property is one click.
5. **Browser-rendered fallback by default.** Today `browser_enabled` is a
   per-property flag; once we have telemetry we can flip it automatically when
   HTTP fetches keep returning anti-bot pages.

---

## 6. Success criteria mapping

| Brief requirement | How it is met |
| --- | --- |
| Configure extraction in minutes | Structured form + curated transform vocabulary + live preview |
| Stable across runs | Hybrid fallback chain + deterministic resolution + status-aware retry |
| Failures rare and easy to fix | `error_code` + per-field message + fallback selectors |
| Works across multiple sites | CSS + XPath + attribute + (planned) text-anchor cover the variants observed in real listings |
