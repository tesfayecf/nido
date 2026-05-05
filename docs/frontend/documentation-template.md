# Frontend Documentation Template

Use this template whenever a frontend file is created or substantially rewritten.

## File header template

```ts
/**
 * File: app/src/path/to/File.tsx
 *
 * Purpose:
 * State exactly what this file owns.
 *
 * Responsibilities:
 * - List concrete actions this file performs
 * - Identify UI, data, state, or styling ownership
 *
 * Inputs:
 * - Props, parameters, imports, environment variables, storage keys, or browser APIs
 *
 * Outputs:
 * - JSX, typed values, service responses, styles, storage writes, route definitions, or side effects
 *
 * Dependencies:
 * - Internal modules
 * - External packages
 *
 * Key Decisions:
 * - Explain important implementation choices and why they are safe
 *
 * Constraints:
 * - State limits, assumptions, and synchronization requirements
 *
 * Related:
 * - /docs/frontend/architecture-overview.md
 * - /docs/frontend/codebase-navigation.md
 */
```

## Component comment template

```ts
/**
 * Purpose: Renders the named UI boundary and states its user-facing responsibility.
 * Rendering logic: Describe the high-level composition and conditional states.
 * State management: Name local state, external stores, React Query data, or state absence.
 * Side effects: Name API calls, subscriptions, storage writes, routing, or side-effect absence.
 * Performance: Note memoization, virtualization, stable handlers, or why none is required.
 */
```

## Function comment template

```ts
/**
 * Purpose: Explain the operation in one explicit sentence.
 * Parameters: Name each parameter and the expectation the caller must satisfy.
 * Returns: Describe the return value and important invariants.
 * Side effects: State storage, network, routing, DOM, or side-effect absence.
 * Edge cases: List null, malformed, empty, stale, permission, or boundary cases handled.
 */
```

## Critical logic annotation template

```ts
/*
 * Critical point: explain why this conditional, transformation, business rule, or performance-sensitive block exists.
 * Describe what would break if this logic were removed, reordered, broadened, or narrowed incorrectly.
 */
```

## Quality checklist

- [ ] Purpose uses specific ownership language, not generic phrases.
- [ ] Responsibilities are action-oriented and testable.
- [ ] Inputs and outputs identify real contracts.
- [ ] Dependencies include internal modules and external packages.
- [ ] Constraints identify synchronization, runtime, or compatibility limits.
- [ ] Related links point to existing docs or source owners.
- [ ] Component/function comments change when behavior changes.
- [ ] Critical logic documents both reason and breakage impact.

## Related

- [Frontend Hub](./README.md)
- [Architecture Overview](./architecture-overview.md)
- [Codebase Navigation](./codebase-navigation.md)
- [Visual Proof](./visual-proof.md)
