"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, FileQuestion, Gamepad2, Play, Settings, Home, Palette, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const navLinks = [
  {
    href: "/admin",
    labelKey: "nav.quizzes",
    icon: FileQuestion,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    descriptionKey: "nav.quizzes",
  },
  {
    href: "/admin/games",
    labelKey: "nav.games",
    icon: Gamepad2,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    descriptionKey: "nav.games",
  },
  {
    href: "/host",
    labelKey: "nav.host",
    icon: Play,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    descriptionKey: "nav.host",
  },
  {
    href: "/admin/themes",
    labelKey: "nav.themes",
    icon: Palette,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    descriptionKey: "nav.themes",
  },
  {
    href: "/admin/settings",
    labelKey: "nav.settings",
    icon: Settings,
    color: "text-orange-600",
    bgColor: "bg-orange-600/10",
    descriptionKey: "nav.settings",
  },
];

export function NavHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslation();

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // proceed to redirect even if the call failed
    }
    window.location.href = "/admin/login";
  }

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname.startsWith("/admin/quiz");
    }
    if (href === "/host") {
      return pathname === "/host";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="border-b bg-background/80 backdrop-blur-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo - links to home */}
        <Link href="/" className="group flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Home className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xl font-bold gradient-text group-hover:opacity-80 transition-opacity">
            Quiz0r
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className={cn("w-4 h-4", active ? "text-primary" : link.color)} />
                {t(link.labelKey)}
              </Link>
            );
          })}
          <div className="h-6 w-px bg-border mx-2" />
          <DarkModeToggle showLabel={false} />
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            disabled={loggingOut}
            aria-label={t("nav.logout") || "Logout"}
            title={t("nav.logout") || "Logout"}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </nav>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSelector />
          <DarkModeToggle showLabel={false} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            className="relative"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background/95 backdrop-blur-lg animate-in slide-in-from-top-2 duration-200">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                    active ? "bg-primary/10" : "hover:bg-muted"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className={cn("p-2 rounded-lg", link.bgColor)}>
                    <Icon className={cn("w-5 h-5", link.color)} />
                  </div>
                  <div className="flex-1">
                    <div className={cn("font-medium", active ? "text-primary" : "text-foreground")}>
                      {t(link.labelKey)}
                    </div>
                    <div className="text-xs text-muted-foreground">{t(link.labelKey)}</div>
                  </div>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 px-3 py-3 rounded-lg transition-colors hover:bg-muted"
            >
              <div className="p-2 rounded-lg bg-muted">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-foreground">
                  {t("nav.logout") || "Logout"}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
