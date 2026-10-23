import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { Api } from "./api";
import { canOpenMenu, MenuAccess } from "./navigation";

export const menuGuard: CanActivateFn = async (route) => {
  const api = inject(Api);
  const router = inject(Router);
  if (!api.user()) await api.restore();
  if (!api.user()) return router.createUrlTree(["/login"]);
  return (
    canOpenMenu(
      api.user(),
      route.data["access"] as MenuAccess,
      route.data["menu"] ||
        ("/" + route.routeConfig?.path)
          .replace(/\/:.*$/, "")
          .replace(/\/new$/, ""),
    ) ||
    router.createUrlTree([
      api.user()?.permissions?.includes("/") === false ? "/account" : "/",
    ])
  );
};
