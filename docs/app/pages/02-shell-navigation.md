# Shell Navigation

## Purpose
Describe the shared application shell used on all non-login routes.

## Screenshot
![Application shell](../assets/listings.png)

## UI Elements
### Element: Sidebar navigation
- Type: menu
- Description: Groups routes into Explore, Track, and Operate sections.
- Behavior: Highlights the active route and collapses on small screens.

### Element: Header title block
- Type: status header
- Description: Shows the current section, route title, and route description.
- Behavior: Changes automatically with navigation.

### Element: Menu button
- Type: button
- Description: Toggles sidebar visibility on narrow viewports.
- Behavior: Opens or closes the navigation drawer.

### Element: Signed-in footer
- Type: status panel
- Description: Shows the current user identity and sign-out action.
- Behavior: Switches to a sign-in prompt when no valid session exists.

## User Actions
- Choose a sidebar link → The route content changes inside the shared shell.
- Press Sign out → Protected state is cleared and the user returns to login.
- Use Skip to main content → Keyboard focus jumps into the page body.

## Navigation
- Previous: [Login](./01-login.md)
- Next: [Listings Explorer](./03-listings.md)
