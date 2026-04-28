# UX Improvement Specification

## Phase 1 Changes Implemented

### 1. Alerts workflow

**Before**
- Global alerts page used “Create alert rule”, “Create rule”, and “Threshold amount”.
- Failures during creation did not surface inline in the dialog.

**After**
- Both entry points use the same task language: “Create alert”.
- Threshold input is labeled consistently as “Threshold”.
- The dialog now shows inline failure feedback and toast feedback for create/delete outcomes.

**Expected outcome**
- Lower hesitation when creating alerts.
- Better trust in system state after success or failure.

### 2. Triage inbox actions

**Before**
- Triggering one action disabled all matching actions across the list.

**After**
- Only the row being processed enters a loading/disabled state.

**Expected outcome**
- Better state visibility.
- Faster repeated triage actions without confusion.

### 3. Source list navigation

**Before**
- Opening a source was available through row click, an icon button, and a menu item.

**After**
- The row and icon remain the primary open affordances.
- The overflow menu keeps only secondary actions.

**Expected outcome**
- Fewer redundant choices.
- Faster scanning and action selection.

### 4. Settings persistence cues

**Before**
- Save labels were generic and one select control diverged from the shared form pattern.

**After**
- Save actions describe their intent: profile, preferences, intake defaults.
- Severity selection now uses the shared select component.

**Expected outcome**
- Clearer understanding of what each save action persists.
- Better consistency across forms.

### 5. Properties table controls

**Before**
- Column controls stayed open until the same button was toggled again.

**After**
- Column controls close on outside click and Escape.

**Expected outcome**
- Lower friction for first-time exploration.
- Better alignment with modal/popover expectations across the app.

## Remaining Backlog

### Next high-impact items
1. Reduce branching in property create/edit optional sections.
2. Standardize view-vs-edit behavior between source detail and property detail.
3. Consolidate alert creation shared behavior into a reusable helper.
4. Tighten shell navigation labeling and information scent for first-time users.
5. Capture seeded before/after screenshots for the touched workflows once browser automation is available in an unlocked environment.

## Before vs After Workflow Notes

### Alert creation
- **Before:** open dialog → decipher differing labels → submit → limited failure feedback
- **After:** open dialog → see consistent labels → submit → receive explicit success/failure feedback

### Triage action
- **Before:** click action → multiple actions appear blocked
- **After:** click action → only that row shows pending state

### Source opening
- **Before:** click row / click icon / open menu → choose “Open”
- **After:** click row or icon for the primary path, use menu only for secondary actions
