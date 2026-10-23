import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { provideServiceWorker } from "@angular/service-worker";
import { isDevMode } from "@angular/core";
import { App } from "./app/app";
import { PLANNED_PAGES } from "./app/core/navigation";
import { BASE_RESOURCES } from "./app/core/base-data";
import { menuGuard } from "./app/core/menu-guard";
import { authInterceptor } from "./app/core/api";
const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(
  location.hostname,
);
// Local previews must show the latest build, including when an older PWA was installed.
if (localPreview && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then(async (registrations) => {
      for (const registration of registrations) {
        const worker =
          registration.active ||
          registration.waiting ||
          registration.installing;
        if (worker && new URL(worker.scriptURL).pathname === "/ngsw-worker.js")
          await registration.unregister();
      }
    })
    .catch(() => {
      /* Preview remains usable if worker access is unavailable. */
    });
}
bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode() && !localPreview,
      registrationStrategy: "registerWhenStable:30000",
    }),
    provideRouter([
      {
        path: "login",
        loadComponent: () =>
          import("./app/features/login").then((m) => m.Login),
      },
      {
        path: "",
        canActivate: [menuGuard],
        data: { access: "all", menu: "/" },
        loadComponent: () =>
          import("./app/features/today").then((m) => m.Today),
      },
      {
        path: "students",
        canActivate: [menuGuard],
        data: { access: "all", menu: "/students" },
        loadComponent: () =>
          import("./app/features/students").then((m) => m.Students),
      },
      {
        path: "students/new",
        canActivate: [menuGuard],
        data: { access: "education" },
        loadComponent: () =>
          import("./app/features/student-form").then((m) => m.StudentForm),
      },
      {
        path: "students/:id/edit",
        canActivate: [menuGuard],
        data: { access: "education" },
        loadComponent: () =>
          import("./app/features/student-form").then((m) => m.StudentForm),
      },
      {
        path: "students/:id/print",
        canActivate: [menuGuard],
        data: { access: "all", menu: "/students" },
        loadComponent: () =>
          import("./app/features/student-print").then((m) => m.StudentPrint),
      },
      {
        path: "students/:id",
        canActivate: [menuGuard],
        data: { access: "all", menu: "/students" },
        loadComponent: () =>
          import("./app/features/profile").then((m) => m.Profile),
      },
      {
        path: "account",
        loadComponent: () =>
          import("./app/features/account").then((m) => m.Account),
      },
      {
        path: "users",
        canActivate: [menuGuard],
        data: { access: "admin" },
        loadComponent: () =>
          import("./app/features/users").then((m) => m.Users),
      },
      {
        path: "users/new",
        canActivate: [menuGuard],
        data: { access: "admin" },
        loadComponent: () =>
          import("./app/features/user-form").then((m) => m.UserForm),
      },
      {
        path: "users/:id/edit",
        canActivate: [menuGuard],
        data: { access: "admin" },
        loadComponent: () =>
          import("./app/features/user-form").then((m) => m.UserForm),
      },
      {
        path: "roles",
        canActivate: [menuGuard],
        data: { access: "admin", menu: "/roles" },
        loadComponent: () =>
          import("./app/features/roles").then((m) => m.Roles),
      },
      {
        path: "roles/new",
        canActivate: [menuGuard],
        data: { access: "admin", menu: "/roles" },
        loadComponent: () =>
          import("./app/features/role-form").then((m) => m.RoleForm),
      },
      {
        path: "roles/:id/edit",
        canActivate: [menuGuard],
        data: { access: "admin", menu: "/roles" },
        loadComponent: () =>
          import("./app/features/role-form").then((m) => m.RoleForm),
      },
      {
        path: "reports/education",
        pathMatch: "full",
        redirectTo: "reports/finance",
      },
      ...BASE_RESOURCES.flatMap((resource) => [
        {
          path: "base-data/" + resource.key,
          canActivate: [menuGuard],
          data: { access: "education", resource },
          loadComponent: () =>
            import("./app/features/base-data-list").then((m) => m.BaseDataList),
        },
        ...(resource.key === "session-statuses"
          ? [
              {
                path: "base-data/session-statuses/new",
                pathMatch: "full" as const,
                redirectTo: "base-data/session-statuses",
              },
            ]
          : [
              {
                path: "base-data/" + resource.key + "/new",
                canActivate: [menuGuard],
                data: { access: "education", resource },
                loadComponent: () =>
                  import("./app/features/base-data-form").then(
                    (m) => m.BaseDataForm,
                  ),
              },
            ]),
        {
          path: "base-data/" + resource.key + "/:id/edit",
          canActivate: [menuGuard],
          data: { access: "education", resource },
          loadComponent: () =>
            import("./app/features/base-data-form").then((m) => m.BaseDataForm),
        },
        ...(resource.key === "instructors"
          ? [
              {
                path: "base-data/instructors/:id",
                canActivate: [menuGuard],
                data: { access: "education", resource },
                loadComponent: () =>
                  import("./app/features/instructor-profile").then(
                    (m) => m.InstructorProfile,
                  ),
              },
            ]
          : []),
      ]),
      {
        path: "subjects",
        canActivate: [menuGuard],
        data: { access: "education", menu: "/subjects" },
        loadComponent: () =>
          import("./app/features/subjects").then((m) => m.Subjects),
      },
      {
        path: "subjects/new",
        canActivate: [menuGuard],
        data: { access: "education", menu: "/subjects" },
        loadComponent: () =>
          import("./app/features/subject-form").then((m) => m.SubjectForm),
      },
      {
        path: "subjects/:id/edit",
        canActivate: [menuGuard],
        data: { access: "education", menu: "/subjects" },
        loadComponent: () =>
          import("./app/features/subject-form").then((m) => m.SubjectForm),
      },
      {
        path: "registration-policies",
        canActivate: [menuGuard],
        data: { access: "education", menu: "/registration-policies" },
        loadComponent: () =>
          import("./app/features/registration-policies").then(
            (m) => m.RegistrationPolicies,
          ),
      },
      {
        path: "settings/letterhead",
        canActivate: [menuGuard],
        data: { access: "admin", menu: "/settings/letterhead" },
        loadComponent: () =>
          import("./app/features/letterhead-settings").then(
            (m) => m.LetterheadSettings,
          ),
      },
      ...["classes", "terms", "sessions"].map((path) => ({
        path,
        pathMatch: "full" as const,
        redirectTo: "students",
      })),
      ...PLANNED_PAGES.map((page) => ({
        path: page.path.slice(1),
        pathMatch: "full" as const,
        canActivate: [menuGuard],
        data: page,
        loadComponent: () =>
          import("./app/features/planned-page").then((m) => m.PlannedPage),
      })),
      { path: "**", redirectTo: "" },
    ]),
  ],
}).catch(console.error);
