"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemePreview, ThemePreviewMini } from "@/components/admin/ThemePreview";
import { DEFAULT_THEME, QuizTheme } from "@/types/theme";
import { parseTheme, stringifyTheme } from "@/lib/theme";
import { PRESET_LIST, THEME_PRESETS } from "@/lib/theme-presets";
import { ArrowLeft, Check, Loader2, Palette, Plus } from "lucide-react";

interface Props {
  params: Promise<{ quizId: string }>;
}

interface ThemeRecord {
  id: string;
  name: string;
  description: string | null;
  theme: string;
}

type ThemeOption = {
  id: string;
  name: string;
  description: string;
  source: "none" | "builtin" | "custom";
  themeJson: string | null;
  preview: QuizTheme;
};

export default function QuizThemeApplyPage({ params }: Props) {
  const { quizId } = use(params);
  const router = useRouter();

  const [quizTitle, setQuizTitle] = useState("");
  const [currentThemeJson, setCurrentThemeJson] = useState<string | null>(null);
  const [customThemes, setCustomThemes] = useState<ThemeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("none");

  useEffect(() => {
    async function loadData() {
      try {
        const [quizRes, themeRes] = await Promise.all([
          fetch(`/api/quizzes/${quizId}/theme`),
          fetch("/api/themes"),
        ]);

        if (quizRes.ok) {
          const data = await quizRes.json();
          setQuizTitle(data.title);
          setCurrentThemeJson(data.theme);
        }

        if (themeRes.ok) {
          const data = await themeRes.json();
          setCustomThemes(data.themes || []);
        }
      } catch (err) {
        console.error("Failed to load theme data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [quizId]);

  const options: ThemeOption[] = useMemo(() => {
    const base: ThemeOption[] = [
      {
        id: "none",
        name: "Use default",
        description: "Fallback styling of the app",
        source: "none",
        themeJson: null,
        preview: DEFAULT_THEME,
      },
      {
        id: "default",
        name: "Default theme",
        description: "App base styling",
        source: "builtin",
        themeJson: stringifyTheme(DEFAULT_THEME),
        preview: DEFAULT_THEME,
      },
      ...PRESET_LIST.map((preset) => ({
        id: `builtin-${preset.id}`,
        name: preset.name,
        description: preset.description,
        source: "builtin" as const,
        themeJson: stringifyTheme(THEME_PRESETS[preset.id]),
        preview: THEME_PRESETS[preset.id],
      })),
      ...customThemes.map((theme) => ({
        id: theme.id,
        name: theme.name,
        description: theme.description || "Custom theme",
        source: "custom" as const,
        themeJson: theme.theme,
        preview: parseTheme(theme.theme) || DEFAULT_THEME,
      })),
    ];

    if (currentThemeJson) {
      const match = base.find((opt) => opt.themeJson === currentThemeJson);
      if (!match) {
        const parsed = parseTheme(currentThemeJson);
        base.push({
          id: "custom-current",
          name: parsed?.name || "Current theme",
          description: "Currently applied to this quiz",
          source: "custom",
          themeJson: currentThemeJson,
          preview: parsed || DEFAULT_THEME,
        });
      }
    }

    return base;
  }, [customThemes, currentThemeJson]);

  useEffect(() => {
    if (!currentThemeJson) {
      setSelectedId("none");
      return;
    }

    const matching = options.find((opt) => opt.themeJson === currentThemeJson);
    setSelectedId(matching ? matching.id : "custom-current");
  }, [currentThemeJson, options]);

  const selectedOption = options.find((opt) => opt.id === selectedId) || options[0];

  const applyTheme = async () => {
    if (!selectedOption) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/theme`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: selectedOption.themeJson }),
      });

      if (res.ok) {
        router.push(`/admin/quiz/${quizId}/questions`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to apply theme");
      }
    } catch (err) {
      console.error("Failed to apply theme:", err);
      setError("Failed to apply theme");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/admin/quiz/${quizId}/questions`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Apply Theme
              </h1>
              <p className="text-sm text-muted-foreground">{quizTitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/themes">
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Manage Themes
              </Button>
            </Link>
            <Button onClick={applyTheme} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Apply Theme
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select a Theme</CardTitle>
                <CardDescription>
                  Choose from built-in presets or your saved custom themes
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedId(option.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      selectedId === option.id ? "border-primary shadow-sm" : "hover:border-primary"
                    }`}
                  >
                    <ThemePreviewMini theme={option.preview} />
                    <p className="font-medium mt-2">{option.name}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {option.description}
                    </p>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1">
                      {option.source === "builtin" ? "Built-in" : option.source === "custom" ? "Custom" : "Default"}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
            {error && (
              <p className="text-sm text-destructive px-2">{error}</p>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Preview</h2>
            <ThemePreview theme={selectedOption?.preview || DEFAULT_THEME} />
            <p className="text-sm text-muted-foreground">
              {selectedOption?.preview
                ? `Previewing: ${selectedOption.preview.name}`
                : "Using default theme"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
