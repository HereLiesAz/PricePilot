import { Moon, Plane, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { ApiStatusBadge } from "@/components/ApiStatusBadge";
import { EnableAlertsButton } from "@/components/EnableAlertsButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Lists", end: true },
  { to: "/search", label: "Find" },
  { to: "/about", label: "About" },
];

export function Layout() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  return (
    <div className="min-h-dvh flex flex-col">
      <OfflineBanner />
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <Plane className="size-5 text-[var(--color-primary)]" aria-hidden />
            PricePilot
          </div>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <EnableAlertsButton />
            <ApiStatusBadge />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--color-border)] py-4 text-center text-xs text-[var(--color-muted-foreground)]">
        PricePilot · Phase 0 scaffold · installable & offline-capable
      </footer>
    </div>
  );
}
