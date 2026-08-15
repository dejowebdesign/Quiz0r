"use client";

import { use, useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Check,
  X,
  Sparkles,
  Trash2,
  Languages,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SupportedLanguages, type LanguageCode, type TranslationStatus } from "@/types";
import {
  parseCategoriseData,
  parseMatchingData,
  validateCategoriseData,
  validateMatchingData,
  newLocalId,
  type CategoriseData,
  type MatchingData,
  type CategoriseCategory,
  type CategoriseItem,
  type MatchingPair,
} from "@/lib/question-types";
import { resolveSourceLanguage } from "@/lib/source-language";
import { useTranslation } from "@/hooks/useTranslation";
import { toast } from "sonner";

// New components
import { QuestionListHeader } from "@/components/quiz/questions/QuestionListHeader";
import { QuestionList } from "@/components/quiz/questions/QuestionList";
import { QuizSettingsSidebar } from "@/components/quiz/settings/QuizSettingsSidebar";
import { QuestionEditorDialog } from "@/components/quiz/editor/QuestionEditorDialog";
import { SectionEditorDialog } from "@/components/quiz/editor/SectionEditorDialog";

interface Answer {
  id?: string;
  answerText: string;
  imageUrl?: string | null;
  isCorrect: boolean;
}

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  hostNotes?: string | null;
  hint?: string | null;
  questionType: string;
  timeLimit: number;
  points: number;
  orderIndex: number;
  answers: Answer[];
  categoriseData?: string | null;
  matchingData?: string | null;
}

interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  autoAdmit: boolean;
  hintCount: number;
  copyAnswerCount: number;
  doublePointsCount: number;
  questions: Question[];
  aiGenerated?: boolean;
  sourceLanguage?: string | null;
}

interface SectionGroup {
  section: Question | null;
  questions: Question[];
}

