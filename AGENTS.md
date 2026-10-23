# Project conventions

- Date inputs use the shared Persian calendar directive `appDatepicker` from `src/app/shared/datepicker.ts`; keep Reactive Forms and Jalali text values, with ISO conversion at the API boundary. Default term end is start + 7 × (session quota − 1) calendar days: start is the first session. Preserve manual end-date overrides and offer explicit recalculation. This is a date suggestion, not automatic session creation.

- Student workflow: new registrations and terms use independent instrument/instructor/teaching-type/academy/payment-method references. Onsite requires an academy. Keep legacy subject-based enrollment history and API compatibility; never infer a mapping from old subject names. New term reservations and non-present attendance require requester, explicit justified/unjustified reason and explanation; absence still needs an explicit quota decision. Installments are obligations, not receipts; retain exact currency arithmetic, FIFO installment balance display, and idempotent real receipts. See `docs/STUDENT_WORKFLOW_PROMPT.md`.

- Latest navigation: the collapsible «افراد» group contains student records and instructors. Instructors no longer appears under Base Data. Rename the standalone Users/Roles group to «مدیریت امنیت». Preserve existing route paths and permission grants when moving these menus.

- The user's current list reference is the Orenza product list in the adjacent `../orenza` project. All existing and new data lists must use **AG Grid**, with Persian RTL, Dana, consistent column headers, compact row actions, filtering, sorting and pagination. See `docs/LIST_UI_STANDARD.md`.
- Build sections incrementally as the user selects them. For edit forms, follow the user's supplied layout and field requirements; do not invent new edit forms while implementing menus or lists.
- Keep working APIs, data and authorization intact. Planned navigation destinations must clearly state that implementation is pending, without fake records or simulated saves.

- Current grid appearance is neutral **gray and white**, not Orenza colors. All list filters must live inside AG Grid (floating/column filters); do not add external search or status/term filter forms. Orenza remains a reference for grid behavior only.

- Form dropdowns use the shared `Select2` directive (`select appSelect2`, import from `src/app/shared/select2.ts`), with Persian search, RTL, Dana and the shared outlined floating labels. Keep Angular Reactive Forms as the source of truth, including dynamic options and disabled state. Grid filter/pagination controls remain AG Grid's own controls.

- The user removed the standalone Education menu (classes/groups, terms/renewal, sessions/attendance). Keep educational actions inside student management and student profiles; do not reintroduce those sidebar destinations. Legacy /classes, /terms and /sessions redirect to /students.

- Latest user redesign request restores real floating labels, superseding the earlier fixed-label request. Use the shared Field's compact 38px outlined floating labels: labels rest inside empty controls and move to the border on focus or value; Select2 selection, errors and password eyes must not overlap. Boolean/two-state fields use shared Switch; role menu permissions use checkboxes. Preserve multi-state statuses and explicit absence quota decisions.

- Student create/edit uses tabs for personal info (including age/address/photo), instrument/term/session operations, attendance and term tuition. Preserve personal drafts when changing tabs; education/finance role guards remain in force.
- Session status basic data has four permanent codes (present/absent/reserved/cancelled). Edit Persian names/notes through the existing AG Grid/editor; do not add/delete/disable codes or change quota rules. Per-session radios use these labels; absence still requires an explicit quota decision and reason, cancellation requires reason and actor.

- User Management is a standalone collapsible sidebar group with Users and Roles, independent of Settings. Registration Policies belongs to Settings, separate from the Certificates group. Remove the Other Institutions destination from navigation and the menu permission catalog; keep existing education data intact. Reports currently exposes only Financial. Menu permissions live in shared/menu-permissions.json and are enforced by route guards and server API checks; hiding sidebar links alone is insufficient. The permanent administrator role always has all menus. Preserve existing user assignments and the last active administrator guard.

- Password creation, reset and personal change require 8–256 characters. Use the shared appPassword directive for an independent accessible show/hide eye on every password field. Keep passwords out of logs and status artifacts. Theme accents may use subtle blue, green, amber and purple while AG Grid surfaces stay gray/white.

- The users list displays account status as a read-only badge, never an interactive switch. Lock/unlock belongs in the user editor. Use the shared SweetAlert2 confirmation helper for user edits; cancellation must preserve the draft without writing to the API. Do not use native browser confirm dialogs.

- Role permission editing uses grouped native checkboxes with select-all and partial group state, not grid switches. The roles data list remains AG Grid, showing name, read-only active status and edit action without menu details or counts. Role active status uses the shared Switch in the editor. Inactive roles cannot log in or be newly assigned; preserve existing assignments and revoke sessions when roles change. The permanent administrator role cannot be disabled or lose menu access.
