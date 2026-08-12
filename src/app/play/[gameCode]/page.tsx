"use client";

import { use, useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useQuizPreloader } from "@/hooks/useQuizPreloader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PowerUpType, PlayerPowerUpState, SupportedLanguages, type LanguageCode, type QuestionDataWithTranslations, type PlayerViewState } from "@/types";
import { Check, X, Trophy, Medal, Award, Loader2, Upload, Layers, Bell, UserX, Zap, Lightbulb, Users, Sparkles, Languages as LanguagesIcon, AlarmClock, Globe, ChevronUp, Target } from "lucide-react";
import { ThemeProvider, getAnswerColor, getSelectedAnswerStyle } from "@/components/theme/ThemeProvider";
import { BackgroundEffects } from "@/components/theme/BackgroundEffects";
import {
  CertificateDownloadButton,
  type CertificateButtonState,
} from "@/components/certificate/CertificateDownloadButton";
import { BORDER_RADIUS_MAP, SHADOW_MAP } from "@/types/theme";
import { getContrastingTextColor } from "@/lib/color-utils";
import { LanguageSelector } from "@/components/ui/language-selector";
import { useTranslation } from "@/hooks/useTranslation";
import { AppLocale } from "@/contexts/I18nContext";

export default function PlayerGamePage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = use(params);
  const router = useRouter();
  const { locale: appLocale, setLocale: setAppLocale, t } = useTranslation();
  const [playerName, setPlayerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set());
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [easterEggClicked, setEasterEggClicked] = useState<Set<string>>(new Set());
  const [gameStatus, setGameStatus] = useState<"loading" | "valid" | "not_found" | "ended">("loading");
  const [joinTheme, setJoinTheme] = useState<any>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>("en");
  const [availableLanguages, setAvailableLanguages] = useState<LanguageCode[]>(["en"]);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [knownPlayerId, setKnownPlayerId] = useState<string | null>(null);
  const screenRef = useRef<HTMLDivElement | null>(null);
  const latestScreenshot = useRef<string | null>(null);
  const CAPTURE_INTERVAL_MS = 800;

  // Power-up state
  const [powerUpState, setPowerUpState] = useState<PlayerPowerUpState>({
    hintsRemaining: 0,
    copyRemaining: 0,
    doubleRemaining: 0,
    usedThisQuestion: new Set(),
  });
  const [selectedPowerUps, setSelectedPowerUps] = useState<Set<PowerUpType>>(new Set());
  const [copiedPlayerId, setCopiedPlayerId] = useState<string | null>(null);
  const [showCopyPlayerSelector, setShowCopyPlayerSelector] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [certificateState, setCertificateState] = useState<CertificateButtonState>("checking");

  // Check if game exists and is joinable on mount
  useEffect(() => {
    async function checkGame() {
      try {
        const res = await fetch(`/api/games/${gameCode}`, {
          headers: { "ngrok-skip-browser-warning": "true" },
        });
        if (res.ok) {
          const data = await res.json();
          setJoinTheme(data.quizTheme);
          if (data.availableLanguages) {
            const langs = data.availableLanguages.includes("en")
              ? data.availableLanguages
              : ["en", ...data.availableLanguages];
            setAvailableLanguages(Array.from(new Set(langs)));
          }
          if (data.status === "WAITING") {
            setGameStatus("valid");
          } else if (data.status === "FINISHED") {
            setGameStatus("ended");
          } else {
            // Game is in progress (ACTIVE, QUESTION, REVEALING, SCOREBOARD)
            setGameStatus("ended");
          }
        } else if (res.status === 404) {
          setGameStatus("not_found");
        } else {
          setGameStatus("not_found");
        }
      } catch {
        setGameStatus("not_found");
      }
    }
    checkGame();
  }, [gameCode]);

  // Load language preference from localStorage on mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem(`quiz_language_${gameCode}`);
    if (savedLanguage && savedLanguage in SupportedLanguages) {
      setSelectedLanguage(savedLanguage as LanguageCode);
    }
  }, [gameCode]);

  // Save language preference to localStorage when it changes
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem(`quiz_language_${gameCode}`, selectedLanguage);
    }
  }, [selectedLanguage, gameCode]);

  // Common emojis for avatar selection
  const avatarEmojis = [
    "😀", "😎", "🤓", "😈", "👻", "🤖", "👽", "🦊",
    "🐱", "🐶", "🐸", "🦁", "🐼", "🐨", "🦄", "🐲",
    "🌟", "⚡", "🔥", "💎", "🎮", "🎸", "🚀", "🏆",
  ];

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setJoinError(t("errors.invalidFileType"));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setJoinError(t("errors.imageTooLarge"));
      return;
    }

    setUploadingImage(true);
    setJoinError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarImage(data.url);
        setSelectedEmoji(null); // Clear emoji when image is selected
      } else {
        const data = await res.json();
        setJoinError(data.error || t("errors.uploadFailed"));
      }
    } catch {
      setJoinError(t("errors.uploadFailed"));
    } finally {
      setUploadingImage(false);
    }
  }

  const {
    socket,
    connected,
    gameState,
    currentQuestion,
    timeRemaining,
    scores,
    answerResult,
    questionEnded,
    awaitingReveal,
    error,
    gameCancelled,
    playerRemoved,
    removalReason,
    admissionStatus,
    submitAnswer,
  } = useSocket({
    gameCode,
    role: "player",
    playerName: joined ? playerName : undefined,
    languageCode: joined ? selectedLanguage : undefined,
  });

  // Get player ID from game state
  const playerId = gameState?.players.find(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  )?.id;

  const playerInfo = useMemo(
    () => gameState?.players.find((p) => p.id === playerId) || null,
    [gameState?.players, playerId]
  );

  useEffect(() => {
    if (playerId) {
      setKnownPlayerId(playerId);
    }
  }, [playerId]);

  // Initialize quiz preloader
  const { quizData } = useQuizPreloader({
    gameCode,
    playerId,
    socket,
  });

  // Extract available languages from quiz data
  useEffect(() => {
    if (quizData?.availableLanguages) {
      setAvailableLanguages(quizData.availableLanguages);

      // If selected language is not available, reset to English
      if (!quizData.availableLanguages.includes(selectedLanguage)) {
        setSelectedLanguage("en");
      }
    }
  }, [quizData, selectedLanguage]);

  // Use preloaded question if available, otherwise fall back to socket-provided question
  const effectiveCurrentQuestion = useMemo<QuestionDataWithTranslations | null>(() => {
    if (quizData && gameState?.currentQuestionIndex !== undefined) {
      // Preloaded questions may start at a non-zero index when joining mid-game
      const offset = (quizData.startIndex ?? 0);
      const localIndex = gameState.currentQuestionIndex - offset;
      if (localIndex >= 0 && localIndex < quizData.questions.length) {
        return quizData.questions[localIndex];
      }
    }
    // Fall back to socket-provided question (cast to include potential translations)
    return currentQuestion as QuestionDataWithTranslations | null;
  }, [quizData, gameState?.currentQuestionIndex, currentQuestion]);

  // Reset selected answers when question changes
  useEffect(() => {
    setSelectedAnswers(new Set());
    setHasSubmitted(false);
  }, [effectiveCurrentQuestion?.id]);

  // Initialize power-up counts from gameState
  useEffect(() => {
    if (gameState?.powerUps) {
      setPowerUpState((prev) => ({
        ...prev,
        hintsRemaining: gameState.powerUps.hintCount,
        copyRemaining: gameState.powerUps.copyAnswerCount,
        doubleRemaining: gameState.powerUps.doublePointsCount,
      }));
    }
  }, [gameState?.powerUps]);

  // Reset power-up selections when question changes
  useEffect(() => {
    if (gameState?.status === "QUESTION") {
      setPowerUpState((prev) => ({ ...prev, usedThisQuestion: new Set() }));
      setSelectedPowerUps(new Set());
      setCopiedPlayerId(null);
    }
  }, [gameState?.currentQuestionIndex, gameState?.status]);

  // Translation utility function
  const getTranslatedContent = (
    content: string | null | undefined,
    translations?: Record<string, any>,
    field?: string
  ): string => {
    // If no content, return empty string
    if (!content) return "";

    // If English is selected or no translations available, return original content
    if (selectedLanguage === "en" || !translations) return content;

    // Try to get translation for the selected language
    const translation = translations[selectedLanguage];
    if (translation && field && translation[field]) {
      return translation[field];
    }

    // Fallback to original content (English)
    return content;
  };

  const renderedQuestion = useMemo(() => {
    if (!effectiveCurrentQuestion || !gameState) return null;

    return {
      id: effectiveCurrentQuestion.id,
      questionText: getTranslatedContent(
        effectiveCurrentQuestion.questionText,
        effectiveCurrentQuestion.translations,
        "questionText"
      ),
      questionType: effectiveCurrentQuestion.questionType,
      answers: effectiveCurrentQuestion.answers.map((answer) => ({
        id: answer.id,
        answerText: getTranslatedContent(
          answer.answerText,
          answer.translations,
          "answerText"
        ),
        imageUrl: answer.imageUrl,
      })),
      imageUrl: effectiveCurrentQuestion.imageUrl,
      points: effectiveCurrentQuestion.points,
      questionNumber: gameState.currentQuestionNumber,
      totalQuestions: gameState.totalQuestions,
    };
  }, [effectiveCurrentQuestion, gameState, selectedLanguage]);

  const monitorViewState = useMemo<PlayerViewState | null>(() => {
    const resolvedPlayerId = playerId || knownPlayerId;
    if (!resolvedPlayerId || !playerName) return null;

    if (gameCancelled) {
      return {
        stage: "cancelled",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: "Game cancelled by host",
        isActive: false,
      };
    }

    if (playerRemoved) {
      return {
        stage: "removed",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: removalReason || "You have been removed from the game",
        isActive: false,
      };
    }

    if (!gameState || !connected) {
      return {
        stage: "connecting",
        playerId: resolvedPlayerId,
        playerName,
        languageCode: selectedLanguage,
        message: "Connecting...",
        isActive: !!playerInfo?.isActive,
      };
    }

    let stage: PlayerViewState["stage"] = "waiting";
    if (gameState.status === "SECTION") {
      stage = "section";
    } else if (gameState.status === "QUESTION") {
      stage = "question";
    } else if (gameState.status === "REVEALING") {
      stage = awaitingReveal ? "awaiting-reveal" : "reveal";
    } else if (gameState.status === "SCOREBOARD") {
      stage = "scoreboard";
    } else if (gameState.status === "FINISHED") {
      stage = "finished";
    } else if (gameState.status === "WAITING") {
      stage = "waiting";
    }

    const scoreboardData =
      gameState.status === "SCOREBOARD" || gameState.status === "FINISHED"
        ? (() => {
            const phase: "mid" | "final" =
              gameState.status === "FINISHED" ? "final" : "mid";
            return { scores, phase };
          })()
        : undefined;

    return {
      stage,
      playerId: resolvedPlayerId,
      playerName,
      languageCode: selectedLanguage,
      question: renderedQuestion || undefined,
      selectedAnswerIds: Array.from(selectedAnswers),
      hasSubmitted,
      awaitingReveal,
      timeRemaining,
      correctAnswerIds: questionEnded?.correctAnswerIds,
      answerResult,
      score: playerInfo?.score,
      downloadStatus: playerInfo?.downloadStatus,
      scoreboard: scoreboardData,
      message: removalReason || undefined,
      isActive: playerInfo?.isActive,
    };
  }, [
    answerResult,
    awaitingReveal,
    connected,
    gameCancelled,
    gameState,
    hasSubmitted,
    playerId,
    knownPlayerId,
    playerInfo,
    playerName,
    playerRemoved,
    removalReason,
    renderedQuestion,
    scores,
    selectedAnswers,
    selectedLanguage,
    questionEnded,
    timeRemaining,
  ]);

  useEffect(() => {
    if (!socket || !monitorViewState) return;

    socket.emit("player:viewUpdate", {
      gameCode: gameCode.toUpperCase(),
      playerId: monitorViewState.playerId,
      viewState: monitorViewState,
    });
  }, [socket, monitorViewState, gameCode]);

  // Capture visual snapshot for monitor (best-effort)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let cancelled = false;

    async function captureAndSend() {
      if (!screenRef.current || !socket || !monitorViewState) return;
      try {
        const html2canvas = (await import("html2canvas")).default;
        // TEMPORARY DIAGNOSTIC: Bypass prepareElementForHtml2canvas to test if it's causing the iframe error
        const canvas = await html2canvas(screenRef.current, {
          useCORS: true,
          logging: false,
          scale: 0.5,
          backgroundColor: null,
          ignoreElements: (el) => el.getAttribute("data-ignore-monitor") === "true",
          onclone: (clonedDoc) => {
            // DIAGNOSTIC: Inspect cloned document for oklab/lab/oklch/lch values
            console.log("=== DIAGNOSTIC: Inspecting cloned document for unsupported color functions ===");
            
            // Check all elements in the cloned document
            const allElements = clonedDoc.querySelectorAll('*');
            allElements.forEach(element => {
              // Get computed styles for this element
              const computedStyle = window.getComputedStyle(element);
              
              // Check specific CSS properties for unsupported color functions
              const colorProperties = [
                'color', 'backgroundColor', 'borderTopColor', 'borderRightColor', 
                'borderBottomColor', 'borderLeftColor', 'outlineColor', 
                'boxShadow', 'textShadow', 'fill', 'stroke'
              ];
              
              colorProperties.forEach(property => {
                const value = computedStyle.getPropertyValue(property);
                if (value && (value.includes('oklab(') || value.includes('lab(') || 
                             value.includes('oklch(') || value.includes('lch('))) {
                  console.log("=== UNSUPPORTED COLOR FUNCTION FOUND ===");
                  console.log({
                    tag: element.tagName,
                    className: element.className || "none",
                    property: property,
                    value: value,
                    inlineValue: element.getAttribute('style') || "none",
                    outerHTML: element.outerHTML.substring(0, 500)
                  });
                }
              });
              
              // Check inline styles
              const inlineStyle = element.getAttribute('style');
              if (inlineStyle && (inlineStyle.includes('oklab(') || inlineStyle.includes('lab(') || 
                                 inlineStyle.includes('oklch(') || inlineStyle.includes('lch('))) {
                console.log("=== INLINE STYLE WITH UNSUPPORTED COLOR FUNCTION ===");
                console.log({
                  tag: element.tagName,
                  className: element.className || "none",
                  property: "inline-style",
                  value: inlineStyle,
                  inlineValue: inlineStyle,
                  outerHTML: element.outerHTML.substring(0, 500)
                });
              }
            });
            
            // Check CSS custom properties
            const root = clonedDoc.documentElement;
            if (root) {
              const computedRoot = window.getComputedStyle(root);
              for (let i = 0; i < computedRoot.length; i++) {
                const propName = computedRoot.item(i);
                if (propName.startsWith('--')) {
                  const propValue = computedRoot.getPropertyValue(propName);
                  if (propValue && (propValue.includes('oklab(') || propValue.includes('lab(') || 
                                   propValue.includes('oklch(') || propValue.includes('lch('))) {
                    console.log("=== CSS CUSTOM PROPERTY WITH UNSUPPORTED COLOR FUNCTION ===");
                    console.log({
                      tag: 'CSS-root',
                      className: 'custom-property',
                      property: propName,
                      value: propValue,
                      inlineValue: "none",
                      outerHTML: propName + ': ' + propValue.substring(0, 200)
                    });
                  }
                }
              }
            }
          }
        });
        const screenshot = canvas.toDataURL("image/jpeg", 0.7);
        latestScreenshot.current = screenshot;
        if (!cancelled) {
          socket.emit("player:viewUpdate", {
            gameCode: gameCode.toUpperCase(),
            playerId: monitorViewState.playerId,
            viewState: { ...monitorViewState, screenshot },
          });
        }
      } catch (err) {
        // fail silently - monitor will show fallback state
        console.error("Failed to capture monitor view", err);
      }
    }

    // Initial capture and then regular cadence
    captureAndSend();
    interval = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [socket, monitorViewState, gameCode]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");

    const name = playerName.trim();
    if (!name) {
      setJoinError("Please enter your name");
      return;
    }

    if (name.length > 20) {
      setJoinError("Name must be 20 characters or less");
      return;
    }

    setJoining(true);

    try {
      const res = await fetch(`/api/games/${gameCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ name, avatarEmoji: avatarImage || selectedEmoji }),
      });

      if (res.ok) {
        setJoined(true);
      } else {
        const data = await res.json();
        // If admission is pending, still proceed to join (socket will handle waiting state)
        if (data.status === "pending") {
          setJoined(true);
        } else {
          setJoinError(data.error || "Failed to join game");
        }
      }
    } catch {
      setJoinError("Failed to join game");
    } finally {
      setJoining(false);
    }
  }

  function emitPowerUps(questionId: string) {
    if (!socket) return;

    // Emit power-ups first
    Array.from(selectedPowerUps).forEach((powerUpType) => {
      socket.emit("player:usePowerUp", {
        gameCode: gameCode.toUpperCase(),
        questionId,
        powerUpType,
        ...(powerUpType === PowerUpType.COPY && copiedPlayerId ? { copiedPlayerId } : {}),
      });

      // Update local state
      setPowerUpState((prev) => {
        const next = { ...prev };
        if (powerUpType === PowerUpType.HINT) next.hintsRemaining--;
        if (powerUpType === PowerUpType.COPY) next.copyRemaining--;
        if (powerUpType === PowerUpType.DOUBLE) next.doubleRemaining--;
        const usedSet = new Set(next.usedThisQuestion);
        usedSet.add(powerUpType);
        next.usedThisQuestion = usedSet;
        return next;
      });
    });

    // Clear selection
    setSelectedPowerUps(new Set());
    setCopiedPlayerId(null);
  }

  function toggleAnswer(answerId: string) {
    if (hasSubmitted) return;

    const newSelected = new Set(selectedAnswers);

    if (effectiveCurrentQuestion?.questionType === "SINGLE_SELECT") {
      // Single select - replace selection
      newSelected.clear();
      newSelected.add(answerId);
      // Emit power-ups before submitting answer
      emitPowerUps(effectiveCurrentQuestion.id);
      // Auto-submit for single select
      submitAnswer(effectiveCurrentQuestion.id, [answerId]);
      setHasSubmitted(true);
    } else {
      // Multi select - toggle
      if (newSelected.has(answerId)) {
        newSelected.delete(answerId);
      } else {
        newSelected.add(answerId);
      }
    }

    setSelectedAnswers(newSelected);
  }

  function handleSubmitMultiSelect() {
    if (!effectiveCurrentQuestion || hasSubmitted || selectedAnswers.size === 0) return;
    // Emit power-ups before submitting answer
    emitPowerUps(effectiveCurrentQuestion.id);
    submitAnswer(effectiveCurrentQuestion.id, Array.from(selectedAnswers));
    setHasSubmitted(true);
  }

  function handleEasterEggClick() {
    if (!effectiveCurrentQuestion || !socket) return;

    const questionId = effectiveCurrentQuestion.id;
    if (easterEggClicked.has(questionId)) return; // Already clicked

    // Emit socket event
    socket.emit("player:easterEggClick", {
      gameCode: gameCode.toUpperCase(),
      questionId,
    });

    // Open URL in new tab
    if (effectiveCurrentQuestion.easterEggUrl) {
      window.open(
        effectiveCurrentQuestion.easterEggUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }

    // Mark as clicked
    setEasterEggClicked((prev) => new Set(prev).add(questionId));
  }

  function handlePowerUpToggle(powerUpType: PowerUpType) {
    if (powerUpType === PowerUpType.HINT) {
      // Show hint modal - once selected, can't unselect
      if (!selectedPowerUps.has(PowerUpType.HINT)) {
        setShowHintModal(true);
        setSelectedPowerUps((prev) => {
          const next = new Set(prev);
          next.add(PowerUpType.HINT);
          return next;
        });
      }
    } else if (powerUpType === PowerUpType.COPY) {
      // Open player selector only if not already selected
      if (!selectedPowerUps.has(PowerUpType.COPY)) {
        setShowCopyPlayerSelector(true);
      }
    } else if (powerUpType === PowerUpType.DOUBLE) {
      // Toggle double points with visual feedback
      setSelectedPowerUps((prev) => {
        const next = new Set(prev);
        if (next.has(powerUpType)) {
          next.delete(powerUpType);
        } else {
          next.add(powerUpType);
        }
        return next;
      });
    }
  }

  function handleCopyPlayerSelected(selectedPlayerId: string) {
    setSelectedPowerUps((prev) => {
      const next = new Set(prev);
      next.add(PowerUpType.COPY);
      return next;
    });
    setCopiedPlayerId(selectedPlayerId);
    setShowCopyPlayerSelector(false);
  }

  // Player waiting for admission (pending status)
  if (joined && gameState && !gameState.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
    const theme = gameState?.quizTheme || joinTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2 border-yellow-500">
            <CardContent className="pt-6 text-center">
              <Bell className="w-12 h-12 mx-auto text-yellow-500 mb-4" />
              <p className="text-lg font-bold mb-2">{t("player.waitingAdmission")}</p>
              <p className="text-muted-foreground">
                {playerRemoved
                  ? t("player.waitingAdmissionRemovedDesc")
                  : t("player.waitingAdmissionDesc")}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animation-delay-200"></div>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animation-delay-400"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Admission refused
  if (admissionStatus === "refused") {
    const theme = gameState?.quizTheme || joinTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2 border-destructive">
            <CardContent className="pt-6 text-center">
              <UserX className="w-12 h-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-bold text-destructive mb-2">{t("player.admissionRefused")}</p>
              <p className="text-muted-foreground">
                {t("player.admissionRefusedDesc")}
              </p>
              <Button
                onClick={() => router.push("/play")}
                className="mt-6"
                variant="outline"
              >
                {t("player.joinAnotherGame")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Player removed (initial removal screen)
  if (playerRemoved && admissionStatus !== "admitted") {
    const theme = gameState?.quizTheme || joinTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2 border-destructive">
            <CardContent className="pt-6 text-center">
              <X className="w-12 h-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-bold text-destructive mb-2">{t("player.removedFromGame")}</p>
              <p className="text-muted-foreground">
                {removalReason || t("player.removedDesc")}
              </p>
              <Button
                onClick={() => router.push("/play")}
                className="mt-6"
                variant="outline"
              >
                {t("player.joinAnotherGame")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Game cancelled state
  if (gameCancelled) {
    const theme = gameState?.quizTheme || joinTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardContent className="pt-6 text-center">
              <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("player.gameCancelled")}</p>
              <p className="text-muted-foreground mt-2">{t("player.gameCancelledDesc")}</p>
              <Button onClick={() => router.push("/play")} className="mt-4">
                {t("player.joinAnotherGame")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <ThemeProvider theme={joinTheme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: joinTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={joinTheme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardContent className="pt-6 text-center">
              <X className="w-12 h-12 mx-auto text-destructive mb-4" />
              <p className="text-lg font-medium text-destructive">{error}</p>
              <Button onClick={() => router.push("/play")} className="mt-4">
                {t("player.tryAnotherCode")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Loading state while checking game
  if (!joined && gameStatus === "loading") {
    return (
      <ThemeProvider theme={joinTheme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: joinTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={joinTheme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardContent className="pt-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">{t("player.checkingGame")}</p>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Game not found
  if (!joined && gameStatus === "not_found") {
    return (
      <ThemeProvider theme={joinTheme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: joinTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={joinTheme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardContent className="pt-6 text-center">
              <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("player.gameNotFound")}</p>
              <p className="text-muted-foreground mt-2">
                {t("player.gameNotFoundDesc")}
              </p>
              <Button onClick={() => router.push("/play")} className="mt-4">
                {t("player.enterDifferentCode")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Game has ended or is in progress
  if (!joined && gameStatus === "ended") {
    return (
      <ThemeProvider theme={joinTheme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: joinTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={joinTheme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardContent className="pt-6 text-center">
              <X className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("player.gameHasEnded")}</p>
              <p className="text-muted-foreground mt-2">
                {t("player.gameEndedDesc")}
              </p>
              <Button onClick={() => router.push("/play")} className="mt-4">
                {t("player.joinAnotherGame")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  // Not joined yet - show name entry (only if game is valid)
  if (!joined) {
    return (
      <ThemeProvider theme={joinTheme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center p-4 relative"
          style={{
            background: joinTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={joinTheme} />
          <Card className="w-full max-w-sm relative z-10 shadow-2xl border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t("player.joinGame")}</CardTitle>
              <p className="text-muted-foreground font-mono text-lg">{gameCode}</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("player.yourName")}</label>
                  <Input
                    type="text"
                    placeholder={t("player.enterName")}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                    className="text-center text-lg h-12"
                    maxLength={20}
                    autoFocus
                    disabled={joining}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("player.chooseAvatar")}</label>

                  {/* Avatar Preview */}
                  {(avatarImage || selectedEmoji) && (
                    <div className="flex justify-center mb-2">
                      <div className="relative">
                        {avatarImage ? (
                          <img
                            src={avatarImage}
                            alt="Avatar"
                            className="w-16 h-16 rounded-full object-cover ring-2 ring-primary"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-3xl ring-2 ring-primary">
                            {selectedEmoji}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarImage(null);
                            setSelectedEmoji(null);
                          }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center text-xs hover:bg-destructive/80"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Upload Image Button */}
                  <div className="flex justify-center mb-2">
                    <label
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer
                        border-2 border-dashed border-muted-foreground/30 hover:border-primary
                        transition-colors
                        ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}
                        ${avatarImage ? "bg-primary/10 border-primary" : ""}
                      `}
                    >
                      {uploadingImage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span className="text-sm">
                        {uploadingImage ? "Uploading..." : avatarImage ? "Change Image" : "Upload Image"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={handleImageUpload}
                        disabled={joining || uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-center text-muted-foreground mb-2">or pick an emoji</p>

                  <div className="grid grid-cols-8 gap-2">
                    {avatarEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setSelectedEmoji(selectedEmoji === emoji ? null : emoji);
                          setAvatarImage(null); // Clear image when emoji is selected
                        }}
                        disabled={joining}
                        className={`
                          text-2xl p-2 rounded-lg transition-all
                          ${selectedEmoji === emoji && !avatarImage
                            ? "bg-primary/20 ring-2 ring-primary scale-110"
                            : "hover:bg-muted"
                          }
                        `}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language Selector */}
                {availableLanguages.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <LanguagesIcon className="w-4 h-4" />
                      Select Quiz Questions/Answer Language
                    </label>
                    <Select
                      value={selectedLanguage}
                      onValueChange={(value) => setSelectedLanguage(value as LanguageCode)}
                      disabled={joining}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {SupportedLanguages[selectedLanguage].flag} {SupportedLanguages[selectedLanguage].nativeName}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableLanguages.map((langCode) => (
                          <SelectItem key={langCode} value={langCode}>
                            <span className="flex items-center gap-2">
                              {SupportedLanguages[langCode].flag} {SupportedLanguages[langCode].nativeName}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {joinError && (
                  <p className="text-sm text-destructive text-center">
                    {joinError}
                  </p>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={joining}
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    "Join"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Application Language Selector at bottom left */}
          <div className="fixed bottom-4 left-4 z-20">
            <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden">
              <Select value={appLocale} onValueChange={(value) => setAppLocale(value as AppLocale)}>
                <SelectTrigger className="h-9 w-[130px] border-0 bg-transparent">
                  <Globe className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">🇬🇧 English</SelectItem>
                  <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                  <SelectItem value="sr">🇷🇸 Srpski</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Connecting
  if (!connected || !gameState) {
    const theme = joinTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen flex items-center justify-center relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="text-center relative z-10">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{t("player.connectingToGame")}</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Waiting for game to start
  if (gameState.status === "WAITING") {
    const playerAvatar = avatarImage || selectedEmoji;
    const theme = gameState.quizTheme;
    const powerUpConfig = gameState.powerUps || {
      hintCount: 0,
      copyAnswerCount: 0,
      doublePointsCount: 0,
    };
    const hasPowerUps =
      powerUpConfig.hintCount > 0 ||
      powerUpConfig.copyAnswerCount > 0 ||
      powerUpConfig.doublePointsCount > 0;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen relative overflow-hidden"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="text-center mb-8 space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-primary/80">{t("player.lobby")}</p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                {gameState.quizTitle || t("player.getReadyForQuiz")}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {t("player.lobbySubtitle")}
              </p>
            </div>

            <div className="grid lg:grid-cols-[1fr,1.15fr] gap-4 sm:gap-6 items-start">
              <Card className="border-2 shadow-2xl bg-card/80 backdrop-blur-sm">
                <CardContent className="p-6 sm:p-7 space-y-5">
                  <div className="flex flex-col items-center gap-4 text-center">
                    {playerAvatar ? (
                      playerAvatar.startsWith("/") ? (
                        <img
                          src={playerAvatar}
                          alt="Avatar"
                          className="w-20 h-20 rounded-full object-cover ring-2 ring-primary shadow-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center text-4xl ring-2 ring-primary/60 shadow-inner">
                          {playerAvatar}
                        </div>
                      )
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/60 shadow-inner">
                        <Check className="w-10 h-10 text-primary" />
                      </div>
                    )}
                    <div className="space-y-1">
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{t("player.youreIn")}</p>
                      <h2 className="text-2xl sm:text-3xl font-bold">{playerName}</h2>
                      <p className="text-muted-foreground">
                        {t("player.waitingForHost")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 text-left shadow-inner">
                      <p className="text-xs uppercase tracking-wide text-primary/80">{t("player.playersJoined")}</p>
                      <p className="text-2xl font-bold tabular-nums">
                        {gameState.players.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/70 px-4 py-3 text-left shadow-inner">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("player.roomCode")}</p>
                      <p className="text-2xl font-bold tabular-nums">{gameCode.toUpperCase()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4 sm:space-y-5">
                <div
                  className="rounded-2xl border border-border/70 shadow-xl overflow-hidden"
                  style={{
                    background: theme?.gradients?.sectionSlide || 'linear-gradient(135deg, hsl(262 83% 16%) 0%, hsl(262 83% 10%) 100%)',
                  }}
                >
                  <div className="p-6 sm:p-7 space-y-4 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-primary/80">{t("player.howToPlay")}</p>
                        <h3 className="text-xl sm:text-2xl font-semibold">{t("player.rulesScoring")}</h3>
                      </div>
                      <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center shadow-inner">
                        <Trophy className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <AlarmClock className="w-4 h-4" />
                          {t("player.beatTheClock")}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("player.beatTheClockDesc")}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Zap className="w-4 h-4" />
                          {t("player.speedBonus")}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("player.speedBonusDesc")}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Target className="w-4 h-4" />
                          {t("player.multiSelectFairness")}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("player.multiSelectFairnessDesc")}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/10 px-4 py-3 space-y-1 backdrop-blur-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Sparkles className="w-4 h-4" />
                          {t("player.finishStrong")}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {t("player.finishStrongDesc")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm shadow-xl">
                  <div className="p-6 sm:p-7 space-y-4">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        {t("player.powerUps")}
                      </p>
                    </div>

                    {hasPowerUps ? (
                      <div className="grid sm:grid-cols-3 gap-3">
                        {powerUpConfig.hintCount > 0 && (
                          <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              <Lightbulb className="w-4 h-4" />
                              {t("player.hint")}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t("player.hintDesc")}
                            </p>
                            <p className="text-xs font-medium text-primary">
                              {t("player.ready", { count: powerUpConfig.hintCount })}
                            </p>
                          </div>
                        )}

                        {powerUpConfig.copyAnswerCount > 0 && (
                          <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              <Users className="w-4 h-4" />
                              {t("player.copy")}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t("player.copyDesc")}
                            </p>
                            <p className="text-xs font-medium text-primary">
                              {t("player.ready", { count: powerUpConfig.copyAnswerCount })}
                            </p>
                          </div>
                        )}

                        {powerUpConfig.doublePointsCount > 0 && (
                          <div className="rounded-xl border border-border/60 bg-primary/10 px-4 py-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              <Sparkles className="w-4 h-4" />
                              {t("player.doublePoints")}
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {t("player.doublePointsDesc")}
                            </p>
                            <p className="text-xs font-medium text-primary">
                              {t("player.ready", { count: powerUpConfig.doublePointsCount })}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground text-center">
                        {t("player.noPowerUpsDesc")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Section view - players just see the section slide
  if (gameState.status === "SECTION" && effectiveCurrentQuestion) {
    const theme = gameState.quizTheme;
    return (
      <ThemeProvider theme={theme}>
            <div
              ref={screenRef}
              className="min-h-screen flex items-center justify-center p-4 relative"
              style={{
                background: theme?.gradients?.sectionSlide || 'linear-gradient(135deg, hsl(0 0% 35%) 0%, hsl(0 0% 25%) 100%)',
              }}
            >
              <BackgroundEffects theme={theme} />
              <div className="text-center text-white relative z-10 px-4 max-w-2xl mx-auto">
                <Layers className="w-12 h-12 mx-auto mb-4 opacity-80" />
                <h1 className="text-3xl font-bold mb-4">
                  {getTranslatedContent(
                    effectiveCurrentQuestion.questionText,
                    effectiveCurrentQuestion.translations,
                    "questionText"
                  )}
                </h1>
                {effectiveCurrentQuestion.hostNotes && (
                  <p className="text-lg opacity-90 mb-6">
                    {getTranslatedContent(
                      effectiveCurrentQuestion.hostNotes,
                      effectiveCurrentQuestion.translations,
                      "hostNotes"
                    )}
                  </p>
                )}
            {effectiveCurrentQuestion.imageUrl && (
              <img
                src={effectiveCurrentQuestion.imageUrl}
                alt="Section"
                className="max-h-48 mx-auto rounded-xl shadow-lg mb-6"
              />
            )}
            <p className="text-sm opacity-70">
              {t("player.waitingHostContinue")}
            </p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Question view
  if (
    gameState.status === "QUESTION" ||
    (gameState.status === "REVEALING" && effectiveCurrentQuestion)
  ) {
    const isRevealing = gameState.status === "REVEALING";
    const correctIds = questionEnded?.correctAnswerIds || [];
    const theme = gameState.quizTheme;

    if (isRevealing && awaitingReveal) {
      return (
        <ThemeProvider theme={theme}>
          <BackgroundEffects theme={theme} />
          <div
            ref={screenRef}
            className="min-h-screen flex flex-col items-center justify-center text-center px-6"
            style={{
              background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
            }}
          >
            <div className="flex flex-col items-center gap-4 text-amber-200">
              <AlarmClock className="w-14 h-14 animate-bounce" />
              <h2 className="text-3xl font-bold text-white">{t("player.timesUp")}</h2>
              <p className="text-lg text-amber-100/80 max-w-xl">
                {t("player.timesUpDesc")}
              </p>
            </div>
          </div>
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider theme={theme}>
        <BackgroundEffects theme={theme} />
        <div
          ref={screenRef}
          className="min-h-screen flex flex-col overflow-x-hidden"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          {/* Top bar: Timer only - more prominent (hidden during reveal) */}
          {!isRevealing && (
            <div className="px-3 sm:px-6 pt-3 sm:pt-4">
              <div className="flex flex-col gap-2 rounded-xl bg-card/80 backdrop-blur-sm border border-border/60 px-4 py-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t("player.questionOf", { current: gameState.currentQuestionNumber, total: gameState.totalQuestions })}
                  </span>
                  <div className={`
                    flex items-center gap-2 px-3 py-1 rounded-full font-bold text-lg tabular-nums
                    ${timeRemaining <= 5
                      ? "bg-red-500/20 text-red-500 animate-pulse"
                      : timeRemaining <= 10
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-primary/20 text-primary"}
                  `}>
                    <AlarmClock className="w-4 h-4" />
                    {timeRemaining}s
                  </div>
                </div>
                {effectiveCurrentQuestion && (
                  <Progress
                    value={(timeRemaining / effectiveCurrentQuestion.timeLimit) * 100}
                    className={`h-2.5 ${timeRemaining <= 5 ? "[&>div]:bg-red-500" : timeRemaining <= 10 ? "[&>div]:bg-amber-500" : ""}`}
                  />
                )}
              </div>
            </div>
          )}

          {/* Question */}
          <div className="px-3 sm:px-8 py-3 sm:py-4">
            <h2 className="text-lg sm:text-xl font-bold text-center mb-2 leading-tight">
              {getTranslatedContent(
                effectiveCurrentQuestion?.questionText,
                effectiveCurrentQuestion?.translations,
                "questionText"
              )}
            </h2>
            {effectiveCurrentQuestion?.imageUrl && (
              <img
                src={effectiveCurrentQuestion.imageUrl}
                alt="Question"
                className="max-h-24 sm:max-h-32 w-auto mx-auto rounded-lg mb-3 sm:mb-4"
              />
            )}
            {effectiveCurrentQuestion?.questionType === "MULTI_SELECT" && !hasSubmitted && (
              <p className="text-xs sm:text-sm text-center text-muted-foreground mb-2">
                {t("player.selectAllThatApply")}
              </p>
            )}
          </div>

          {/* Answer Result (shown during revealing) */}
          {isRevealing && answerResult && (
            <div
              className={`mx-8 p-4 rounded-lg text-center mb-4 ${
                answerResult.correct
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              <p className="text-2xl font-bold">
                {answerResult.correct ? t("player.correct") : t("player.wrong")}
              </p>
              <p className="text-lg">{t("player.pointsValue", { points: answerResult.points })}</p>
              <p className="text-sm">{t("player.position", { position: answerResult.position })}</p>
            </div>
          )}

          {/* Power-ups Section */}
          {gameState.status === "QUESTION" && !hasSubmitted && (powerUpState.hintsRemaining > 0 || powerUpState.copyRemaining > 0 || powerUpState.doubleRemaining > 0) && (
            <div className="px-3 sm:px-8 py-3 sm:py-4 border-t border-border">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <Zap className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">{t("player.powerUps")}</span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {/* Hint Power-up */}
                {powerUpState.hintsRemaining > 0 && (
                  <Button
                    variant={selectedPowerUps.has(PowerUpType.HINT) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePowerUpToggle(PowerUpType.HINT)}
                    disabled={powerUpState.usedThisQuestion.has(PowerUpType.HINT)}
                    className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                  >
                    <Lightbulb className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                    <span className="text-[10px] sm:text-xs">{t("player.hint")}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      {t("player.left", { count: powerUpState.hintsRemaining })}
                    </span>
                  </Button>
                )}

                {/* Copy Answer Power-up */}
                {powerUpState.copyRemaining > 0 && (
                  <Button
                    variant={selectedPowerUps.has(PowerUpType.COPY) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePowerUpToggle(PowerUpType.COPY)}
                    disabled={powerUpState.usedThisQuestion.has(PowerUpType.COPY)}
                    className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                  >
                    <Users className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                    <span className="text-[10px] sm:text-xs">{t("player.copy")}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      {t("player.left", { count: powerUpState.copyRemaining })}
                    </span>
                  </Button>
                )}

                {/* Double Points Power-up */}
                {powerUpState.doubleRemaining > 0 && (
                  <Button
                    variant={selectedPowerUps.has(PowerUpType.DOUBLE) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePowerUpToggle(PowerUpType.DOUBLE)}
                    disabled={powerUpState.usedThisQuestion.has(PowerUpType.DOUBLE)}
                    className="flex flex-col h-auto py-2 px-1 sm:px-2 min-h-[68px] sm:min-h-[76px]"
                  >
                    <Sparkles className="w-5 h-5 sm:w-5 sm:h-5 mb-0.5 sm:mb-1" />
                    <span className="text-[10px] sm:text-xs">2x</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                      {t("player.left", { count: powerUpState.doubleRemaining })}
                    </span>
                  </Button>
                )}
              </div>

              {/* Active Power-ups Feedback */}
              {(selectedPowerUps.has(PowerUpType.HINT) || selectedPowerUps.has(PowerUpType.COPY) || selectedPowerUps.has(PowerUpType.DOUBLE)) && (
                <div className="mt-3 space-y-2">
                  {/* {t("player.hintActive")} Badge */}
                  {selectedPowerUps.has(PowerUpType.HINT) && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                          {t("player.hintActive")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Copy Confirmation */}
                  {selectedPowerUps.has(PowerUpType.COPY) && copiedPlayerId && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
                          {gameState.players.find(p => p.id === copiedPlayerId)?.name
                            ? t("player.copyActive", { name: gameState.players.find(p => p.id === copiedPlayerId)?.name ?? "" })
                            : t("player.copyActiveDefault")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Double Points Confirmation */}
                  {selectedPowerUps.has(PowerUpType.DOUBLE) && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                          {t("player.doubleActive")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Answers */}
          <div className="flex-1 px-3 sm:px-8 py-3 sm:py-4 space-y-2 sm:space-y-3">
            {effectiveCurrentQuestion?.answers.map((answer, index) => {
              const isSelected = selectedAnswers.has(answer.id);
              const isCorrect = correctIds.includes(answer.id);
              const wasSelected = isSelected;

              // Determine background color and styling
              let background: string;
              let textColor: string;
              let additionalStyles: React.CSSProperties = {};

              // Get the base answer color (hex) for text color calculation
              const answerColorHex = getAnswerColor(gameState.quizTheme, index);

              // Apply theme border radius and shadow
              const borderRadius = gameState.quizTheme?.effects?.borderRadius
                ? BORDER_RADIUS_MAP[gameState.quizTheme.effects.borderRadius]
                : BORDER_RADIUS_MAP.lg;
              const boxShadow = gameState.quizTheme?.effects?.shadow
                ? SHADOW_MAP[gameState.quizTheme.effects.shadow]
                : SHADOW_MAP.md;

              additionalStyles.borderRadius = borderRadius;
              additionalStyles.boxShadow = boxShadow;
              additionalStyles.transformOrigin = 'center';
              additionalStyles.willChange = 'transform';

              if (isRevealing) {
                if (isCorrect) {
                  background = gameState.quizTheme?.gradients?.correctAnswer || "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
                  additionalStyles.boxShadow = `0 0 0 4px rgba(34, 197, 94, 0.3), ${boxShadow}`;
                  textColor = "0 0% 100%"; // White text on green gradient
                } else if (wasSelected && !isCorrect) {
                  background = gameState.quizTheme?.gradients?.wrongAnswer || "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
                  additionalStyles.opacity = 0.5;
                  textColor = "0 0% 100%"; // White text on red gradient
                } else {
                  background = "#9ca3af"; // gray-400
                  additionalStyles.opacity = 0.5;
                  textColor = "0 0% 100%"; // White text on gray
                }
              } else if (hasSubmitted) {
                if (isSelected) {
                  background = answerColorHex;
                  const selectedStyle = getSelectedAnswerStyle(gameState.quizTheme, true);
                  Object.assign(additionalStyles, selectedStyle);
                  textColor = getContrastingTextColor(answerColorHex);
                } else {
                  background = "#9ca3af"; // gray-400
                  additionalStyles.opacity = 0.5;
                  textColor = "0 0% 100%"; // White text on gray
                }
              } else if (isSelected) {
                background = answerColorHex;
                const selectedStyle = getSelectedAnswerStyle(gameState.quizTheme, true);
                Object.assign(additionalStyles, selectedStyle);
                textColor = getContrastingTextColor(answerColorHex);
              } else {
                background = answerColorHex;
                textColor = getContrastingTextColor(answerColorHex);
              }

              return (
                <div key={answer.id} className="px-0.5 sm:px-1">
                  <button
                    onClick={() => toggleAnswer(answer.id)}
                    disabled={hasSubmitted || isRevealing}
                    className={`
                      w-full p-3 sm:p-4 text-base sm:text-lg font-medium
                      transition-all duration-200 flex items-center gap-2 sm:gap-3
                      min-h-[52px] sm:min-h-[60px]
                      ${!hasSubmitted && !isRevealing ? "active:scale-[0.98]" : ""}
                    `}
                  style={{
                    background,
                    maxWidth: '100%',
                    color: `hsl(${textColor})`,
                    ...additionalStyles,
                  }}
                >
                  <span className="font-bold text-lg sm:text-xl shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                    <span className="flex-1 text-left break-words hyphens-auto leading-tight">
                      {getTranslatedContent(
                        answer.answerText,
                        answer.translations,
                        "answerText"
                      )}
                    </span>
                    {isRevealing && isCorrect && <Check className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />}
                    {isRevealing && wasSelected && !isCorrect && (
                      <X className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Submit button for multi-select */}
          {effectiveCurrentQuestion?.questionType === "MULTI_SELECT" &&
            !hasSubmitted &&
            !isRevealing && (
              <div className="px-8 py-4 border-t">
                <Button
                  onClick={handleSubmitMultiSelect}
                  disabled={selectedAnswers.size === 0}
                  size="lg"
                  className="w-full"
                >
                  {t("player.submitAnswer", { count: selectedAnswers.size })}
                </Button>
              </div>
            )}

          {/* Easter Egg Button */}
          {!isRevealing &&
            gameState.status === "QUESTION" &&
            effectiveCurrentQuestion?.easterEggEnabled &&
            effectiveCurrentQuestion.easterEggButtonText &&
            effectiveCurrentQuestion.easterEggUrl && (
              <div className="px-8 py-3">
                <Button
                  onClick={handleEasterEggClick}
                  disabled={easterEggClicked.has(effectiveCurrentQuestion.id)}
                  variant="outline"
                  className="w-full border-2 border-dashed"
                >
                  {easterEggClicked.has(effectiveCurrentQuestion.id) ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {t("player.clicked")}
                    </>
                  ) : (
                    <>
                      {getTranslatedContent(
                        effectiveCurrentQuestion.easterEggButtonText,
                        effectiveCurrentQuestion.translations,
                        "easterEggButtonText"
                      )}
                    </>
                  )}
                </Button>
              </div>
            )}

          {/* Waiting message after submit */}
          {hasSubmitted && !isRevealing && (
            <div className="px-8 py-4 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              {t("player.waitingForTime")}
            </div>
          )}

          {/* Collapsible Quiz Content Language Selector at bottom right */}
          {availableLanguages.length > 1 && (
            <div className="fixed bottom-4 right-4 z-20">
              <div className={`
                bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg
                transition-all duration-200 overflow-hidden origin-bottom-right
                ${showLanguageSelector ? "w-64 max-h-[70vh] overflow-y-auto" : "w-auto"}
              `}>
                {showLanguageSelector ? (
                  <div className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{t("player.quizLanguage")}</span>
                      <button
                        onClick={() => setShowLanguageSelector(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {availableLanguages.map((langCode) => (
                        <button
                          key={langCode}
                          onClick={() => {
                            setSelectedLanguage(langCode);
                            setShowLanguageSelector(false);
                          }}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                            transition-colors
                            ${selectedLanguage === langCode
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"}
                          `}
                        >
                          <span>{SupportedLanguages[langCode].flag}</span>
                          <span className="truncate">{SupportedLanguages[langCode].nativeName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLanguageSelector(true)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{SupportedLanguages[selectedLanguage].flag}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hint Modal */}
        <Dialog open={showHintModal} onOpenChange={setShowHintModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5" />
                Hint
              </DialogTitle>
            </DialogHeader>
            <div className="py-6">
              <p className="text-lg">
                {getTranslatedContent(
                  effectiveCurrentQuestion?.hint,
                  effectiveCurrentQuestion?.translations,
                  "hint"
                )}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowHintModal(false)}>{t("player.close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Copy Player Selector Dialog */}
        <Dialog open={showCopyPlayerSelector} onOpenChange={setShowCopyPlayerSelector}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Copy Answer
              </DialogTitle>
              <DialogDescription>
                Select a player to copy their answer. This is a blind copy - you won't see their choice.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
              {gameState?.players
                .filter(p => p.name !== playerName && p.isActive)
                .map(player => (
                  <Button
                    key={player.id}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleCopyPlayerSelected(player.id)}
                  >
                    <div className="flex items-center gap-2">
                      {player.avatarEmoji?.startsWith("/") ? (
                        <img
                          src={player.avatarEmoji}
                          alt={player.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: player.avatarColor }}
                        >
                          {player.avatarEmoji || player.name[0]}
                        </div>
                      )}
                      <span>{player.name}</span>
                    </div>
                  </Button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </ThemeProvider>
    );
  }

  // Scoreboard
  if (gameState.status === "SCOREBOARD" || gameState.status === "FINISHED") {
    const isFinished = gameState.status === "FINISHED";
    const displayScores =
      scores.length > 0
        ? scores
        : gameState.players.map((p, i) => ({
            ...p,
            playerId: p.id,
            position: i + 1,
            change: 0,
          }));

    const myScore = displayScores.find(
      (s) => s.name.toLowerCase() === playerName.toLowerCase()
    );
    const myPosition = myScore?.position || 0;
    const showGeneratingMessage =
      certificateState === "checking" || certificateState === "generating";

    const theme = gameState.quizTheme;
    return (
      <ThemeProvider theme={theme}>
        <div
          ref={screenRef}
          className="min-h-screen p-3 sm:p-4 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          {/* My Position */}
          <Card className="mb-4 sm:mb-6 relative z-10 shadow-xl border-2">
            <CardContent className="pt-4 sm:pt-6 text-center">
              {myPosition <= 3 && isFinished && (
                <div className="mb-2">
                  {myPosition === 1 && (
                    <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-yellow-500" />
                  )}
                  {myPosition === 2 && (
                    <Medal className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-400" />
                  )}
                  {myPosition === 3 && (
                    <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-amber-600" />
                  )}
                </div>
              )}
              <p className="text-3xl sm:text-4xl font-bold text-primary">#{myPosition}</p>
              <p className="text-base sm:text-lg font-medium truncate max-w-full px-2">{playerName}</p>
              <p className="text-xl sm:text-2xl font-bold mt-2">{myScore?.score || 0} pts</p>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <h2 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 relative z-10">
            {isFinished ? "Final Results" : "Leaderboard"}
          </h2>
          <div className="space-y-1.5 sm:space-y-2 relative z-10">
            {displayScores.slice(0, 10).map((player, index) => {
              const isMe =
                player.name.toLowerCase() === playerName.toLowerCase();
              return (
                <div
                  key={player.playerId}
                  className={`
                    flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg shadow-lg
                    ${isMe ? "bg-primary/10 ring-2 ring-primary" : "bg-card"}
                  `}
                >
                  <span className="font-bold w-5 sm:w-6 text-center text-sm sm:text-base">{index + 1}</span>
                  {player.avatarEmoji?.startsWith("/") ? (
                    <img
                      src={player.avatarEmoji}
                      alt={player.name}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <Avatar className="w-7 h-7 sm:w-8 sm:h-8 shrink-0">
                      <AvatarFallback
                        style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                        className={player.avatarEmoji ? "text-lg sm:text-xl" : "text-white text-xs"}
                      >
                        {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className={`flex-1 truncate text-sm sm:text-base ${isMe ? "font-bold" : ""}`}>
                    {player.name}
                    {isMe && " (You)"}
                  </span>

                  {/* Power-up indicators */}
                  {"powerUpsUsed" in player && player.powerUpsUsed && player.powerUpsUsed.length > 0 && (
                    <div className="flex gap-0.5 sm:gap-1 shrink-0">
                      {player.powerUpsUsed.slice(0, 3).map((usage: { powerUpType: PowerUpType; questionNumber: number }, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 bg-muted rounded"
                          title={`Q${usage.questionNumber}: ${usage.powerUpType}`}
                        >
                          {usage.powerUpType === "hint" && "💡"}
                          {usage.powerUpType === "copy" && "👥"}
                          {usage.powerUpType === "double" && "⚡"}
                        </span>
                      ))}
                      {player.powerUpsUsed.length > 3 && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground">+{player.powerUpsUsed.length - 3}</span>
                      )}
                    </div>
                  )}

                  <span className="font-bold text-primary text-sm sm:text-base shrink-0">{player.score}</span>
                </div>
              );
            })}
          </div>

          {isFinished && (
            <div className="mt-6 sm:mt-8 text-center space-y-3 sm:space-y-4 relative z-10">
              <p className="text-sm sm:text-base text-muted-foreground">{t("player.thanksForPlaying")}</p>

              {showGeneratingMessage && (
                <div className="flex items-center justify-center gap-2 text-sm sm:text-base text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t("player.generatingCertificate")}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-center sm:items-center gap-3 sm:gap-4">
                {/* Download Button */}
                <CertificateDownloadButton
                  gameCode={gameCode}
                  playerId={playerId}
                  playerName={playerName}
                  type="player"
                  className={`w-full sm:w-auto ${showGeneratingMessage ? "hidden" : ""}`}
                  onStateChange={setCertificateState}
                />

                <Button
                  size="lg"
                  className="w-full sm:w-auto"
                  onClick={() => router.push("/play")}
                >
                  Play Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </ThemeProvider>
    );
  }

  // Default loading state
  const theme = gameState?.quizTheme || joinTheme;
  return (
    <ThemeProvider theme={theme}>
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <div className="relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    </ThemeProvider>
  );
}