// Group questions by sections for reordering
function groupQuestionsBySections(questions: Question[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  let currentGroup: SectionGroup = {
    section: null,
    questions: [],
  };

  for (const q of questions) {
    if (q.questionType === "SECTION") {
      if (currentGroup.section || currentGroup.questions.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = { section: q, questions: [] };
    } else {
      currentGroup.questions.push(q);
    }
  }
  if (currentGroup.section || currentGroup.questions.length > 0) {
    groups.push(currentGroup);
  }
  return groups;
}

function flattenGroups(groups: SectionGroup[]): Question[] {
  const result: Question[] = [];
  for (const group of groups) {
    if (group.section) {
      result.push(group.section);
    }
    result.push(...group.questions);
  }
  return result;
}

export default function QuestionsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = use(params);
  const { t } = useTranslation();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  // Effective source language of the quiz content. Falls back to the historical
  // base language (English) when the quiz has no explicit sourceLanguage.
  const sourceLanguage: LanguageCode = resolveSourceLanguage(quiz?.sourceLanguage);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false);
  const [editQuizDetailsOpen, setEditQuizDetailsOpen] = useState(false);
  const [quizTitleInput, setQuizTitleInput] = useState("");
  const [quizDescriptionInput, setQuizDescriptionInput] = useState("");
  const [savingQuizDetails, setSavingQuizDetails] = useState(false);
  const [quizDetailsError, setQuizDetailsError] = useState("");

  // Form state
  const [questionText, setQuestionText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [hostNotes, setHostNotes] = useState("");
  const [hint, setHint] = useState("");
  const [questionType, setQuestionType] = useState("SINGLE_SELECT");
  const [timeLimit, setTimeLimit] = useState(30);
  const [points, setPoints] = useState(100);
  const [answers, setAnswers] = useState<Answer[]>([
    { answerText: "", isCorrect: false },
    { answerText: "", isCorrect: false },
    { answerText: "", isCorrect: false },
    { answerText: "", isCorrect: false },
  ]);
  // Structured-content state for CATEGORISE / MATCHING questions.
  const [categoriseData, setCategoriseData] = useState<CategoriseData>({
    categories: [
      { id: newLocalId("cat"), label: "" },
      { id: newLocalId("cat"), label: "" },
    ],
    items: [
      { id: newLocalId("item"), label: "", categoryId: "" },
      { id: newLocalId("item"), label: "", categoryId: "" },
    ],
  });
  const [matchingData, setMatchingData] = useState<MatchingData>({
    pairs: [
      { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
      { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
    ],
  });
  const [easterEggEnabled, setEasterEggEnabled] = useState(false);
  const [easterEggButtonText, setEasterEggButtonText] = useState("Click for a surprise!");
  const [easterEggUrl, setEasterEggUrl] = useState("");
  const [easterEggDisablesScoring, setEasterEggDisablesScoring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Translation state
  const [questionTranslations, setQuestionTranslations] = useState<Record<LanguageCode, any>>({} as Record<LanguageCode, any>);
  const [answerTranslations, setAnswerTranslations] = useState<Record<string, Record<LanguageCode, string>>>({});
  const [activeTranslationTab, setActiveTranslationTab] = useState<string>("en");
  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageCode[]>(["en"]);
  const [savingTranslation, setSavingTranslation] = useState<LanguageCode | null>(null);
  const [autoTranslatingQuestion, setAutoTranslatingQuestion] = useState<LanguageCode | null>(null);

  // Translations dialog state
  const [translationsDialogOpen, setTranslationsDialogOpen] = useState(false);
  const [translationStatuses, setTranslationStatuses] = useState<TranslationStatus[]>([]);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [translatingLanguage, setTranslatingLanguage] = useState<LanguageCode | null>(null);
  const [confirmTranslateLanguage, setConfirmTranslateLanguage] = useState<LanguageCode | null>(null);
  const [translationResult, setTranslationResult] = useState<{
    success: boolean;
    translated?: number;
    failed?: number;
    error?: string;
  } | null>(null);
  const [confirmDeleteLanguage, setConfirmDeleteLanguage] = useState<LanguageCode | null>(null);
  const [deletingLanguage, setDeletingLanguage] = useState<LanguageCode | null>(null);
  const [deleteResult, setDeleteResult] = useState<{ success: boolean; error?: string } | null>(null);

  // Question translation status for individual cards
  const [questionTranslationStatuses, setQuestionTranslationStatuses] = useState<
    Map<
      string,
      {
        status: "complete" | "partial" | "none";
        completeLanguages: LanguageCode[];
        partialLanguages: LanguageCode[];
      }
    >
  >(new Map());
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  useEffect(() => {
    fetchQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  async function fetchQuiz() {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`);
      if (res.ok) {
        const data = await res.json();
        setQuiz(data);
        setQuizTitleInput(data.title || "");
        setQuizDescriptionInput(data.description || "");

        // Compute per-question/section translation status
        const statusMap = new Map<
          string,
          {
            status: "complete" | "partial" | "none";
            completeLanguages: LanguageCode[];
            partialLanguages: LanguageCode[];
          }
        >();

        if (data.questions) {
          for (const question of data.questions) {
            const questionTranslations = question.translations || [];

            // For sections, we only need to check questionText (title) and hostNotes (description)
            if (question.questionType === "SECTION") {
              const langCodes = new Set<LanguageCode>();
              questionTranslations.forEach((t: { languageCode: string }) => {
                if (t.languageCode !== sourceLanguage) langCodes.add(t.languageCode as LanguageCode);
              });

              if (langCodes.size === 0) {
                statusMap.set(question.id, {
                  status: "none",
                  completeLanguages: [],
                  partialLanguages: [],
                });
              } else {
                const completeLangs: LanguageCode[] = [];
                const partialLangs: LanguageCode[] = [];
                let hasPartial = false;

                for (const lang of Array.from(langCodes)) {
                  const hasTitle = questionTranslations.some(
                    (t: { languageCode: string; questionText?: string }) => t.languageCode === lang && t.questionText?.trim()
                  );
                  // Description is optional, so only check if original has description
                  const needsDescription = question.hostNotes?.trim();
                  const hasDescription = !needsDescription || questionTranslations.some(
                    (t: { languageCode: string; hostNotes?: string }) => t.languageCode === lang && t.hostNotes?.trim()
                  );

                  if (hasTitle && hasDescription) {
                    completeLangs.push(lang);
                  } else {
                    partialLangs.push(lang);
                    hasPartial = true;
                  }
                }

                statusMap.set(question.id, {
                  status: hasPartial ? "partial" : "complete",
                  completeLanguages: completeLangs,
                  partialLanguages: partialLangs,
                });
              }
              continue;
            }

            // For regular questions
            const answerTranslations = question.answers?.flatMap((a: { translations?: { languageCode: string }[] }) => a.translations || []) || [];

            // Get all unique language codes from translations
            const langCodes = new Set<LanguageCode>();
            questionTranslations.forEach((t: { languageCode: string }) => {
              if (t.languageCode !== sourceLanguage) langCodes.add(t.languageCode as LanguageCode);
            });
            answerTranslations.forEach((t: { languageCode: string }) => {
              if (t.languageCode !== sourceLanguage) langCodes.add(t.languageCode as LanguageCode);
            });

            if (langCodes.size === 0) {
              statusMap.set(question.id, {
                status: "none",
                completeLanguages: [],
                partialLanguages: [],
              });
            } else {
              // Check if all languages are complete
              const completeLangs: LanguageCode[] = [];
              const partialLangs: LanguageCode[] = [];
              let hasPartial = false;

              for (const lang of Array.from(langCodes)) {
                const hasQuestionText = questionTranslations.some(
                  (t: { languageCode: string; questionText?: string }) => t.languageCode === lang && t.questionText?.trim()
                );
                const answerCount = question.answers?.filter((a: { answerText?: string }) => a.answerText?.trim()).length || 0;
                const translatedAnswerCount = question.answers?.filter((a: { translations?: { languageCode: string; answerText?: string }[] }) =>
                  a.translations?.some((t) => t.languageCode === lang && t.answerText?.trim())
                ).length || 0;

                if (hasQuestionText && translatedAnswerCount >= answerCount) {
                  completeLangs.push(lang);
                } else {
                  partialLangs.push(lang);
                  hasPartial = true;
                }
              }

              statusMap.set(question.id, {
                status: hasPartial ? "partial" : "complete",
                completeLanguages: completeLangs,
                partialLanguages: partialLangs,
              });
            }
          }
        }

        setQuestionTranslationStatuses(statusMap);
      }
    } catch (error) {
      console.error("Failed to fetch quiz:", error);
    } finally {
      setLoading(false);
    }
  }

  function openEditQuizDetails() {
    if (!quiz) return;
    setQuizTitleInput(quiz.title || "");
    setQuizDescriptionInput(quiz.description || "");
    setQuizDetailsError("");
    setEditQuizDetailsOpen(true);
  }

  async function saveQuizDetails() {
    if (!quiz) return;

    const trimmedTitle = quizTitleInput.trim();
    const trimmedDescription = quizDescriptionInput.trim();

    if (!trimmedTitle) {
      setQuizDetailsError("Title is required");
      return;
    }

    setSavingQuizDetails(true);
    setQuizDetailsError("");

    try {
      const res = await fetch(`/api/quizzes/${quiz.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
        }),
      });

      if (res.ok) {
        setQuiz((prev) =>
          prev ? { ...prev, title: trimmedTitle, description: trimmedDescription || null } : prev
        );
        setQuizTitleInput(trimmedTitle);
        setQuizDescriptionInput(trimmedDescription);
        setEditQuizDetailsOpen(false);
        toast.success(t("editor.quizDetailsUpdated"));
      } else {
        const data = await res.json().catch(() => null);
        setQuizDetailsError(data?.error || "Failed to update quiz");
      }
    } catch (error) {
      console.error("Failed to update quiz:", error);
      setQuizDetailsError("Failed to update quiz");
    } finally {
      setSavingQuizDetails(false);
    }
  }

  async function handleExport() {
    if (!quiz) return;

    setExporting(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/export`);

      if (!res.ok) {
        const data = await res.json();
        toast.error("Failed to export quiz", {
          description: data.error,
        });
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quiz.title.replace(/[^a-z0-9_-]/gi, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Quiz exported", {
        description: t("editor.exportDownloaded"),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export quiz");
    } finally {
      setExporting(false);
    }
  }

  function resetForm() {
    setQuestionText("");
    setImageUrl("");
    setHostNotes("");
    setHint("");
    setQuestionType("SINGLE_SELECT");
    setTimeLimit(30);
    setPoints(100);
    setAnswers([
      { answerText: "", isCorrect: false },
      { answerText: "", isCorrect: false },
      { answerText: "", isCorrect: false },
      { answerText: "", isCorrect: false },
    ]);
    setCategoriseData({
      categories: [
        { id: newLocalId("cat"), label: "" },
        { id: newLocalId("cat"), label: "" },
      ],
      items: [
        { id: newLocalId("item"), label: "", categoryId: "" },
        { id: newLocalId("item"), label: "", categoryId: "" },
      ],
    });
    setMatchingData({
      pairs: [
        { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
        { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
      ],
    });
    setEasterEggEnabled(false);
    setEasterEggButtonText("Click for a surprise!");
    setEasterEggUrl("");
    setEasterEggDisablesScoring(false);
    setEditingQuestion(null);
    setQuestionTranslations({} as Record<LanguageCode, any>);
    setAnswerTranslations({});
    setActiveTranslationTab(sourceLanguage);
    setAvailableTranslationLanguages([sourceLanguage]);
  }

  async function fetchTranslationStatus() {
    setLoadingTranslations(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/translations`);
      if (res.ok) {
        const data = await res.json();
        setTranslationStatuses(data.statuses || []);
      }
    } catch (error) {
      console.error("Failed to fetch translation status:", error);
    } finally {
      setLoadingTranslations(false);
    }
  }

  function handleTranslateQuiz(targetLanguage: LanguageCode) {
    setConfirmTranslateLanguage(targetLanguage);
  }

  async function executeTranslateQuiz() {
    if (!confirmTranslateLanguage) return;

    const targetLanguage = confirmTranslateLanguage;
    setConfirmTranslateLanguage(null);
    setTranslatingLanguage(targetLanguage);
    setTranslationResult(null);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage }),
      });

      const data = await res.json();

      if (res.ok) {
        setTranslationResult({
          success: true,
          translated: data.translated || 0,
          failed: data.failed || 0,
        });
        await fetchTranslationStatus();
      } else {
        setTranslationResult({
          success: false,
          error: data.error || t("editor.translationFailed"),
        });
      }
    } catch (error) {
      console.error("Translation error:", error);
      setTranslationResult({
        success: false,
        error: t("editor.failedToTranslateQuiz"),
      });
    }
  }

  function closeTranslationProgress() {
    setTranslatingLanguage(null);
    setTranslationResult(null);
  }

  function handleDeleteLanguage(targetLanguage: LanguageCode) {
    setConfirmDeleteLanguage(targetLanguage);
  }

  async function executeDeleteLanguage() {
    if (!confirmDeleteLanguage) return;

    const targetLanguage = confirmDeleteLanguage;
    setConfirmDeleteLanguage(null);
    setDeletingLanguage(targetLanguage);
    setDeleteResult(null);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/translations/${targetLanguage}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteResult({ success: true });
        await fetchTranslationStatus();
      } else {
        setDeleteResult({ success: false, error: "Failed to delete translations" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      setDeleteResult({ success: false, error: "Failed to delete translations" });
    }
  }

  function closeDeleteProgress() {
    setDeletingLanguage(null);
    setDeleteResult(null);
  }

  function openTranslationsDialog() {
    setTranslationsDialogOpen(true);
    fetchTranslationStatus();
  }

  async function saveTranslationForLanguage(lang: LanguageCode) {
    if (!editingQuestion?.id) {
      toast.error(t("editor.saveBeforeTranslations"));
      return;
    }

    setSavingTranslation(lang);

    try {
      const translatedQuestion = questionTranslations[lang] || {};

      const answersPayload = answers
        .filter((a) => a.id)
        .map((a, index) => {
          const key = a.id || `answer-${index}`;
          return {
            id: a.id!,
            answerText: answerTranslations[key]?.[lang] ?? a.answerText,
          };
        });

      const res = await fetch(
        `/api/quizzes/${quizId}/questions/${editingQuestion.id}/translations/${lang}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: translatedQuestion.questionText ?? "",
            hostNotes: translatedQuestion.hostNotes ?? null,
            hint: translatedQuestion.hint ?? null,
            easterEggButtonText: translatedQuestion.easterEggButtonText ?? null,
            answers: answersPayload,
          }),
        }
      );

      if (res.ok) {
        toast.success(`Saved ${SupportedLanguages[lang].name} translation`);
        await loadQuestionTranslations(editingQuestion.id);
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToSaveTranslation"));
      }
    } catch (error) {
      console.error("Failed to save translation:", error);
      toast.error(t("editor.failedToSaveTranslation"));
    } finally {
      setSavingTranslation((current) => (current === lang ? null : current));
    }
  }

  async function loadQuestionTranslations(questionId: string) {
    try {
      const res = await fetch(`/api/quizzes/${quizId}/questions/${questionId}/translations`);
      if (res.ok) {
        const data = await res.json();
        if (data.translations) {
          setQuestionTranslations(data.translations.questionTranslations || {});
          setAnswerTranslations(data.translations.answerTranslations || {});

          const langs = new Set<LanguageCode>([sourceLanguage]);
          Object.keys(data.translations.questionTranslations || {}).forEach((lang) => {
            langs.add(lang as LanguageCode);
          });
          Object.values(data.translations.answerTranslations || {} as Record<string, Record<string, string>>)
            .forEach((answerMap) => {
              Object.keys(answerMap || {}).forEach((lang) => langs.add(lang as LanguageCode));
            });
          setAvailableTranslationLanguages(Array.from(langs));
        }
      }
    } catch (error) {
      console.error("Failed to load translations:", error);
    }
  }

  function addTranslationLanguage(lang: LanguageCode) {
    if (!availableTranslationLanguages.includes(lang)) {
      setAvailableTranslationLanguages((prev) => [...prev, lang]);
      setActiveTranslationTab(lang);
      setQuestionTranslations((prev) => ({
        ...prev,
        [lang]: { questionText: "", hostNotes: "", hint: "", easterEggButtonText: "" },
      }));
    }
  }

  function getTranslationStatus(lang: LanguageCode): "complete" | "partial" | "empty" {
    const qt = questionTranslations[lang];
    if (!qt?.questionText) return "empty";

    const hasAllAnswers = answers.every(
      (a) => answerTranslations[a.id || `answer-${answers.indexOf(a)}`]?.[lang]
    );

    return qt.questionText && hasAllAnswers ? "complete" : "partial";
  }

  function getSectionTranslationStatus(lang: LanguageCode): "complete" | "partial" | "empty" {
    const qt = questionTranslations[lang];
    if (!qt?.questionText) return "empty";

    // For sections, check title and optionally description
    const hasTitle = qt.questionText?.trim();
    const needsDescription = hostNotes?.trim();
    const hasDescription = !needsDescription || qt.hostNotes?.trim();

    return hasTitle && hasDescription ? "complete" : "partial";
  }

  function copyToTranslation(field: string, value: string, lang: LanguageCode) {
    setQuestionTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }));
  }

  function copyAnswerToTranslation(answer: Answer, lang: LanguageCode) {
    const key = answer.id || `answer-${answers.indexOf(answer)}`;
    setAnswerTranslations((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [lang]: answer.answerText },
    }));
  }

  function updateQuestionTranslation(lang: LanguageCode, field: string, value: string) {
    setQuestionTranslations((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }));
  }

  function updateAnswerTranslation(answer: Answer, lang: LanguageCode, value: string) {
    const key = answer.id || `answer-${answers.indexOf(answer)}`;
    setAnswerTranslations((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || {}), [lang]: value },
    }));
  }

  async function autoTranslateQuestion(lang: LanguageCode) {
    if (!editingQuestion) return;

    setAutoTranslatingQuestion(lang);
    try {
      const res = await fetch(
        `/api/quizzes/${quizId}/questions/${editingQuestion.id}/translate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage: lang }),
        }
      );

      if (res.ok) {
        await loadQuestionTranslations(editingQuestion.id);
        setActiveTranslationTab(lang);
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToAutoTranslateQuestion"));
      }
    } catch (error) {
      console.error("Failed to auto-translate:", error);
      toast.error(t("editor.failedToAutoTranslateQuestion"));
    } finally {
      setAutoTranslatingQuestion(null);
    }
  }

  function openEditDialog(question: Question) {
    setEditingQuestion(question);
    setQuestionText(question.questionText);
    setImageUrl(question.imageUrl || "");
    setHostNotes(question.hostNotes || "");
    setHint(question.hint || "");
    setQuestionType(question.questionType);
    setTimeLimit(question.timeLimit);
    setPoints(question.points);
    setAnswers(
      question.answers.map((a) => ({
        id: a.id,
        answerText: a.answerText,
        imageUrl: a.imageUrl,
        isCorrect: a.isCorrect,
      }))
    );
    // Load structured content when editing CATEGORISE/MATCHING questions.
    const loadedCategorise = parseCategoriseData(question.categoriseData);
    setCategoriseData(
      loadedCategorise || {
        categories: [
          { id: newLocalId("cat"), label: "" },
          { id: newLocalId("cat"), label: "" },
        ],
        items: [
          { id: newLocalId("item"), label: "", categoryId: "" },
          { id: newLocalId("item"), label: "", categoryId: "" },
        ],
      }
    );
    const loadedMatching = parseMatchingData(question.matchingData);
    setMatchingData(
      loadedMatching || {
        pairs: [
          { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
          { leftId: newLocalId("left"), leftLabel: "", rightId: newLocalId("right"), rightLabel: "" },
        ],
      }
    );
    setEasterEggEnabled((question as any).easterEggEnabled || false);
    setEasterEggButtonText((question as any).easterEggButtonText || "Click for a surprise!");
    setEasterEggUrl((question as any).easterEggUrl || "");
    setEasterEggDisablesScoring((question as any).easterEggDisablesScoring || false);

    setQuestionTranslations({} as Record<LanguageCode, any>);
    setAnswerTranslations({});
    setActiveTranslationTab(sourceLanguage);
    setAvailableTranslationLanguages([sourceLanguage]);

    if (question.id) {
      loadQuestionTranslations(question.id);
    }

    if (question.questionType === "SECTION") {
      setSectionDialogOpen(true);
    } else {
      setDialogOpen(true);
    }
  }

  function openSectionDialog() {
    resetForm();
    setQuestionType("SECTION");
    setSectionDialogOpen(true);
  }

  async function saveSection() {
    if (!questionText.trim()) {
      toast.error("Section title is required");
      return;
    }

    const sectionData = {
      questionText,
      imageUrl: imageUrl || null,
      hostNotes: hostNotes || null,
      questionType: "SECTION",
      timeLimit: 0,
      points: 0,
      answers: [],
    };

    try {
      let res;
      if (editingQuestion) {
        res = await fetch(`/api/quizzes/${quizId}/questions/${editingQuestion.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sectionData),
        });
      } else {
        res = await fetch(`/api/quizzes/${quizId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sectionData),
        });
      }

      if (res.ok) {
        setSectionDialogOpen(false);
        resetForm();
        fetchQuiz();
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToSaveSection"));
      }
    } catch (error) {
      console.error("Failed to save section:", error);
      toast.error(t("editor.failedToSaveSection"));
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToUploadImage"));
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(t("editor.failedToUploadImage"));
    } finally {
      setUploading(false);
    }
  }

  function removeImage() {
    setImageUrl("");
  }

  async function saveQuestion() {
    if (!questionText.trim()) {
      toast.error("Question text is required");
      return;
    }

    const isStructuredType =
      questionType === "CATEGORISE" || questionType === "MATCHING";

    // Validate structured content for CATEGORISE/MATCHING. For these types we
    // skip the answers array entirely.
    if (isStructuredType) {
      if (questionType === "CATEGORISE") {
        const result = validateCategoriseData(categoriseData);
        if (!result.valid) {
          toast.error(result.error || t("editor.categoriseInvalid"));
          return;
        }
      } else {
        const result = validateMatchingData(matchingData);
        if (!result.valid) {
          toast.error(result.error || t("editor.matchingInvalid"));
          return;
        }
      }
    } else {
      const validAnswers = answers.filter((a) => a.answerText.trim());

      if (validAnswers.length < 2) {
        toast.error("At least 2 answers are required");
        return;
      }

      if (!validAnswers.some((a) => a.isCorrect)) {
        toast.error(t("editor.atLeastOneCorrect"));
        return;
      }
    }

    if (easterEggEnabled) {
      if (!easterEggButtonText.trim()) {
        toast.error("Easter egg button text is required");
        return;
      }
      if (!easterEggUrl.trim() || !easterEggUrl.match(/^https?:\/\/.+/)) {
        toast.error(t("editor.easterEggInvalidUrl"));
        return;
      }
    }

    if (quiz && quiz.hintCount > 0 && !hint.trim()) {
      toast.error("Hint is required when Hint power-up is enabled");
      return;
    }

    const validAnswers = answers.filter((a) => a.answerText.trim());
    const questionData: Record<string, unknown> = {
      questionText,
      imageUrl: imageUrl || null,
      hostNotes: hostNotes || null,
      hint: hint || null,
      questionType,
      timeLimit,
      points,
      easterEggEnabled,
      easterEggButtonText: easterEggEnabled ? easterEggButtonText.trim() : null,
      easterEggUrl: easterEggEnabled ? easterEggUrl.trim() : null,
      easterEggDisablesScoring: easterEggEnabled ? easterEggDisablesScoring : false,
    };

    if (isStructuredType) {
      // Structured types carry no answer options.
      questionData.answers = [];
      questionData.categoriseData =
        questionType === "CATEGORISE" ? JSON.stringify(categoriseData) : null;
      questionData.matchingData =
        questionType === "MATCHING" ? JSON.stringify(matchingData) : null;
    } else {
      questionData.answers = validAnswers;
      questionData.categoriseData = null;
      questionData.matchingData = null;
    }

    try {
      let res;
      if (editingQuestion) {
        res = await fetch(`/api/quizzes/${quizId}/questions/${editingQuestion.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(questionData),
        });
      } else {
        res = await fetch(`/api/quizzes/${quizId}/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(questionData),
        });
      }

      if (res.ok) {
        setDialogOpen(false);
        resetForm();
        fetchQuiz();
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToSaveQuestion"));
      }
    } catch (error) {
      console.error("Failed to save question:", error);
      toast.error(t("editor.failedToSaveQuestion"));
    }
  }

  async function updateAutoAdmit(autoAdmit: boolean) {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoAdmit }),
      });
      if (res.ok) {
        setQuiz((prev) => (prev ? { ...prev, autoAdmit } : null));
      }
    } catch (error) {
      console.error("Failed to update auto-admit:", error);
    }
  }

  async function updatePowerUpCount(field: string, value: number) {
    try {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });

      if (res.ok) {
        setQuiz((prev) => (prev ? { ...prev, [field]: value } : null));
        await fetchQuiz();
      }
    } catch (error) {
      console.error("Failed to update power-up count:", error);
    }
  }

  function requestDeleteQuestion(questionId: string) {
    if (!quiz) return;
    const question = quiz.questions.find((q) => q.id === questionId) || null;
    setQuestionToDelete(question);
  }

  async function deleteQuestion() {
    if (!questionToDelete) return;
    setDeletingQuestion(true);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/questions/${questionToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("editor.questionDeleted"));
        fetchQuiz();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || t("editor.failedToDeleteQuestion"));
      }
    } catch (error) {
      console.error("Failed to delete question:", error);
      toast.error(t("editor.failedToDeleteQuestion"));
    } finally {
      setDeletingQuestion(false);
      setQuestionToDelete(null);
    }
  }

  async function duplicateQuestion(questionId: string) {
    if (!quiz) return;

    const question = quiz.questions.find((q) => q.id === questionId);
    if (!question || question.questionType === "SECTION") return;

    try {
      const questionData = {
        questionText: `${question.questionText} (Copy)`,
        imageUrl: question.imageUrl || null,
        hostNotes: question.hostNotes || null,
        hint: question.hint || null,
        questionType: question.questionType,
        timeLimit: question.timeLimit,
        points: question.points,
        answers: question.answers.map((a) => ({
          answerText: a.answerText,
          isCorrect: a.isCorrect,
        })),
        categoriseData: question.categoriseData ?? null,
        matchingData: question.matchingData ?? null,
      };

      const res = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionData),
      });

      if (res.ok) {
        fetchQuiz();
      } else {
        const data = await res.json();
        toast.error(data.error || t("editor.failedToDuplicateQuestion"));
      }
    } catch (error) {
      console.error("Failed to duplicate question:", error);
      toast.error(t("editor.failedToDuplicateQuestion"));
    }
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !quiz || active.id === over.id) return;

    const oldIndex = quiz.questions.findIndex((q) => q.id === active.id);
    const newIndex = quiz.questions.findIndex((q) => q.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const draggedItem = quiz.questions[oldIndex];
    const isSection = draggedItem.questionType === "SECTION";

    let newQuestions: Question[];

    if (isSection) {
      const groups = groupQuestionsBySections(quiz.questions);
      const sectionGroupIndex = groups.findIndex((g) => g.section?.id === active.id);

      if (sectionGroupIndex === -1) return;

      const sectionGroup = groups[sectionGroupIndex];
      const itemsToMove = [sectionGroup.section!, ...sectionGroup.questions];

      const remainingGroups = groups.filter((_, i) => i !== sectionGroupIndex);
      const overItem = quiz.questions.find((q) => q.id === over.id);
      if (!overItem) return;

      let targetGroupIndex = -1;
      let insertAfterGroup = false;

      for (let i = 0; i < remainingGroups.length; i++) {
        const group = remainingGroups[i];
        if (group.section?.id === over.id) {
          targetGroupIndex = i;
          insertAfterGroup = false;
          break;
        }
        if (group.questions.some((q) => q.id === over.id)) {
          targetGroupIndex = i;
          insertAfterGroup = true;
          break;
        }
      }

      if (targetGroupIndex === -1) {
        targetGroupIndex = remainingGroups.length - 1;
        insertAfterGroup = true;
      }

      const newGroups = [...remainingGroups];
      const insertIndex = insertAfterGroup ? targetGroupIndex + 1 : targetGroupIndex;
      newGroups.splice(insertIndex, 0, sectionGroup);

      newQuestions = flattenGroups(newGroups);
    } else {
      newQuestions = arrayMove(quiz.questions, oldIndex, newIndex);
    }

    const updatedQuestions = newQuestions.map((q, index) => ({
      ...q,
      orderIndex: index,
    }));

    setQuiz((prev) => (prev ? { ...prev, questions: updatedQuestions } : null));

    try {
      await fetch(`/api/quizzes/${quizId}/questions/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIds: updatedQuestions.map((q) => q.id),
        }),
      });
    } catch (error) {
      console.error("Failed to reorder questions:", error);
      fetchQuiz();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-2xl font-bold mb-2">{t("editor.quizNotFound")}</h2>
        <p className="text-muted-foreground mb-4">
          {t("editor.quizNotFoundDesc")}
        </p>
        <Link href="/admin">
          <Button>{t("editor.backToQuizzes")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats and Actions */}
      <QuestionListHeader
        quiz={quiz}
        translationStatuses={translationStatuses}
        onAddQuestion={() => {
          resetForm();
          setDialogOpen(true);
        }}
        onAddSection={openSectionDialog}
        onToggleSettings={() => setSettingsSidebarOpen(!settingsSidebarOpen)}
        onOpenTranslations={openTranslationsDialog}
        onExportQuiz={handleExport}
        isExporting={exporting}
        settingsOpen={settingsSidebarOpen}
        onEditQuizDetails={openEditQuizDetails}
      />

      {/* Questions List */}
      <QuestionList
        questions={quiz.questions}
        hintRequired={quiz.hintCount > 0}
        translationStatuses={translationStatuses}
        questionTranslationStatuses={questionTranslationStatuses}
        activeId={activeId}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onEdit={openEditDialog}
        onDelete={requestDeleteQuestion}
        onDuplicate={duplicateQuestion}
        onAddQuestion={() => {
          resetForm();
          setDialogOpen(true);
        }}
      />

      <AlertDialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("editor.deleteQuestionTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("editor.deleteQuestionDesc", { name: questionToDelete?.questionText || t("editor.thisQuestion") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingQuestion}>{t("editor.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingQuestion}
            >
              {deletingQuestion ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("editor.deleting")}
                </>
              ) : (
                t("editor.deleteQuestion")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Settings Sidebar */}
      <QuizSettingsSidebar
        quiz={quiz}
        isOpen={settingsSidebarOpen}
        onClose={() => setSettingsSidebarOpen(false)}
        onUpdateAutoAdmit={updateAutoAdmit}
        onUpdatePowerUp={updatePowerUpCount}
      />

      {/* Edit quiz details */}
      <Dialog
        open={editQuizDetailsOpen}
        onOpenChange={(open) => {
          setEditQuizDetailsOpen(open);
          if (open && quiz) {
            setQuizTitleInput(quiz.title || "");
            setQuizDescriptionInput(quiz.description || "");
          } else {
            setQuizDetailsError("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("editor.editQuizDetails")}</DialogTitle>
            <DialogDescription>
              {t("editor.editQuizDetailsDesc")}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveQuizDetails();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="quiz-title">{t("editor.title")}</Label>
              <Input
                id="quiz-title"
                value={quizTitleInput}
                onChange={(e) => setQuizTitleInput(e.target.value)}
                placeholder={t("editor.titlePlaceholder")}
                disabled={savingQuizDetails}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiz-description">{t("editor.descriptionOptional")}</Label>
              <Textarea
                id="quiz-description"
                value={quizDescriptionInput}
                onChange={(e) => setQuizDescriptionInput(e.target.value)}
                placeholder={t("editor.descriptionPlaceholder")}
                disabled={savingQuizDetails}
                rows={3}
              />
            </div>

            {quizDetailsError && (
              <p className="text-sm text-destructive">{quizDetailsError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditQuizDetailsOpen(false)}
                disabled={savingQuizDetails}
              >
                {t("editor.cancel")}
              </Button>
              <Button type="submit" disabled={savingQuizDetails}>
                {savingQuizDetails ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("editor.saving")}
                  </>
                ) : (
                  t("editor.saveChanges")
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Question Editor Dialog */}
      <QuestionEditorDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
        editingQuestion={editingQuestion}
        hintRequired={quiz.hintCount > 0}
        questionText={questionText}
        setQuestionText={setQuestionText}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        hostNotes={hostNotes}
        setHostNotes={setHostNotes}
        hint={hint}
        setHint={setHint}
        questionType={questionType}
        setQuestionType={setQuestionType}
        timeLimit={timeLimit}
        setTimeLimit={setTimeLimit}
        points={points}
        setPoints={setPoints}
        answers={answers}
        setAnswers={setAnswers}
        categoriseData={categoriseData}
        setCategoriseData={setCategoriseData}
        matchingData={matchingData}
        setMatchingData={setMatchingData}
        easterEggEnabled={easterEggEnabled}
        setEasterEggEnabled={setEasterEggEnabled}
        easterEggButtonText={easterEggButtonText}
        setEasterEggButtonText={setEasterEggButtonText}
        easterEggUrl={easterEggUrl}
        setEasterEggUrl={setEasterEggUrl}
        easterEggDisablesScoring={easterEggDisablesScoring}
        setEasterEggDisablesScoring={setEasterEggDisablesScoring}
        availableTranslationLanguages={availableTranslationLanguages}
        activeTranslationTab={activeTranslationTab}
        setActiveTranslationTab={setActiveTranslationTab}
        sourceLanguage={sourceLanguage}
        questionTranslations={questionTranslations}
        answerTranslations={answerTranslations}
        onAddTranslationLanguage={addTranslationLanguage}
        onUpdateQuestionTranslation={updateQuestionTranslation}
        onUpdateAnswerTranslation={updateAnswerTranslation}
        onCopyToTranslation={copyToTranslation}
        onCopyAnswerToTranslation={copyAnswerToTranslation}
        onAutoTranslate={autoTranslateQuestion}
        onSaveTranslation={saveTranslationForLanguage}
        autoTranslatingQuestion={autoTranslatingQuestion}
        savingTranslation={savingTranslation}
        getTranslationStatus={getTranslationStatus}
        uploading={uploading}
        onImageUpload={handleImageUpload}
        onRemoveImage={removeImage}
        onSave={saveQuestion}
        onCancel={() => {
          setDialogOpen(false);
          resetForm();
        }}
      />

      {/* Section Editor Dialog */}
      <SectionEditorDialog
        open={sectionDialogOpen}
        onOpenChange={(open) => {
          setSectionDialogOpen(open);
          if (!open) resetForm();
        }}
        editingSection={editingQuestion?.questionType === "SECTION" ? editingQuestion : null}
        sectionTitle={questionText}
        setSectionTitle={setQuestionText}
        sectionDescription={hostNotes}
        setSectionDescription={setHostNotes}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        availableTranslationLanguages={availableTranslationLanguages}
        activeTranslationTab={activeTranslationTab}
        setActiveTranslationTab={setActiveTranslationTab}
        sourceLanguage={sourceLanguage}
        sectionTranslations={questionTranslations}
        onAddTranslationLanguage={addTranslationLanguage}
        onUpdateSectionTranslation={updateQuestionTranslation}
        onCopyToTranslation={copyToTranslation}
        onAutoTranslate={autoTranslateQuestion}
        onSaveTranslation={saveTranslationForLanguage}
        autoTranslatingSection={autoTranslatingQuestion}
        savingTranslation={savingTranslation}
        getTranslationStatus={getSectionTranslationStatus}
        uploading={uploading}
        onImageUpload={handleImageUpload}
        onRemoveImage={removeImage}
        onSave={saveSection}
        onCancel={() => {
          setSectionDialogOpen(false);
          resetForm();
        }}
      />

      {/* Translations Dialog */}
      <Dialog open={translationsDialogOpen} onOpenChange={setTranslationsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Languages className="w-5 h-5" />
              Quiz Translations
            </DialogTitle>
            <DialogDescription>
              Translate your quiz into multiple languages using AI. Players can select their preferred language when joining.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1">
            {loadingTranslations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3">
                {(Object.keys(SupportedLanguages) as LanguageCode[])
                  .filter((code) => code !== sourceLanguage)
                  .map((languageCode) => {
                    const languageInfo = SupportedLanguages[languageCode];
                    const status = translationStatuses.find((s) => s.languageCode === languageCode);
                    const isTranslating = translatingLanguage === languageCode;
                    const isComplete = status?.isComplete || false;
                    const progress = status
                      ? `${status.translatedFields}/${status.totalFields}`
                      : "0/0";

                    return (
                      <Card key={languageCode}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="text-3xl">{languageInfo.flag}</span>
                              <div className="flex-1">
                                <h3 className="font-medium">
                                  {languageInfo.name}
                                  <span className="text-muted-foreground ml-2 text-sm">
                                    {languageInfo.nativeName}
                                  </span>
                                </h3>
                                {status && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="text-sm text-muted-foreground">
                                      {progress} fields
                                    </div>
                                    {isComplete && (
                                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded-full">
                                        Complete
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant={(status?.translatedFields ?? 0) > 0 ? "outline" : "default"}
                                size="sm"
                                onClick={() => handleTranslateQuiz(languageCode)}
                                disabled={isTranslating}
                              >
                                {isTranslating ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {t("editor.translate.translating")}
                                  </>
                                ) : (status?.translatedFields ?? 0) > 0 ? (
                                  t("editor.translate.retranslate")
                                ) : (
                                  t("editor.translate.translate")
                                )}
                              </Button>
                              {(status?.translatedFields ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteLanguage(languageCode)}
                                  title={t("editor.translate.deleteTranslation")}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-muted-foreground">
                <strong>{t("editor.note")}</strong> {t("editor.translationsNote")}{" "}
                <Link href="/admin/settings" className="text-primary hover:underline">
                  {t("editor.settings")}
                </Link>
                .
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Translation Dialog */}
      <Dialog open={!!confirmTranslateLanguage} onOpenChange={(open) => !open && setConfirmTranslateLanguage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t("editor.translate.translateQuiz")}
            </DialogTitle>
            <DialogDescription>
              {confirmTranslateLanguage && (
                <>
                  {t("editor.translate.translateAllTo")}{" "}
                  <strong>
                    {SupportedLanguages[confirmTranslateLanguage].flag}{" "}
                    {SupportedLanguages[confirmTranslateLanguage].name}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t("editor.translate.thisActionWill")}</p>
                <ul className="mt-1 text-muted-foreground space-y-1">
                  <li>{t("editor.translate.actionTakeMinutes")}</li>
                  <li>{t("editor.translate.actionUseCredits")}</li>
                  <li>{t("editor.translate.actionOverwrite")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmTranslateLanguage(null)}>
              {t("editor.cancel")}
            </Button>
            <Button onClick={executeTranslateQuiz}>
              <Sparkles className="w-4 h-4 mr-2" />
              {t("editor.translate.startTranslation")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Translation Progress Dialog */}
      <Dialog open={!!translatingLanguage} onOpenChange={(open) => !open && translationResult && closeTranslationProgress()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {!translationResult ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  {t("editor.translate.translating")}
                </>
              ) : translationResult.success ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  {t("editor.translate.translationComplete")}
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  {t("editor.translate.translationFailed")}
                </>
              )}
            </DialogTitle>
            {translatingLanguage && (
              <DialogDescription>
                {SupportedLanguages[translatingLanguage].flag}{" "}
                {SupportedLanguages[translatingLanguage].name}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            {!translationResult ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-6">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-muted" />
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  {t("editor.translate.translatingWithAi")}
                </p>
              </div>
            ) : translationResult.success ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  {(translationResult.translated ?? 0) > 0 ? (
                    <p className="text-lg font-medium">
                      {t("editor.translate.questionsTranslated", { count: translationResult.translated ?? 0 })}
                    </p>
                  ) : (
                    <p className="text-lg font-medium">{t("editor.translate.translationCompleteShort")}</p>
                  )}
                  {(translationResult.failed ?? 0) > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {t("editor.translate.questionsFailed", { count: translationResult.failed ?? 0 })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {translationResult.error}
                </p>
              </div>
            )}
          </div>

          {translationResult && (
            <div className="flex justify-end">
              <Button onClick={closeTranslationProgress}>{t("editor.translate.done")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Translation Dialog */}
      <Dialog open={!!confirmDeleteLanguage} onOpenChange={(open) => !open && setConfirmDeleteLanguage(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {t("editor.translate.deleteTranslation")}
            </DialogTitle>
            <DialogDescription>
              {confirmDeleteLanguage && (
                <>
                  {t("editor.translate.deleteAllFor")}{" "}
                  <strong>
                    {SupportedLanguages[confirmDeleteLanguage].flag}{" "}
                    {SupportedLanguages[confirmDeleteLanguage].name}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">{t("editor.translate.actionCannotUndo")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("editor.translate.deleteAllContent")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteLanguage(null)}>
              {t("editor.cancel")}
            </Button>
            <Button variant="destructive" onClick={executeDeleteLanguage}>
              <Trash2 className="w-4 h-4 mr-2" />
              {t("editor.translate.deleteTranslation")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Progress/Result Dialog */}
      <Dialog open={!!deletingLanguage} onOpenChange={(open) => !open && deleteResult && closeDeleteProgress()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {!deleteResult ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-destructive" />
                  {t("editor.translate.deleting")}
                </>
              ) : deleteResult.success ? (
                <>
                  <Check className="w-5 h-5 text-green-500" />
                  {t("editor.translate.translationDeleted")}
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  {t("editor.translate.deleteFailed")}
                </>
              )}
            </DialogTitle>
            {deletingLanguage && (
              <DialogDescription>
                {SupportedLanguages[deletingLanguage].flag}{" "}
                {SupportedLanguages[deletingLanguage].name}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            {!deleteResult ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : deleteResult.success ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                <p className="text-center text-muted-foreground">
                  {t("editor.translate.translationDeletedMsg")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {deleteResult.error}
                </p>
              </div>
            )}
          </div>

          {deleteResult && (
            <div className="flex justify-end">
              <Button onClick={closeDeleteProgress}>{t("editor.translate.done")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
