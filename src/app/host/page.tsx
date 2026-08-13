"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Monitor, Loader2 } from "lucide-react";
import { NavHeader } from "@/components/nav-header";
import { useTranslation } from "@/hooks/useTranslation";

interface Quiz {
  id: string;
  title: string;
  questionCount: number;
}

function HostPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedQuizId = searchParams.get("quizId");
  const { t } = useTranslation();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(preselectedQuizId || "");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchQuizzes();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchQuizzes() {
    try {
      const res = await fetch("/api/quizzes");
      if (res.ok) {
        const data = await res.json();
        // Filter to only quizzes with questions
        const withQuestions = data.filter(
          (q: Quiz) => q.questionCount > 0
        );
        setQuizzes(withQuestions);

        // Auto-select if preselected
        if (preselectedQuizId && withQuestions.some((q: Quiz) => q.id === preselectedQuizId)) {
          setSelectedQuizId(preselectedQuizId);
        }
      }
    } catch (err) {
      console.error("Failed to fetch quizzes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function createGame() {
    if (!selectedQuizId) return;

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: selectedQuizId }),
      });

      if (res.ok) {
        const game = await res.json();
        // Open windows synchronously to avoid popup blockers
        const monitorWin = window.open(
          "",
          "quiz-playermonitor",
          "width=1400,height=900"
        );
        monitorWin?.location.replace(`/host/${game.gameCode}/playermonitor`);

        const displayWin = window.open(
          "",
          "quiz-display",
          "width=1280,height=720"
        );
        displayWin?.location.replace(`/host/${game.gameCode}/display`);
        // Navigate to control panel
        router.push(`/host/${game.gameCode}/control`);
      } else {
        const data = await res.json();
        setError(data.error || t("errors.failedToCreateGame"));
      }
    } catch {
      setError(t("errors.failedToCreateGame"));
    } finally {
      setCreating(false);
    }
  }

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId);

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            {t("host.hostAGame")}
          </CardTitle>
          <CardDescription>
            {t("host.hostAGameDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-muted-foreground">{t("host.loadingQuizzes")}</p>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                {t("host.noQuizzesAvailable")}
              </p>
              <Link href="/admin/quiz/new">
                <Button>{t("admin.createQuiz")}</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("host.selectQuiz")}</label>
                <Select
                  value={selectedQuizId}
                  onValueChange={setSelectedQuizId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("host.chooseQuiz")} />
                  </SelectTrigger>
                  <SelectContent>
                    {quizzes.map((quiz) => (
                      <SelectItem key={quiz.id} value={quiz.id}>
                        {quiz.title} ({t("host.questionsCount", { count: quiz.questionCount })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedQuiz && (
                <div className="p-4 bg-muted rounded-lg">
                  <h3 className="font-medium">{selectedQuiz.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedQuiz.questionCount === 1
                      ? t("host.questionCountOne", { count: selectedQuiz.questionCount })
                      : t("host.questionsCount", { count: selectedQuiz.questionCount })}
                  </p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex flex-col gap-4">
                <Button
                  onClick={createGame}
                  disabled={!selectedQuizId || creating}
                  size="lg"
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {creating ? t("host.creatingGame") : t("host.startGame")}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {t("host.twoWindowsNote")}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function HostPage() {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
      >
        <HostPageContent />
      </Suspense>
    </div>
  );
}
