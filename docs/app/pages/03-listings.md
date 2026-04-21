# Listings Explorer

## Purpose
Provide the main market-intelligence workspace for filtering, comparing, and reviewing listings.

## Screenshot
![Listings explorer](../assets/listings.png)

## UI Elements
### Element: Filter bar
- Type: form
- Description: Holds search text, source, min/max price, sort, limit, and value-anomaly controls.
- Behavior: Apply writes filters into the URL; Reset draft restores the in-form draft to the current URL state.

### Element: Summary strip
- Type: metric panel
- Description: Shows listing count, average price, anomaly count, and dominant sort.
- Behavior: Recomputes after filter changes or list refreshes.

### Element: Result rows
- Type: interactive list
- Description: Shows title, source, price, market delta, time markers, and quick actions.
- Behavior: Supports opening detail, opening the original source, toggling compare, and opening the price-history modal.

### Element: Viewport Intelligence
- Type: control panel
- Description: Displays synthetic bounds, zoom, and regional cluster summaries.
- Behavior: Pan and zoom buttons update the session viewport state.

### Element: Side-by-Side Compare
- Type: comparison panel
- Description: Holds up to three shortlisted listings.
- Behavior: Fills as compare is toggled from result rows and can be cleared.

## User Actions
- Change filters and press Apply → The result set refreshes from the backend.
- Press Compare on a row → The listing appears in the compare panel.
- Press Price history → An in-context modal opens without leaving the page.
- Open the page while signed out → Browsing still works, but authenticated live-update prompts remain gated.

## Navigation
- Previous: [Shell Navigation](./02-shell-navigation.md)
- Next: [Listing Detail](./04-listing-detail.md)
