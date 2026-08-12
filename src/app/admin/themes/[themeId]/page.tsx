"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemePreview, ThemePreviewMini } from "@/components/admin/ThemePreview";
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
import { QuizTheme, DEFAULT_THEME } from "@/types/theme";
import { parseTheme, validateThemeJson, stringifyTheme } from "@/lib/theme";
import { THEME_PRESETS, PRESET_LIST } from "@/lib/theme-presets";
import { generateAIPrompt, ThemeWizardAnswers } from "@/lib/theme-template";
import {
  ArrowLeft,
  Palette,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Trash2,
  Wand2,
} from "lucide-react";

interface Props {
  params: Promise<{ themeId: string }>;
}

type TabType = "presets" | "wizard" | "json";

const BUILTIN_THEMES: Record<string, QuizTheme> = {
  default: DEFAULT_THEME,
  ...THEME_PRESETS,
};

function findBuiltinThemeId(themeJson: string | null | undefined): string | null {
  if (!themeJson) return null;

  try {
    const parsed = JSON.parse(themeJson);
    const normalized = JSON.stringify(parsed);

    for (const [key, theme] of Object.entries(BUILTIN_THEMES)) {
      if (JSON.stringify(theme) === normalized) {
        return key;
      }
    }
  } catch {
    // Ignore parsing errors here; the main validation handles user feedback.
  }

  return null;
}

