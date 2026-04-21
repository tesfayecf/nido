# UI / UX Specification

## Intent

The listing explorer is evolving from a general listing browser into a compact market-intelligence surface. The primary design goal is dense situational awareness: operators should see pricing, market-relative positioning, time-on-market, and regional trend cues without drilling into every card.

## Design Tokens

### Color System

- `--color-bg`: deep slate canvas for the application shell
- `--color-surface`: elevated navy/slate panel surface
- `--color-surface-strong`: high-contrast panel surface for modal overlays
- `--color-border`: low-contrast structural divider
- `--color-text`: primary neutral content color
- `--color-text-muted`: subdued analytical meta copy
- `--color-accent`: data-action blue used for active controls and sparkline emphasis
- `--color-accent-soft`: low-contrast hover and active background treatment
- `--color-danger`: destructive and failure state color
- `--color-warning`: caution and anomaly highlight color
- `--color-success`: positive signal color used for live updates and value opportunities

### Typography Scale

- Display title: reserved for shell and hero-level route titles
- Panel title: used by `PageCard` headers
- Dense row title: compact listing title in the explorer
- Meta copy: timestamps, source references, benchmark labels
- Metric label/value pairing: inline decision-support metrics

### Spacing Rhythm

- Base rhythm stays on the existing 4px-derived token system
- Result rows use tighter padding than general panels
- Toolbar and filter actions keep `var(--space-2)`/`var(--space-3)` gaps to preserve information density

## Component Hierarchy

### Iteration A: High-Performance Main View

1. `ListingsPage`
   - `PageCard` filter bar with URL-backed search controls
   - metric summary strip
   - virtualized dense results list
   - viewport intelligence side panel
   - side-by-side compare panel
2. `ListingRow`
   - title + source/location metadata
   - inline price, days on market, market delta
   - compact regional sparkline
   - compare and price-history actions
3. `PriceHistoryModal`
   - in-context price trend inspection without route changes

### Iteration B: Advanced Filtering & Price History

- Price range filters remain URL-synced (`min_price`, `max_price`)
- Best-value sorting highlights listings priced 20%+ below local average
- Price history modal keeps list scroll state and compare context intact

### Iteration C: Alerts & Preferences Dashboard

- Existing authenticated alerts, notifications, and watchlist routes remain the foundation
- Live update toast behavior is tied to the active search session and should expand into user-tunable preferences once backend event filtering grows richer

## State Boundaries

### URL Search Params

Use the URL for shareable market-view state:

- `q`
- `source_id`
- `limit`
- `min_price`
- `max_price`
- `sort`
- `value_only`

### Zustand Search Session

Use Zustand for non-shareable session state:

- compare basket selection
- viewport bounds and zoom level
- search-as-I-move toggle
- transient list interaction state

### TanStack Query

Use TanStack Query for:

- listing result fetches
- listing detail and price history fetches
- optimistic bookmark updates
- refetch triggered by live ingestion events

## Geospatial Readiness Note

The current backend listing contract still exposes no coordinates. The frontend therefore implements the search-session viewport contract and a market-cluster intelligence panel now, while deferring literal marker rendering and `supercluster` integration until geospatial payloads exist.
