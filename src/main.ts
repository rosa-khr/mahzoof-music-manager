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
bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker("ngsw-worker.js", {
      enabled: !isDevMode(),
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
        loadComponent: () =>
          import("./app/features/today").then((m) => m.Today),
      },
      {
        path: "students",
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
        path: "students/:id",
        loadComponent: () =>
          import("./app/features/profile").then((m) => m.Profile),
      },
      {
        path: "account",
        loadComponent: () =>
          import("./app/features/account").then((m) => m.Account),
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
      ]),
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
