"use client";
// Rewrites router.push/replace/prefetch (used by <Link> too) so dynamic routes
// open their static shell inside the app. See lib/shellRoutes.ts. No-op on web.
import { useRouter } from "next/navigation";
import { STATIC_SHELL, toShellHref } from "@/lib/shellRoutes";

export default function ShellRouterPatch() {
  const router = useRouter() as any;
  if (STATIC_SHELL && router && !router.__shellPatched) {
    for (const m of ["push", "replace", "prefetch"]) {
      const orig = router[m];
      if (typeof orig !== "function") continue;
      router[m] = (href: any, ...rest: any[]) => orig.call(router, typeof href === "string" ? toShellHref(href) : href, ...rest);
    }
    router.__shellPatched = true;
  }
  return null;
}
