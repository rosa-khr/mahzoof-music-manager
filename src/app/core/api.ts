import { inject, Injectable, signal } from "@angular/core";
import { HttpClient, HttpInterceptorFn } from "@angular/common/http";
import { Router } from "@angular/router";
import { firstValueFrom, catchError, throwError } from "rxjs";
import { User } from "./models";
@Injectable({ providedIn: "root" })
export class Api {
  http = inject(HttpClient);
  router = inject(Router);
  user = signal<User | null>(null);
  csrf = "";
  get<T>(path: string) {
    return firstValueFrom(this.http.get<T>("/api" + path));
  }
  post<T>(path: string, body: unknown, key?: string) {
    return firstValueFrom(
      this.http.post<T>("/api" + path, body, {
        headers: key ? { "Idempotency-Key": key } : {},
      }),
    );
  }
  patch<T>(path: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>("/api" + path, body));
  }
  async restore() {
    try {
      const v = await this.get<{ user: User; csrf: string }>("/auth/me");
      this.user.set(v.user);
      this.csrf = v.csrf;
    } catch {
      this.user.set(null);
      await this.router.navigateByUrl("/login");
    }
  }
  async login(body: unknown) {
    const v = await this.post<{ user: User; csrf: string }>(
      "/auth/login",
      body,
    );
    this.user.set(v.user);
    this.csrf = v.csrf;
    await this.router.navigateByUrl("/");
  }
  async logout() {
    await this.post("/auth/logout", {});
    this.clear();
  }
  clear() {
    this.user.set(null);
    this.csrf = "";
    void this.router.navigateByUrl("/login");
  }
}
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(Api);
  return next(
    req.clone({ setHeaders: api.csrf ? { "X-CSRF-Token": api.csrf } : {} }),
  ).pipe(
    catchError((error) => {
      if (error.status === 401 && !req.url.endsWith("/auth/login")) api.clear();
      return throwError(() => error);
    }),
  );
};
export function errorMessage(e: unknown): string {
  return (
    (e as { error?: { error?: string } })?.error?.error ||
    "ارتباط با سرور برقرار نشد؛ اطلاعات فرم حفظ شده است. دوباره تلاش کنید."
  );
}
