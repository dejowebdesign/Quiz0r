"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Lightbulb,
  Zap,
  Languages,
  Palette,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SupportedLanguages, type LanguageCode } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";

const SOURCE_LANGUAGE_OPTIONS = (Object.keys(SupportedLanguages) as LanguageCode[]).filter(
  (code) => code !== "sr-Cyrl" // Cyrillic is a translation target; source is authored in Latin script or another base
);

export default function NewQuizPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<LanguageCode>("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, sourceLanguage }),
      });

      if (res.ok) {
        const quiz = await res.json();
        router.push(`/admin/quiz/${quiz.id}/questions`);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create quiz");
      }
    } catch {
      setError("Failed to create quiz");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back link */}
      <Link
        href="/admin"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Quizzes
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Create New Quiz</CardTitle>
          <CardDescription>
            Give your quiz a name and description, then add questions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input
                id="title"
                placeholder="e.g., General Knowledge Challenge"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={loading}
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this quiz about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sourceLanguage" className="flex items-center gap-2">
                <Languages className="w-4 h-4" />
                {t("admin.sourceLanguage")}
              </Label>
              <Select
                value={sourceLanguage}
                onValueChange={(value) => setSourceLanguage(value as LanguageCode)}
                disabled={loading}
              >
                <SelectTrigger id="sourceLanguage" className="w-full">
                  <SelectValue placeholder="Select source language" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_LANGUAGE_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {SupportedLanguages[code].flag}{" "}
                      {SupportedLanguages[code].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("admin.sourceLanguageHint")}
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full sm:w-auto"
              >
                {loading ? "Creating..." : "Create & Add Questions"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              <Link href="/admin" className="w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="w-full"
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* What's next section */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary" />
            What happens next?
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                1
              </div>
              <div>
                <p className="font-medium text-sm">Add Questions</p>
                <p className="text-xs text-muted-foreground">
                  Create single or multi-select questions with images
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                2
              </div>
              <div>
                <p className="font-medium text-sm">Configure Power-ups</p>
                <p className="text-xs text-muted-foreground">
                  Enable hints, copy answers, and double points
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                3
              </div>
              <div>
                <p className="font-medium text-sm">Customize Theme</p>
                <p className="text-xs text-muted-foreground">
                  Choose colors, backgrounds, and visual effects
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                4
              </div>
              <div>
                <p className="font-medium text-sm">Host Your Game</p>
                <p className="text-xs text-muted-foreground">
                  Start a session and share the game code
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features preview */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-muted-foreground">Power-ups</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
          <Languages className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-muted-foreground">Multi-language</span>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
          <Palette className="w-4 h-4 text-purple-500" />
          <span className="text-sm text-muted-foreground">Custom themes</span>
        </div>
      </div>
    </div>
  );
}
