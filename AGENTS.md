# Project conventions

- The user's current list reference is the Orenza product list in the adjacent `../orenza` project. All existing and new data lists must use **AG Grid**, with Persian RTL, Dana, consistent column headers, compact row actions, filtering, sorting and pagination. See `docs/LIST_UI_STANDARD.md`.
- Build sections incrementally as the user selects them. For edit forms, follow the user's supplied layout and field requirements; do not invent new edit forms while implementing menus or lists.
- Keep working APIs, data and authorization intact. Planned navigation destinations must clearly state that implementation is pending, without fake records or simulated saves.

- Current grid appearance is neutral **gray and white**, not Orenza colors. All list filters must live inside AG Grid (floating/column filters); do not add external search or status/term filter forms. Orenza remains a reference for grid behavior only.

- Form dropdowns use the shared `Select2` directive (`select appSelect2`, import from `src/app/shared/select2.ts`), with Persian search, RTL, Dana and fixed labels above fields. Keep Angular Reactive Forms as the source of truth, including dynamic options and disabled state. Grid filter/pagination controls remain AG Grid's own controls.

- The user removed the standalone Education menu (classes/groups, terms/renewal, sessions/attendance). Keep educational actions inside student management and student profiles; do not reintroduce those sidebar destinations. Legacy /classes, /terms and /sessions redirect to /students.

- Latest form standard: fixed labels above controls (no floating labels), compact sm inputs and Select2. Boolean/two-state fields use shared Switch; preserve multi-state statuses and explicit absence quota decisions.
