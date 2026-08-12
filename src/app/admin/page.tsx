"use client";

import { useEffect, useState } from "react";
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
import {
  Plus,
  Pencil,
  Trash2,
  Play,
  Upload,
  Loader2,
  FileArchive,
  Palette,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SupportedLanguages, type LanguageCode } from "@/types";

const LanguageMap = SupportedLanguages as Record<
  LanguageCode,
  { code: string; name: string; flag: string; nativeName: string }
>;

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  aiGenerated?: boolean;
  translationLanguages?: LanguageCode[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [hasUnsplashKey, setHasUnsplashKey] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [quizToDelete, setQuizToDelete] = useState<Quiz | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [aiSectionCount, setAiSectionCount] = useState(2);
  const [aiNotes, setAiNotes] = useState("");
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiCreating, setAiCreating] = useState(false);
  const [aiCreatedQuizId, setAiCreatedQuizId] = useState<string | null>(null);
  const [aiCreatedTitle, setAiCreatedTitle] = useState<string | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [settingsRes, aiRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/settings/ai"),
        ]);
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setHasUnsplashKey(!!data.hasUnsplashApiKey);
        }
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          // Server-side check: is the selected provider configured/available?
          // Works for OpenAI, FreeLLMAPI, OpenRouter, Ollama, LM Studio, Custom.
          setAiAvailable(!!aiData.available);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    }

    loadSettings();
  }, []);

  async function fetchQuizzes() {
    try {
      const res = await fetch("/api/quizzes");
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data);
      }
    } catch (error) {
      console.error("Failed to fetch quizzes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteQuiz() {
    if (!quizToDelete) return;
    setDeletingQuizId(quizToDelete.id);

    try {
      const res = await fetch(`/api/quizzes/${quizToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizToDelete.id));
        setQuizToDelete(null);
      }
    } catch (error) {
      console.error("Failed to delete quiz:", error);
    } finally {
      setDeletingQuizId(null);
    }
  }

  function resetAiDialog() {
    setAiStatus(null);
    setAiProgress(0);
    setAiError(null);
    setAiCreating(false);
    setAiCreatedQuizId(null);
    setAiCreatedTitle(null);
  }

  function resetImportDialog() {
    setSelectedFile(null);
    setImportError(null);
  }

  async function handleImport(file: File) {
    if (!file) {
      setImportError("Please choose a .zip file to import");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/quizzes/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(data.message || "Quiz imported");
        // Refresh the quiz list
        await fetchQuizzes();
        setImportDialogOpen(false);
        resetImportDialog();
      } else {
        setImportError(data.error || "Failed to import quiz");
        toast.error("Failed to import quiz", {
          description: data.error,
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportError("Something went wrong while importing the quiz.");
      toast.error("Failed to import quiz");
    } finally {
      setImporting(false);
    }
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAiError(null);

    if (!aiTopic.trim()) {
      setAiError("Please add a topic or theme for the quiz.");
      return;
    }

    if (aiQuestionCount < 3) {
      setAiError("Please request at least 3 questions.");
      return;
    }

    if (aiSectionCount < 0 || aiSectionCount > aiQuestionCount) {
      setAiError("Section count must be between 0 and the number of questions.");
      return;
    }

    setAiCreating(true);
    setAiStatus("Preparing your AI prompt...");
    setAiProgress(15);
    setAiCreatedQuizId(null);
    setAiCreatedTitle(null);

    try {
      setAiStatus("Asking OpenAI to draft your quiz...");
      setAiProgress(45);

      const res = await fetch("/api/quizzes/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          difficulty: aiDifficulty,
          questionCount: aiQuestionCount,
          sectionCount: aiSectionCount,
          additionalNotes: aiNotes.trim(),
        }),
      });

      setAiStatus("Saving quiz to your library...");
      setAiProgress(75);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create quiz with AI");
      }

      setAiStatus("Quiz created by AI. Review answers carefully.");
      setAiProgress(100);
      setAiCreatedQuizId(data.quizId);
      setAiCreatedTitle(data.quizTitle);

      toast.success("AI quiz ready", {
        description:
          "Review hints, answers, and host notes before hosting.",
      });
      await fetchQuizzes();
    } catch (error) {
      console.error("AI generation error:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : "Failed to generate quiz with AI"
      );
      setAiStatus(null);
      setAiProgress(0);
    } finally {
      setAiCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading quizzes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quizzes</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your quiz collection
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/admin/themes">
            <Button variant="outline">
              <Palette className="w-4 h-4 mr-2" />
              Manage Themes
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Quiz
          </Button>
          {aiAvailable ? (
            <Button
              variant="secondary"
              onClick={() => {
                resetAiDialog();
                setAiDialogOpen(true);
              }}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Create Quiz using AI
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" disabled className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Create Quiz using AI
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Configure an AI provider in Settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Link href="/admin/quiz/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Quiz
            </Button>
          </Link>
        </div>
      </div>

      <Dialog
        open={aiDialogOpen}
        onOpenChange={(open) => {
          setAiDialogOpen(open);
          if (!open) resetAiDialog();
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          <form onSubmit={handleAiSubmit} className="space-y-6">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Create Quiz using AI
              </DialogTitle>
            <DialogDescription className="text-sm">
              Share what you need and we will draft the quiz in English with
              hints, host notes, and suggested images where relevant. Review
              the result carefully before hosting.
              {!hasUnsplashKey && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <span>
                    Add an Unsplash access key in Settings to let AI include real images automatically.
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="aiTopic">Topic or theme</Label>
                <Input
                  id="aiTopic"
                  placeholder="e.g., Space exploration history"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  disabled={aiCreating}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiQuestionCount">Number of questions</Label>
                <Input
                  id="aiQuestionCount"
                  type="number"
                  min={3}
                  max={25}
                  value={aiQuestionCount}
                  onChange={(e) => setAiQuestionCount(Number(e.target.value))}
                  disabled={aiCreating}
                />
                <p className="text-xs text-muted-foreground">
                  We will balance answers, hints, and host notes automatically.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiSectionCount">Number of sections</Label>
                <Input
                  id="aiSectionCount"
                  type="number"
                  min={0}
                  max={aiQuestionCount}
                  value={aiSectionCount}
                  onChange={(e) => setAiSectionCount(Number(e.target.value))}
                  disabled={aiCreating}
                />
                <p className="text-xs text-muted-foreground">
                  Sections act as grouped intros; they&apos;ll include optional images.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiDifficulty">Difficulty</Label>
                <Select
                  value={aiDifficulty}
                  onValueChange={setAiDifficulty}
                  disabled={aiCreating}
                >
                  <SelectTrigger id="aiDifficulty">
                    <SelectValue placeholder="Choose difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="aiNotes">Any extra details?</Label>
                <Textarea
                  id="aiNotes"
                  placeholder="Tone, target audience, must-cover facts, or imagery guidance (English only)."
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  rows={3}
                  disabled={aiCreating}
                />
                <p className="text-xs text-muted-foreground">
                  AI will return English-only content with hints, host notes, and images when useful.
                </p>
              </div>
            </div>

            {(aiStatus || aiCreating || aiCreatedQuizId) && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>{aiStatus || "Ready when you are"}</span>
                    </div>
                    {aiProgress > 0 && (
                      <span className="text-muted-foreground">{aiProgress}%</span>
                    )}
                  </div>
                  <Progress value={aiProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll assemble questions, hints, host notes, and images. Everything stays in English and should be reviewed before use.
                  </p>
                </div>

                {aiCreatedQuizId && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Quiz created by AI
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Review every answer, hint, and host note before hosting.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setAiDialogOpen(false);
                          router.push(`/admin/quiz/${aiCreatedQuizId}/questions`);
                        }}
                      >
                        Open quiz
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAiDialogOpen(false)}
                      >
                        Close
                      </Button>
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1"
                      >
                        <Wand2 className="w-3 h-3" />
                        AI created
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {aiError && (
              <p className="text-sm text-destructive" role="status">
                {aiError}
              </p>
            )}

            {!aiCreatedQuizId && (
              <DialogFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAiDialogOpen(false);
                      resetAiDialog();
                    }}
                    disabled={aiCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={aiCreating}>
                    {aiCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        Create with AI
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            )}
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) resetImportDialog();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Import Quiz</DialogTitle>
            <DialogDescription>
              Upload a quiz export (.zip) to add it to your collection. Images
              and translations are imported automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <FileArchive className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">Need the export?</p>
                <p>
                  Use the Export button inside a quiz to download a .zip that
                  includes questions, sections, images, and translations.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quizImportFile">Quiz export (.zip)</Label>
              <Input
                id="quizImportFile"
                type="file"
                accept=".zip"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  setImportError(null);
                }}
                disabled={importing}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  {selectedFile.name} • {(selectedFile.size / 1024).toFixed(1)}{" "}
                  KB
                </p>
              )}
              {importError && (
                <p className="text-sm text-destructive">{importError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedFile && handleImport(selectedFile)}
              disabled={!selectedFile || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Quiz
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Grid */}
      {quizzes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">No quizzes yet</p>
            <Link href="/admin/quiz/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Quiz
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="group">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="truncate">{quiz.title}</span>
                  {quiz.aiGenerated && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 text-primary border-primary/40"
                    >
                      <Sparkles className="w-3 h-3" />
                      AI
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {quiz.questionCount} question
                  {quiz.questionCount !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quiz.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {quiz.description}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {quiz.translationLanguages?.length ? "Translated" : "English only"}
                  </Badge>
                  {quiz.translationLanguages?.slice(0, 4).map((langCode) => {
                    const language = LanguageMap[langCode as LanguageCode];
                    if (!language) {
                      return (
                        <Badge key={langCode} variant="outline" className="flex items-center gap-1">
                          <span>{langCode.toUpperCase()}</span>
                          <span className="hidden sm:inline text-xs">{langCode.toUpperCase()}</span>
                        </Badge>
                      );
                    }

                    const flag = language.flag;
                    const label = language.nativeName ?? language.name;
                    return (
                      <Badge key={langCode} variant="outline" className="flex items-center gap-1">
                        <span>{flag}</span>
                        <span className="hidden sm:inline text-xs">{label}</span>
                      </Badge>
                    );
                  })}
                  {quiz.translationLanguages && quiz.translationLanguages.length > 4 && (
                    <span className="text-xs text-muted-foreground">
                      +{quiz.translationLanguages.length - 4} more
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/quiz/${quiz.id}/questions`}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Pencil className="w-3 h-3 mr-2" />
                      Edit
                    </Button>
                  </Link>
                  <Link href={`/host?quizId=${quiz.id}`}>
                    <Button
                      size="sm"
                      disabled={quiz.questionCount === 0}
                      title={
                        quiz.questionCount === 0
                          ? "Add questions first"
                          : "Start game"
                      }
                    >
                      <Play className="w-3 h-3 mr-2" />
                      Play
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuizToDelete(quiz)}
                    className="text-destructive hover:text-destructive"
                    disabled={deletingQuizId === quiz.id}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!quizToDelete} onOpenChange={(open) => !open && setQuizToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{quizToDelete?.title}</strong> and all of its questions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingQuizId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuiz}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingQuizId}
            >
              {deletingQuizId ? "Deleting..." : "Delete Quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
