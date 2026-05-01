# Frontend UI Architecture

## Route owners

- `/login` → auth
- `/dashboard`, `/triage` → operator workflows
- `/properties*` → tracked-property workflows
- `/analytics` → analytics workbench
- `/fields` → field library
- `/sources*`, `/runs*`, `/tags` → backoffice workflows
- `/bookmarks`, `/alerts`, `/notifications` → engagement workflows
- `/settings`, `/admin` → workspace and platform settings

## Main files

- router: `app/src/app/router.tsx`
- shell: `app/src/app/AppShell.tsx`
- route protection: `app/src/app/RequireAuth.tsx`
- navigation: `app/src/components/shell/navigation.ts`

Pages should own workflow composition. Shared components should stay generic and small.
