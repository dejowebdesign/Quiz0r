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
import { useTranslation } from "@/hooks/useTranslation";

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
  const { t } = useTranslation();
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
      setImportError(t("admin.pleaseChooseZip"));
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
        toast.success(data.message || t("admin.quizImported"));
        // Refresh the quiz list
        await fetchQuizzes();
        setImportDialogOpen(false);
        resetImportDialog();
      } else {
        setImportError(data.error || t("admin.failedToImportQuiz"));
        toast.error(t("admin.failedToImportQuiz"), {
          description: data.error,
        });
      }
    } catch (error) {
      console.error("Import error:", error);
      setImportError(t("admin.importError"));
      toast.error(t("admin.failedToImportQuiz"));
    } finally {
      setImporting(false);
    }
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAiError(null);

    if (!aiTopic.trim()) {
      setAiError(t("admin.pleaseAddTopic"));
      return;
    }

    if (aiQuestionCount < 3) {
      setAiError(t("admin.pleaseRequestThree"));
      return;
    }

    if (aiSectionCount < 0 || aiSectionCount > aiQuestionCount) {
      setAiError(t("admin.sectionCountRange"));
      return;
    }

    setAiCreating(true);
    setAiStatus(t("admin.preparingPrompt"));
    setAiProgress(15);
    setAiCreatedQuizId(null);
    setAiCreatedTitle(null);

    try {
      setAiStatus(t("admin.askingAi"));
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

      setAiStatus(t("admin.savingQuiz"));
      setAiProgress(75);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || t("admin.failedToCreateWithAi"));
      }

      setAiStatus(t("admin.quizCreatedByAi"));
      setAiProgress(100);
      setAiCreatedQuizId(data.quizId);
      setAiCreatedTitle(data.quizTitle);

      toast.success(t("admin.aiQuizReady"), {
        description: t("admin.reviewBeforeHosting"),
      });
      await fetchQuizzes();
    } catch (error) {
      console.error("AI generation error:", error);
      setAiError(
        error instanceof Error
          ? error.message
          : t("admin.failedToGenerateWithAi")
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
        <div className="text-muted-foreground">{t("admin.loadingQuizzes")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("admin.quizzes")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("admin.quizzesDescription")}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/admin/themes">
            <Button variant="outline">
              <Palette className="w-4 h-4 mr-2" />
              {t("admin.manageThemes")}
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            {t("admin.importQuiz")}
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
              {t("admin.createQuizUsingAi")}
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
                {t("admin.createQuizUsingAi")}
              </DialogTitle>
            <DialogDescription className="text-sm">
              {t("admin.aiDialogDescription")}
              {!hasUnsplashKey && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                  <span>
                    {t("admin.unsplashHint")}
                  </span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="aiTopic">{t("admin.topicOrTheme")}</Label>
                <Input
                  id="aiTopic"
                  placeholder={t("admin.topicPlaceholder")}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  disabled={aiCreating}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiQuestionCount">{t("admin.numberOfQuestions")}</Label>
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
                  {t("admin.questionsHelp")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiSectionCount">{t("admin.numberOfSections")}</Label>
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
                  {t("admin.sectionsHelp")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiDifficulty">{t("admin.difficulty")}</Label>
                <Select
                  value={aiDifficulty}
                  onValueChange={setAiDifficulty}
                  disabled={aiCreating}
                >
                  <SelectTrigger id="aiDifficulty">
                    <SelectValue placeholder={t("admin.chooseDifficulty")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">{t("admin.easy")}</SelectItem>
                    <SelectItem value="medium">{t("admin.medium")}</SelectItem>
                    <SelectItem value="hard">{t("admin.hard")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="aiNotes">{t("admin.anyExtraDetails")}</Label>
                <Textarea
                  id="aiNotes"
                  placeholder={t("admin.extraDetailsPlaceholder")}
                  value={aiNotes}
                  onChange={(e) => setAiNotes(e.target.value)}
                  rows={3}
                  disabled={aiCreating}
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin.extraDetailsHelp")}
                </p>
              </div>
            </div>

            {(aiStatus || aiCreating || aiCreatedQuizId) && (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span>{aiStatus || t("admin.readyWhenYouAre")}</span>
                    </div>
                    {aiProgress > 0 && (
                      <span className="text-muted-foreground">{aiProgress}%</span>
                    )}
                  </div>
                  <Progress value={aiProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("admin.aiAssembling")}
                  </p>
                </div>

                {aiCreatedQuizId && (
                  <div className="rounded-md border border-primary/40 bg-primary/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Sparkles className="w-4 h-4 text-primary" />
                      {t("admin.quizCreatedByAiShort")}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.reviewEveryAnswer")}
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
                        {t("admin.viewQuiz")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAiDialogOpen(false)}
                      >
                        {t("common.close")}
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
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={aiCreating}>
                    {aiCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("login.creating")}
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        {t("admin.createWithAi")}
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
            <DialogTitle>{t("admin.importQuiz")}</DialogTitle>
            <DialogDescription>
              {t("admin.importDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <FileArchive className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">{t("admin.needExport")}</p>
                <p>
                  {t("admin.importHelpText")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quizImportFile">{t("admin.quizExportZip")}</Label>
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
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => selectedFile && handleImport(selectedFile)}
              disabled={!selectedFile || importing}
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("admin.importing")}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("admin.importQuiz")}
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
            <p className="text-muted-foreground mb-4">{t("admin.noQuizzesYet")}</p>
            <Link href="/admin/quiz/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                {t("admin.createQuiz")}
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
                  {quiz.questionCount}{" "}
                  {quiz.questionCount === 1 ? t("admin.questionsOne") : t("admin.questionsOther")}
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
                    {quiz.translationLanguages?.length ? t("admin.translated") : t("admin.englishOnly")}
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
                      {t("admin.more", { count: quiz.translationLanguages.length - 4 })}
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
                      {t("admin.edit")}
                    </Button>
                  </Link>
                  <Link href={`/host?quizId=${quiz.id}`}>
                    <Button
                      size="sm"
                      disabled={quiz.questionCount === 0}
                      title={
                        quiz.questionCount === 0
                          ? t("admin.addQuestionsFirst")
                          : t("admin.startGame")
                      }
                    >
                      <Play className="w-3 h-3 mr-2" />
                      {t("admin.play")}
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
            <AlertDialogTitle>{t("admin.deleteThisQuiz")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.deleteConfirm", { title: quizToDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingQuizId}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuiz}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!deletingQuizId}
            >
              {deletingQuizId ? t("admin.deleting") : t("admin.deleteQuiz")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
