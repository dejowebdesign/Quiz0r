"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { LanguageSelector } from "@/components/ui/language-selector";
import { FileQuestion, Gamepad2, Play, Settings, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function MenuPage() {
  const { t } = useTranslation();
  const menuItems = [
    {
      title: t("menu.quizzes"),
      description: t("menu.quizzesDesc"),
      icon: FileQuestion,
      href: "/admin",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: t("menu.games"),
      description: t("menu.gamesDesc"),
      icon: Gamepad2,
      href: "/admin/games",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      title: t("menu.host"),
      description: t("menu.hostDesc"),
      icon: Play,
      href: "/host",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      title: t("menu.settings"),
      description: t("menu.settingsDesc"),
      icon: Settings,
      href: "/admin/settings",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  ];

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Dark mode toggle + language selector in top-right */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <LanguageSelector className="w-[140px]" />
        <DarkModeToggle showLabel={false} />
      </div>

      {/* Back button */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-50 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("common.back")}
      </Link>

      {/* Gradient background - warm colors */}
      <div className="gradient-bg" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 gradient-text title-glow fade-in-up">
            Quiz0r
          </h1>
          <p className="text-muted-foreground text-center mb-10 fade-in-up-delay-1">
            {t("menu.title")}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 fade-in-up-delay-2">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="h-full feature-card cursor-pointer group border-border/50 hover:border-primary/30">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${item.bgColor} group-hover:scale-110 transition-transform`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                        {item.title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
