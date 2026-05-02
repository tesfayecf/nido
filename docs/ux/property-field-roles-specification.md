# Property Field Roles UX Specification

## Purpose

Make it explicit that most source-template fields exist to speed up property intake, while price and a small set of selected fields exist for ongoing monitoring.

## Problem

The current property and source-template interfaces show where a field came from and whether it still matches a template, but they do not explain why the field exists.

Operators can already infer that price matters most over time, yet the interface still presents price, rooms, area, bathrooms, and location as one undifferentiated set of extracted fields. That creates three avoidable questions:

- Which values help me create a property faster?
- Which values will Nido keep watching after creation?
- Which changes are important enough to surface as ongoing signals?

## UX Goal

Introduce one clear mental model across the product:

- `Prefill` fields import mostly stable listing facts to make property creation faster.
- `Tracked` fields are re-evaluated on each run and surfaced as meaningful ongoing signals.

Price remains the default tracked field. Rooms, bathrooms, area, location, and similar listing facts default to prefill unless an operator explicitly marks them as tracked.

## Usage Patterns

### 1. URL-first intake

The operator pastes a listing URL, confirms the price, and wants the rest of the property facts to populate automatically so the property can be created quickly.

### 2. Ongoing portfolio review

After creation, the operator mainly reviews price changes, run health, and decision signals. Static property facts become context, not the primary object of attention.

### 3. Exception-based fact review

If a listing fact changes, the operator should see it as an informative listing update or data-quality event, not as the default monitoring path.

### 4. Template reuse and maintenance

The operator configures a source template once, expects it to accelerate future property creation, and wants to know which fields are there for intake speed versus ongoing comparison.

## Design Principles

- Keep the create flow minimal. Do not force role decisions during routine property creation.
- Make field purpose visible before advanced selector editing starts.
- Use the same field-role language in source templates, property creation, and property detail.
- Keep price prominent as the primary live signal.
- Treat prefill-field changes as secondary informational events unless an operator explicitly promotes that field to tracked.

## Proposed Interaction Model

### Field roles

Use two explicit field roles everywhere selectors are displayed:

| Role | Meaning | Default examples | Lifecycle |
| --- | --- | --- | --- |
| `Prefill` | Import once to speed up property creation and enrich the record with listing facts. | `location`, `rooms`, `bathrooms`, `area_m2`, `property_age` | Shown as property facts after create; changes are informational. |
| `Tracked` | Compare across runs and surface changes as ongoing monitoring signals. | `price` | Shown in monitoring, signals, and change history. |

### Default behavior

- New source templates start with `price` as `Tracked` and `Required`.
- Known listing facts default to `Prefill` when added from a template starter flow.
- Property creation inherits field roles from the selected source template.
- Property creation does not require the operator to manually classify each field unless they open advanced configuration.

## Surface Changes

### Property creation

#### Existing intent to preserve

Keep the URL-first and price-first flow. Source templates should still accelerate property setup by auto-filling mostly static fields.

#### New summary block

When a source template is selected, show a summary block above advanced field editing.

**Section title**

`What this template will do`

**Supporting copy**

`Templates can speed up intake and define what Nido keeps monitoring after the property is created.`

**Group labels**

- `Prefill once`
- `Monitor on each run`

**Example rendered summary**

- `Prefill once: Location, Rooms, Bathrooms, Area`
- `Monitor on each run: Price`

#### Revised helper copy

**Source template field hint**

`Optional. Templates can prefill property facts and define what Nido keeps tracking after creation.`

**Price field hint**

`Required. Price is the primary tracked signal for acquisition decisions.`

**Collapsed advanced-config helper copy**

`Price is required now. Other source fields can prefill property facts so you can create the property faster.`

#### Button labels

- Replace `Configure price selector` with `Review source fields`
- Keep create action as `Create Property`

`Review source fields` is broader and more accurate once a template includes both price and non-price fields.

#### Empty-state copy

**No template selected**

`Select a source template to prefill property facts and define what Nido should monitor after creation.`

**Template has no prefill fields**

`This template does not prefill any property facts yet. Add fields like location, area, or rooms if you want faster intake.`

**Template has no tracked fields**

`This template does not track any live fields yet. Add at least one tracked field, usually price.`

