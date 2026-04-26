# Conventions

## Purpose

This document defines the documentation standards for structure, naming, linking, and tone.

## Context

The repository previously had mixed naming styles, stale planning artifacts, and overlapping docs. These conventions keep the new structure maintainable.

## Core Concepts

- Use Markdown only.
- Use kebab-case file names.
- Prefer descriptive names such as `data-flow.md` and `state-management.md`.
- Keep every document short, explicit, and directly linked to related docs.
- Use relative links only.

## Behavior / Flow

Every documentation file should follow this structure when it fits the content:

1. `# Title`
2. `## Purpose`
3. `## Context`
4. `## Core Concepts`
5. `## Behavior / Flow`
6. `## Examples`
7. `## Related Docs`

Writing rules:

- prefer direct statements over narrative language
- avoid placeholder text
- describe active behavior before future work
- update related docs in the same change when behavior or terminology changes
- keep navigation paths within two or three clicks from the root hub

## Examples

Preferred naming examples:

- `system-design.md`
- `developer-workflow.md`
- `source-templates-and-runs.md`

Names to avoid:

- `notes.md`
- `flow.md`
- `misc.md`

## Related Docs

- [References / Glossary](./glossary.md)
- [Guides / Developer Workflow](../guides/developer-workflow.md)
- [Architecture / Design Patterns](../architecture/design-patterns.md)
