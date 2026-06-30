import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, History, User, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary via-primary to-success text-primary-foreground shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--primary)_70%,transparent)]">
              <span className="text-[11px] font-black tracking-tighter">AM</span>
              <span className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-base font-semibold tracking-[0.18em] uppercase">AshoMa</span>
              <span className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Smart Nutrition
              </span>
            </span>
          </Link>
          <button
            onClick={signOut}
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/5 bg-white/[0.03] text-muted-foreground transition hover:text-foreground hover:bg-white/[0.06]"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-3 z-30 mx-auto max-w-sm px-4">
        <div className="grid grid-cols-3 rounded-2xl border border-white/10 bg-background/70 p-1.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-semibold uppercase tracking-wider transition",
                  active
                    ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--primary)_30%,transparent)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-4.5 w-4.5", active && "drop-shadow-[0_0_6px_color-mix(in_oklab,var(--primary)_60%,transparent)]")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export async function requireAuthBeforeLoad() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const { redirect } = await import("@tanstack/react-router");
    throw redirect({ to: "/login" });
  }
  return { user: data.user };
}
