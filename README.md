Absolutely — here’s a polished GitHub public-page description that highlights what Nido is, its architecture, and its main value without overwhelming visitors.

# Nido

**Nido is a self-hosted property-tracking workspace for managing properties, engagement, analytics, and operational data from a single authenticated application.**

Built as a modern monorepo, Nido combines a **Go backend**, **React frontend**, and **SQLite database** into a lightweight, reliable workspace designed with data safety and operational control in mind.

### Highlights

* **Authenticated workspace** with admin and operator workflows
* **Property tracking** with custom fields, tags, and engagement data
* **Analytics and reporting** APIs for operational insights
* **Go backend** with a structured API and SQLite persistence
* **React 19 + Vite frontend** with typed service modules
* **Data-first architecture** with automated backups and controlled migrations
* **Safe database migrations** with pre-migration backups
* **Portable data management** with JSON backup and restore capabilities
* **Monorepo structure** separating frontend, backend, documentation, configuration, and developer tooling

### Architecture

```text
Nido
├── app/       React 19 + Vite frontend
├── server/    Go backend + SQLite persistence
├── cmd/       Local development helpers
├── docs/      Architecture, onboarding & workflow documentation
└── config/    Local configuration
```

The frontend communicates with the backend through typed service modules, while SQLite serves as the system of record. The application runtime is designed to prioritize **data safety over availability**, particularly during schema changes.

### Data Safety

Nido includes a controlled migration system with configurable strategies:

* `safe-auto` — automatically backs up the database before applying schema changes
* `manual` — requires migrations to be handled explicitly
* Pre-migration SQLite backups
* Portable JSON exports
* Server-side backup creation
* Restore workflows
* Migration status and recovery controls

This makes Nido suitable for environments where preserving operational data is more important than automatically applying every change.

### Development

Nido provides a unified development workflow for running the backend, frontend, and common project tasks locally.

The project includes automated validation for:

* Frontend tests
* Linting
* Type checking
* Production builds
* Go backend tests

For detailed setup and architecture information, see the documentation in [`/docs`](./docs/README.md).

---

**Nido — a focused workspace for tracking properties, managing operational data, and keeping your data under control.**