**Preview found no prefill values**

`URL checked. No property facts were available to prefill from this template.`

### Source template editor

#### Selector table changes

Add a visible `Role` column before `Source` and `Status`.

**Column order**

- `Field`
- `Role`
- `Type`
- `Source`
- `Status`
- `Actions`

#### Field-role control

Inside the expanded field editor, add a select labeled `Field role`.

**Options**

- `Prefill`
- `Tracked`

**Field role hint**

`Use Prefill for mostly stable listing facts. Use Tracked for values you want Nido to compare on each run.`

#### Template intro copy

**Title remains**

`Create Template` or `Edit {template name}`

**Updated description**

`Build a reusable template that both speeds up property intake and defines which fields stay under live monitoring.`

#### Empty-state copy

**No prefill fields configured**

`No prefill fields yet. Add stable listing facts if you want faster property creation from a URL.`

**No tracked fields configured**

`No tracked fields yet. Add price or another live signal before relying on this template for monitoring.`

### Property detail

#### Section naming

Keep price and property facts separate in the detail experience.

**Recommended section names**

- Keep `Price Intelligence`
- Rename `Editable Attributes` to `Property Facts`
- Rename `Fields & Source Extraction` to `Source Fields`

#### Section descriptions

**Property Facts description**

`Mostly stable facts imported from the listing or entered manually. These support context and comparison, but they are not the main live monitoring signal.`

**Source Fields description**

`Review which source fields prefill property facts and which ones stay under live monitoring.`

#### Signals behavior

- `Tracked` field changes appear in the main signal stream.
- `Prefill` field changes appear in a lower-emphasis informational group.

**Informational label for changed prefill fields**

`Listing facts changed`

**Informational helper copy**

`This field is marked as Prefill, so changes are shown as listing updates instead of primary monitoring alerts.`

#### Empty-state copy

**No property facts captured**

`No property facts have been captured yet. Run the source again or add details manually.`

**No tracked signals beyond price**

`Price is the only live signal for this property right now.`

### Source health and analytics

Do not mix prefill completeness and tracked-field monitoring health into one score without explanation.

**Recommended group labels**

- `Tracked field health`
- `Prefill coverage`

**Tracked field health helper copy**

`Shows whether live monitoring fields are still extracting reliably across recent runs.`

**Prefill coverage helper copy**

`Shows how often intake-oriented listing facts are available when this template is used.`

## Exact Label Inventory

Use the following label set consistently across surfaces.

| UI element | Exact label |
| --- | --- |
| Field role badge | `Prefill` |
| Field role badge | `Tracked` |
| Property create summary title | `What this template will do` |
| Property create summary group | `Prefill once` |
| Property create summary group | `Monitor on each run` |
| Property create advanced button | `Review source fields` |
| Source editor field control | `Field role` |
| Property detail section | `Property Facts` |
| Property detail section | `Price Intelligence` |
| Property detail config section | `Source Fields` |
| Informational signal group | `Listing facts changed` |
| Source health section | `Tracked field health` |
| Source health section | `Prefill coverage` |

## Behavior Notes

- Role selection belongs primarily to source-template editing, not the basic property-create path.
- Property creation should show inherited roles clearly, but advanced overrides remain secondary.
- Price keeps its special status even when it is also auto-filled from the URL. Its role remains `Tracked`.
- If a team later needs a non-price field to be monitored over time, that field should be explicitly promoted to `Tracked` instead of overloading the meaning of `Prefill`.

## Acceptance Criteria

- A first-time operator can tell, before creating a property, which fields will only help with intake and which fields will be watched later.
- A source-template editor can classify a field without reading implementation docs.
- The property detail page visually separates stable property facts from ongoing tracked signals.
- Empty states explain the consequence of missing prefill fields versus missing tracked fields.
- Price remains visually prominent as the primary live signal throughout the workflow.

## Implementation Order

1. Introduce field-role language and summary copy in property creation.
2. Add `Field role` controls and badges to the source-template editor.
3. Split property detail messaging into `Property Facts` and `Price Intelligence`.
4. Reclassify prefill-field changes into lower-emphasis informational signals.
5. Update source health reporting to distinguish tracked-field health from prefill coverage.