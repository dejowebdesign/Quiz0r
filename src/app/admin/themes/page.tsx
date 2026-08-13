"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ThemePreviewMini } from "@/components/admin/ThemePreview";
import { DEFAULT_THEME } from "@/types/theme";
import { THEME_PRESETS, PRESET_LIST } from "@/lib/theme-presets";
import { parseTheme } from "@/lib/theme";
import { Loader2, Palette, Plus, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

interface ThemeRecord {
  id: string;
  name: string;
  description: string | null;
  theme: string;
}

export default function ThemeLibraryPage() {
  const { t } = useTranslation();
  const [customThemes, setCustomThemes] = useState<ThemeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [themeToDelete, setThemeToDelete] = useState<ThemeRecord | null>(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  async function fetchThemes() {
    setLoading(true);
    try {
      const res = await fetch("/api/themes");
      if (res.ok) {
        const data = await res.json();
        setCustomThemes(data.themes || []);
      }
    } catch (err) {
      console.error("Failed to load themes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTheme() {
    if (!themeToDelete) return;

    setDeletingId(themeToDelete.id);
    try {
      const res = await fetch(`/api/themes/${themeToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setCustomThemes((prev) => prev.filter((t) => t.id !== themeToDelete.id));
        setThemeToDelete(null);
      }
    } catch (err) {
      console.error("Failed to delete theme:", err);
    } finally {
      setDeletingId(null);
    }
  }

  const builtInThemes = [
    { id: "default", name: t("themes.defaultName"), description: t("themes.defaultDesc"), theme: DEFAULT_THEME },
    ...PRESET_LIST.map((preset) => ({
      id: preset.id,
      name: preset.name,
      description: preset.description,
      theme: THEME_PRESETS[preset.id],
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6" />
            {t("themes.library")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("themes.libraryDesc")}
          </p>
        </div>
        <Link href="/admin/themes/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            {t("themes.create")}
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("themes.builtIn")}</CardTitle>
            <CardDescription>{t("themes.builtInDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {builtInThemes.map((theme) => (
              <div
                key={theme.id}
                className="rounded-lg border p-3 flex flex-col gap-2 bg-muted/40"
              >
                <ThemePreviewMini theme={theme.theme} />
                <div>
                  <p className="font-medium">{theme.name}</p>
                  <p className="text-xs text-muted-foreground">{theme.description}</p>
                </div>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("themes.builtInTag")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("themes.custom")}</CardTitle>
            <CardDescription>
              {t("themes.customDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {t("themes.loading")}
              </div>
            ) : customThemes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                {t("themes.noCustom")}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {customThemes.map((theme) => {
                  const parsed = parseTheme(theme.theme);
                  const preview = parsed || DEFAULT_THEME;
                  return (
                    <div
                      key={theme.id}
                      className={cn(
                        "rounded-lg border p-3 flex flex-col gap-2",
                        deletingId === theme.id && "opacity-60 pointer-events-none"
                      )}
                    >
                      <ThemePreviewMini theme={preview} />
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{theme.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {theme.description || t("themes.customFallback")}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/admin/themes/${theme.id}`}>
                            <Button variant="outline" size="icon">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setThemeToDelete(theme)}
                            disabled={!!deletingId}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!themeToDelete} onOpenChange={(open) => !open && setThemeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("themes.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("themes.deleteDesc", { name: themeToDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>{t("themes.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTheme}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingId}
            >
              {deletingId ? t("themes.deleting") : t("themes.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