export default function ThemeBuilderPage({ params }: Props) {
  const { themeId } = use(params);
  const router = useRouter();
  const isNew = themeId === "new";

  const [themeJson, setThemeJson] = useState("");
  const [description, setDescription] = useState("");
  const [previewTheme, setPreviewTheme] = useState<QuizTheme | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("presets");
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [wizardAnswers, setWizardAnswers] = useState<ThemeWizardAnswers>({
    topic: "",
    mood: "",
    colors: "",
    backgroundAnimation: "",
    celebration: "",
  });

  useEffect(() => {
    async function loadTheme() {
      try {
        const res = await fetch(`/api/themes/${themeId}`);
        if (!res.ok) {
          setError("Theme not found");
          return;
        }

        const data = await res.json();
        const t = data.theme;
        setThemeJson(t.theme);
        setDescription(t.description || "");
        const parsed = parseTheme(t.theme);
        setPreviewTheme(parsed);
        setSelectedPresetId(findBuiltinThemeId(t.theme));
      } catch (err) {
        console.error("Failed to load theme:", err);
        setError("Failed to load theme");
      } finally {
        setLoading(false);
      }
    }

    if (!isNew) {
      loadTheme();
    } else {
      setPreviewTheme(null);
    }
  }, [isNew, themeId]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setHasOpenaiKey(!!data.hasOpenaiApiKey);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }

    loadSettings();
  }, []);

  const handleJsonChange = (value: string) => {
    setThemeJson(value);
    setError(null);
    setGenerationError(null);
    setSelectedPresetId(findBuiltinThemeId(value));

    if (!value.trim()) {
      setPreviewTheme(null);
      return;
    }

    const validationError = validateThemeJson(value);
    if (validationError) {
      setError(validationError);
    } else {
      const parsed = parseTheme(value);
      setPreviewTheme(parsed);
    }
  };

  const selectPreset = (presetId: string) => {
    const preset = THEME_PRESETS[presetId];
    if (preset) {
      const json = stringifyTheme(preset);
      setThemeJson(json);
      setPreviewTheme(preset);
      setError(null);
      setGenerationError(null);
      setSelectedPresetId(presetId);
    }
  };

  const copyAIPrompt = async () => {
    const prompt = generateAIPrompt(wizardAnswers);
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateTheme = async () => {
    setGenerationError(null);
    setError(null);
    setGenerating(true);

    try {
      const res = await fetch(`/api/themes/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: wizardAnswers }),
      });

      const data = await res.json();
      if (!res.ok) {
        setGenerationError(data.error || "Failed to generate theme");
        return;
      }

      const generatedJson = data.theme as string;
      const parsed = data.parsedTheme || parseTheme(generatedJson);

      setThemeJson(generatedJson);
      setPreviewTheme(parsed);
      setSelectedPresetId(null);
      setActiveTab("json");
    } catch (err) {
      console.error("Failed to generate theme:", err);
      setGenerationError("Failed to generate theme");
    } finally {
      setGenerating(false);
    }
  };

  const saveDisabled = saving || !!error || !themeJson.trim() || !!selectedPresetId;

  const saveTheme = async () => {
    if (saveDisabled) return;

    setSaving(true);
    setError(null);

    try {
      const endpoint = isNew ? "/api/themes" : `/api/themes/${themeId}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeJson,
          description,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/admin/themes");
      } else {
        setError(data.error || "Failed to save theme");
      }
    } catch (err) {
      console.error("Failed to save theme:", err);
      setError("Failed to save theme");
    } finally {
      setSaving(false);
    }
  };

  const deleteTheme = async () => {
    if (isNew) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/themes/${themeId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/themes");
      }
    } catch (err) {
      console.error("Failed to delete theme:", err);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
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
              href="/admin/themes"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Palette className="w-5 h-5" />
                {isNew ? "Create Theme" : "Edit Theme"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isNew ? "Use the AI wizard or JSON editor to craft a new theme" : "Update or refine this theme for future quizzes"}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              {!isNew && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
              <Button onClick={saveTheme} disabled={saveDisabled}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Theme
              </Button>
            </div>
            {selectedPresetId && (
              <p className="text-xs text-muted-foreground">
                Built-in themes are fixed; customize first or use the AI Wizard.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
                <CardDescription>Optional description for your library</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="theme-description">Description</Label>
                <Input
                  id="theme-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short note about this theme"
                />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant={activeTab === "presets" ? "default" : "outline"}
                onClick={() => setActiveTab("presets")}
                size="sm"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Presets
              </Button>
              <Button
                variant={activeTab === "wizard" ? "default" : "outline"}
                onClick={() => setActiveTab("wizard")}
                size="sm"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                AI Wizard
              </Button>
              <Button
                variant={activeTab === "json" ? "default" : "outline"}
                onClick={() => setActiveTab("json")}
                size="sm"
              >
                JSON
              </Button>
            </div>

            {activeTab === "presets" && (
              <Card>
                <CardHeader>
                  <CardTitle>Theme Presets</CardTitle>
                  <CardDescription>Select a preset as a starting point</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setThemeJson(stringifyTheme(DEFAULT_THEME));
                        setPreviewTheme(DEFAULT_THEME);
                        setError(null);
                        setGenerationError(null);
                        setSelectedPresetId("default");
                      }}
                      className="text-left p-3 rounded-lg border hover:border-primary transition-colors"
                    >
                      <ThemePreviewMini theme={DEFAULT_THEME} />
                      <p className="font-medium mt-2">Default</p>
                      <p className="text-xs text-muted-foreground">
                        App base styling
                      </p>
                    </button>

                    {PRESET_LIST.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => selectPreset(preset.id)}
                        className="text-left p-3 rounded-lg border hover:border-primary transition-colors"
                      >
                        <ThemePreviewMini theme={THEME_PRESETS[preset.id]} />
                        <p className="font-medium mt-2">{preset.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {preset.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "wizard" && (
              <Card>
                <CardHeader>
                  <CardTitle>AI Theme Wizard</CardTitle>
                  <CardDescription>
                    Answer a few questions and generate a theme automatically. If you don&apos;t have an OpenAI key, you can still copy the prompt.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">What is your quiz about?</Label>
                    <Input
                      id="topic"
                      placeholder="e.g., Christmas Trivia, Science Quiz, Movie Night"
                      value={wizardAnswers.topic}
                      onChange={(e) =>
                        setWizardAnswers({ ...wizardAnswers, topic: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mood">What mood do you want?</Label>
                    <Input
                      id="mood"
                      placeholder="e.g., fun and playful, professional, spooky, festive"
                      value={wizardAnswers.mood}
                      onChange={(e) =>
                        setWizardAnswers({ ...wizardAnswers, mood: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="colors">Preferred colors (optional)</Label>
                    <Input
                      id="colors"
                      placeholder="e.g., blues and greens, warm sunset colors, neon"
                      value={wizardAnswers.colors}
                      onChange={(e) =>
                        setWizardAnswers({ ...wizardAnswers, colors: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="background">Background animation</Label>
                    <Input
                      id="background"
                      placeholder="e.g., falling snow, twinkling stars, bubbles, none"
                      value={wizardAnswers.backgroundAnimation}
                      onChange={(e) =>
                        setWizardAnswers({
                          ...wizardAnswers,
                          backgroundAnimation: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="celebration">Celebration effect</Label>
                    <Input
                      id="celebration"
                      placeholder="e.g., confetti, sparkles, fireworks, simple glow"
                      value={wizardAnswers.celebration}
                      onChange={(e) =>
                        setWizardAnswers({
                          ...wizardAnswers,
                          celebration: e.target.value,
                        })
                      }
                    />
                  </div>

                  {hasOpenaiKey ? (
                    <>
                      <Button
                        onClick={generateTheme}
                        disabled={!wizardAnswers.topic || !wizardAnswers.mood || generating}
                        className="w-full"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating Theme...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Generate Theme with AI
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Uses your configured AI provider and API key from Settings.
                      </p>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={copyAIPrompt}
                        disabled={!wizardAnswers.topic || !wizardAnswers.mood}
                        className="w-full"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Prompt for AI
                          </>
                        )}
                      </Button>

                      <div className="text-sm text-muted-foreground space-y-2 pt-2 border-t">
                        <p className="font-medium">Next steps:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Click &quot;Copy Prompt for AI&quot; above</li>
                          <li>Paste into ChatGPT, Claude, or your preferred AI</li>
                          <li>Copy the JSON response from the AI</li>
                          <li>Go to the JSON tab and paste it there</li>
                        </ol>
                        <p className="text-xs">
                          Tip: Configure an AI provider and API key in Settings to generate themes automatically.
                        </p>
                      </div>
                    </>
                  )}

                  {generationError && (
                    <p className="text-sm text-destructive">{generationError}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "json" && (
              <Card>
                <CardHeader>
                  <CardTitle>Theme JSON</CardTitle>
                  <CardDescription>
                    Paste your theme JSON here (from AI or manual editing)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={themeJson}
                    onChange={(e) => handleJsonChange(e.target.value)}
                    placeholder="Paste your theme JSON here..."
                    className="font-mono text-sm min-h-[400px]"
                  />
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Preview</h2>
            <ThemePreview theme={previewTheme} />
            <p className="text-sm text-muted-foreground">
              {previewTheme
                ? `Previewing: ${previewTheme.name}`
                : "Using default theme"}
            </p>
          </div>
        </div>
      </main>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this theme?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this theme from your library. Any quiz using it will fall back to the
              default theme.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteTheme}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Theme"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
