"use client";

import { use, useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "@/hooks/useSocket";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Check, Trophy, Medal, Award, Layers, Loader2, AlarmClock } from "lucide-react";
import { ThemeProvider, getAnswerColor } from "@/components/theme/ThemeProvider";
import { BackgroundEffects } from "@/components/theme/BackgroundEffects";
import { AspectRatioHelper } from "@/components/display/AspectRatioHelper";
import { BORDER_RADIUS_MAP, SHADOW_MAP } from "@/types/theme";
import { getContrastingTextColor } from "@/lib/color-utils";
import { SupportedLanguages } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";
import {
  isCategoriseType,
  isMatchingType,
  parseCategoriseData,
  parseMatchingData,
  type CategoriseData,
  type MatchingData,
} from "@/lib/question-types";

export default function HostDisplayPage({
  params,
}: {
  params: Promise<{ gameCode: string }>;
}) {
  const { gameCode } = use(params);
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState("");
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [urlReady, setUrlReady] = useState(false);

  // Poll for tunnel URL - keeps checking until we get an external URL
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    async function detectUrl() {
      // Check for active tunnel
      try {
        const res = await fetch("/api/tunnel");
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setBaseUrl(data.url);
            // Stop polling once we have a tunnel URL
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            return true;
          }
        }
      } catch {
        // Tunnel not available
      }
      return false;
    }

    async function init() {
      const found = await detectUrl();

      if (!found) {
        // No tunnel yet - set localhost as fallback and start polling
        if (typeof window !== "undefined") {
          setBaseUrl(window.location.origin);
        }

        // Poll every 2 seconds for tunnel URL
        intervalId = setInterval(detectUrl, 2000);
      }
    }

    init();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  // Attempt to shorten URL when baseUrl changes
  useEffect(() => {
    if (!baseUrl) return;

    let timeoutId: NodeJS.Timeout;

    async function attemptShorten() {
      const fullUrl = `${baseUrl}/play/${gameCode}`;

      try {
        const res = await fetch("/api/shorten", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fullUrl, gameCode }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.shortUrl) {
            setShortUrl(data.shortUrl);
          }
        }
      } catch (error) {
        console.error("Failed to shorten URL:", error);
        // Fallback to full URL (shortUrl remains null)
      } finally {
        setUrlReady(true);
      }
    }

    // Set a timeout to show URL even if shortening takes too long
    timeoutId = setTimeout(() => {
      setUrlReady(true);
    }, 3000);

    attemptShorten();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [baseUrl, gameCode]);

  const {
    connected,
    gameState,
    currentQuestion,
    timeRemaining,
    scores,
    questionEnded,
    awaitingReveal,
    gameCancelled,
  } = useSocket({ gameCode, role: "host" });

  // Close window when game is cancelled
  useEffect(() => {
    if (gameCancelled) {
      window.close();
    }
  }, [gameCancelled]);

  // For loading states, we need to fetch theme first
  const [loadingTheme, setLoadingTheme] = useState<any>(null);
  const [themeFetched, setThemeFetched] = useState(false);

  useEffect(() => {
    async function fetchTheme() {
      try {
        const res = await fetch(`/api/games/${gameCode}`);
        if (res.ok) {
          const data = await res.json();
          setLoadingTheme(data.quizTheme);
        }
      } catch {
        // Theme fetch failed, will use default
      } finally {
        setThemeFetched(true);
      }
    }

    if (!connected || !gameState) {
      fetchTheme();
    }
  }, [connected, gameState, gameCode]);

  if (!connected) {
    return (
      <ThemeProvider theme={loadingTheme}>
        <div
          className="min-h-screen flex items-center justify-center relative"
          style={{
            background: loadingTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={loadingTheme} />
          <div className="text-center relative z-10">
            <div className="animate-pulse text-2xl font-bold text-primary">
              Connecting...
            </div>
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  if (!gameState) {
    return (
      <ThemeProvider theme={loadingTheme}>
        <div
          className="min-h-screen flex items-center justify-center relative"
          style={{
            background: loadingTheme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={loadingTheme} />
          <div className="text-center relative z-10">
            <div className="text-2xl font-bold text-muted-foreground">
              Loading game...
            </div>
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  // Waiting Room
  if (gameState.status === "WAITING") {
    const fullUrl = `${baseUrl}/play/${gameCode}`;
    // Use short URL if available, otherwise fallback to full URL
    const joinUrl = shortUrl || fullUrl;
    const theme = gameState.quizTheme;

    // Don't show URL/QR code until we've attempted to get short URL
    const showJoinInfo = urlReady && baseUrl;

    return (
      <ThemeProvider theme={theme}>
        <div
          className="min-h-screen p-6 md:p-8 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="max-w-5xl mx-auto relative z-10 h-full flex flex-col">
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-2">
                {gameState.quizTitle}
              </h1>
              <div className="flex items-center justify-center gap-2 text-lg md:text-xl text-muted-foreground">
                <span>{t("host.waitingForPlayers")}</span>
                <span className="flex gap-1">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </div>
            </div>

            {/* QR Code & Code - side by side on large screens */}
            {showJoinInfo ? (
              <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 mb-8 md:mb-12">
                <Card className="p-6 md:p-8 bg-white shadow-2xl">
                  <QRCodeSVG
                    value={joinUrl}
                    size={280}
                    level="M"
                    className="w-[200px] md:w-[280px] lg:w-[320px] h-auto"
                  />
                </Card>
                <div className="text-center lg:text-left">
                  <p className="text-sm md:text-base text-muted-foreground mb-3">{t("host.scanQrOrEnterCode")}</p>
                  <p className="text-5xl md:text-6xl lg:text-7xl font-mono font-bold tracking-widest text-primary">
                    {gameCode}
                  </p>
                  <p className="text-sm md:text-base text-muted-foreground mt-4 max-w-xs break-all">
                    <span className="font-medium">{joinUrl}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-12">
                <Loader2 className="w-16 h-16 animate-spin text-primary" />
              </div>
            )}

            {/* Players */}
            <div className="flex-1">
              <div className="flex items-center justify-center gap-3 mb-4">
                <h2 className="text-xl md:text-2xl font-semibold">
                  Players
                </h2>
                <span className="bg-primary text-primary-foreground text-lg font-bold px-3 py-1 rounded-full">
                  {gameState.players.length}
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2.5 bg-card rounded-full px-4 md:px-5 py-2 md:py-2.5 shadow-md border border-border/50 animate-in fade-in slide-in-from-bottom-2"
                  >
                    {player.avatarEmoji?.startsWith("/") ? (
                      <img
                        src={player.avatarEmoji}
                        alt={player.name}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                      />
                    ) : (
                      <Avatar className="w-8 h-8 md:w-10 md:h-10">
                        <AvatarFallback
                          style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                          className={player.avatarEmoji ? "text-2xl md:text-3xl" : "text-white text-sm md:text-base font-medium"}
                        >
                          {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="font-medium text-base md:text-lg">
                      {player.name}
                    </span>
                  </div>
                ))}
                {gameState.players.length === 0 && (
                  <p className="text-muted-foreground text-lg">
                    Scan the QR code to join!
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  // Section View
  if (gameState.status === "SECTION" && currentQuestion) {
    const theme = gameState.quizTheme;

    return (
      <ThemeProvider theme={theme}>
        <div
          className="min-h-screen flex items-center justify-center p-8 relative"
          style={{
            background: theme?.gradients?.sectionSlide || 'linear-gradient(135deg, hsl(0 0% 35%) 0%, hsl(0 0% 25%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="max-w-4xl mx-auto text-center text-white relative z-10 px-4">
            <div className="mb-8">
              <Layers className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 opacity-80" />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {currentQuestion.questionText}
            </h1>
            {currentQuestion.hostNotes && (
              <p className="text-lg md:text-xl lg:text-2xl opacity-90 mb-8">
                {currentQuestion.hostNotes}
              </p>
            )}
            {currentQuestion.imageUrl && (
              <img
                src={currentQuestion.imageUrl}
                alt={t("host.section")}
                className="max-h-80 mx-auto rounded-xl shadow-2xl"
              />
            )}
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  // Question View
  if (gameState.status === "QUESTION" || gameState.status === "REVEALING") {
    const isRevealing = gameState.status === "REVEALING";
    const correctIds = questionEnded?.correctAnswerIds || [];
    const theme = gameState.quizTheme;

    if (isRevealing && awaitingReveal) {
      return (
        <ThemeProvider theme={theme}>
          <BackgroundEffects theme={theme} />
          <div
            className="min-h-screen flex flex-col items-center justify-center text-center px-6"
            style={{
              background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
            }}
          >
            <div className="flex flex-col items-center gap-4 text-amber-200">
              <AlarmClock className="w-14 h-14 animate-bounce" />
              <h2 className="text-4xl font-bold text-white">{t("player.timesUp")}</h2>
              <p className="text-lg text-amber-100/80 max-w-xl">
                The host will reveal the answers shortly.
              </p>
            </div>
          </div>
          <AspectRatioHelper />
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider theme={theme}>
        <div
          className="min-h-screen p-8 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="max-w-5xl mx-auto relative z-10 px-4">
            {/* Progress */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <Badge variant="secondary" className="text-sm md:text-base lg:text-lg px-3 md:px-4 py-1">
                Question {gameState.currentQuestionNumber} of{" "}
                {gameState.totalQuestions}
              </Badge>
              {!isRevealing && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary">
                    {timeRemaining}
                  </span>
                  <span className="text-sm md:text-base text-muted-foreground">seconds</span>
                </div>
              )}
            </div>

            {/* Timer Bar */}
            {!isRevealing && currentQuestion && (
              <Progress
                value={(timeRemaining / currentQuestion.timeLimit) * 100}
                className="h-2 mb-8"
              />
            )}

            {/* Question */}
            {currentQuestion && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4">
                    {currentQuestion.questionText}
                  </h2>
                  {currentQuestion.imageUrl && (
                    <img
                      src={currentQuestion.imageUrl}
                      alt={t("player.question")}
                      className="max-h-64 mx-auto rounded-lg shadow-lg"
                    />
                  )}
                </div>

            {currentQuestion && (() => {
              const isStructuredCategorise =
                isCategoriseType(currentQuestion.questionType);
              const isStructuredMatching =
                isMatchingType(currentQuestion.questionType);

              if (isStructuredCategorise) {
                const data = parseCategoriseData(
                  currentQuestion.categoriseData as CategoriseData | string | null | undefined
                );
                if (!data) return null;
                const correctCatForItem =
                  (itemId: string) => questionEnded?.correctCategorise?.[itemId];
                return (
                  <div className="space-y-6">
                    {/* Categories legend */}
                    <div className="flex flex-wrap gap-2 justify-center">
                      {data.categories.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-3 py-1 rounded-full bg-primary/15 text-primary text-sm md:text-base font-semibold"
                        >
                          {cat.label}
                        </span>
                      ))}
                    </div>
                    {/* Items with correct category highlighted during reveal */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {data.items.map((item, index) => {
                        const correctCatId = isRevealing
                          ? correctCatForItem(item.id)
                          : undefined;
                        const correctCatLabel =
                          correctCatId &&
                          data.categories.find((c) => c.id === correctCatId)?.label;
                        return (
                          <div
                            key={item.id}
                            className={`p-4 md:p-5 rounded-lg border ${
                              isRevealing && correctCatId
                                ? "border-green-500 bg-green-500/10"
                                : "border-border bg-card"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-base md:text-lg font-semibold">
                                {item.label}
                              </span>
                              {isRevealing && correctCatId && (
                                <Check className="w-6 h-6 text-green-600 shrink-0" />
                              )}
                            </div>
                            {isRevealing && correctCatLabel ? (
                              <p className="text-sm text-green-600">
                                {t("host.correctCategory")}:{" "}
                                <strong>{correctCatLabel}</strong>
                              </p>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {t("host.assignToCategory")}
                              </p>
                            )}
                            {/* Per-item correctness stat */}
                            {isRevealing &&
                              questionEnded?.stats.categorise && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {(() => {
                                    const stat = questionEnded.stats.categorise.find(
                                      (s) => s.itemId === item.id
                                    );
                                    return stat
                                      ? `${stat.correctCount}/${stat.total} ${t("host.correct")}`
                                      : "";
                                  })()}
                                </p>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              if (isStructuredMatching) {
                const data = parseMatchingData(
                  currentQuestion.matchingData as MatchingData | string | null | undefined
                );
                if (!data) return null;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    {data.pairs.map((pair) => {
                      const correctRightId = isRevealing
                        ? questionEnded?.correctMatching?.[pair.leftId]
                        : undefined;
                      const correctRightLabel =
                        correctRightId &&
                        data.pairs.find((p) => p.rightId === correctRightId)?.rightLabel;
                      return (
                        <div
                          key={pair.leftId}
                          className={`p-4 md:p-5 rounded-lg border ${
                            isRevealing && correctRightId
                              ? "border-green-500 bg-green-500/10"
                              : "border-border bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-base md:text-lg font-semibold">
                              {pair.leftLabel}
                            </span>
                            {isRevealing && correctRightId && (
                              <Check className="w-6 h-6 text-green-600 shrink-0" />
                            )}
                          </div>
                          {isRevealing && correctRightLabel ? (
                            <p className="text-sm text-green-600 mt-1">
                              {t("host.correctMatch")}:{" "}
                              <strong>{correctRightLabel}</strong>
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {t("host.matchWith")}
                            </p>
                          )}
                          {isRevealing &&
                            questionEnded?.stats.matching && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {(() => {
                                  const stat = questionEnded.stats.matching.find(
                                    (s) => s.leftId === pair.leftId
                                  );
                                  return stat
                                    ? `${stat.correctCount}/${stat.total} ${t("host.correct")}`
                                    : "";
                                })()}
                              </p>
                            )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Default: render answer options for SINGLE/MULTI/TRUE_FALSE.
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {currentQuestion.answers.map((answer, index) => {
                    const isCorrect = correctIds.includes(answer.id);
                    const answerCount =
                      questionEnded?.stats.answerDistribution[answer.id] || 0;

                    const borderRadius = gameState.quizTheme?.effects?.borderRadius
                      ? BORDER_RADIUS_MAP[gameState.quizTheme.effects.borderRadius]
                      : BORDER_RADIUS_MAP.lg;
                    const boxShadow = gameState.quizTheme?.effects?.shadow
                      ? SHADOW_MAP[gameState.quizTheme.effects.shadow]
                      : SHADOW_MAP.md;

                    const answerColorHex = getAnswerColor(gameState.quizTheme, index);
                    const textColor = getContrastingTextColor(answerColorHex);

                    return (
                      <div
                        key={answer.id}
                        className={`
                          ${isRevealing && !isCorrect ? "opacity-50" : ""}
                          p-4 md:p-5 lg:p-6 relative overflow-hidden
                          transition-all duration-300
                        `}
                        style={{
                          backgroundColor: answerColorHex,
                          color: `hsl(${textColor})`,
                          borderRadius,
                          boxShadow,
                        }}
                      >
                        <div className="flex items-center gap-2 md:gap-3">
                          <span className="text-lg md:text-xl lg:text-2xl font-bold shrink-0">
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="text-base md:text-lg lg:text-xl">{answer.answerText}</span>
                          {isRevealing && isCorrect && (
                            <Check className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8 ml-auto shrink-0" />
                          )}
                        </div>
                        {isRevealing && (
                          <div className="mt-2 text-sm opacity-80">
                            {answerCount} player{answerCount !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

                {/* Answer count */}
                {!isRevealing && (() => {
                  const activeAdmitted = gameState.players.filter(
                    (p) => p.isActive && p.admissionStatus === "admitted"
                  );
                  const answeredCount = activeAdmitted.filter((p) => p.hasAnswered).length;
                  return (
                    <div className="text-center text-muted-foreground">
                      {answeredCount} of {activeAdmitted.length} players answered
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  // Scoreboard
  if (gameState.status === "SCOREBOARD" || gameState.status === "FINISHED") {
    const isFinished = gameState.status === "FINISHED";
    const theme = gameState.quizTheme;
    const displayScores = scores.length > 0 ? scores : gameState.players.map((p, i) => ({
      ...p,
      playerId: p.id,
      position: i + 1,
      change: 0,
    }));

    return (
      <ThemeProvider theme={theme}>
        <div
          className="min-h-screen p-8 relative"
          style={{
            background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
          }}
        >
          <BackgroundEffects theme={theme} />
          <div className="max-w-3xl mx-auto relative z-10 px-4">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center mb-8">
              {isFinished ? t("host.finalResults") : t("host.scoreboard")}
            </h1>

            {/* Podium for final */}
            {isFinished && displayScores.length >= 3 && (
              <div className="flex justify-center items-end gap-1 sm:gap-2 md:gap-4 mb-8 md:mb-12 px-2">
                {/* 2nd Place */}
                <div className="text-center">
                  {displayScores[1]?.avatarEmoji?.startsWith("/") ? (
                    <img
                      src={displayScores[1].avatarEmoji}
                      alt={displayScores[1].name}
                      className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 rounded-full object-cover mx-auto mb-1 sm:mb-2"
                    />
                  ) : (
                    <Avatar className="w-10 sm:w-12 md:w-16 h-10 sm:h-12 md:h-16 mx-auto mb-1 sm:mb-2">
                      <AvatarFallback
                        style={{ backgroundColor: displayScores[1]?.avatarEmoji ? "transparent" : displayScores[1]?.avatarColor }}
                        className={displayScores[1]?.avatarEmoji ? "text-2xl sm:text-3xl md:text-4xl" : "text-white text-lg sm:text-xl md:text-2xl"}
                      >
                        {displayScores[1]?.avatarEmoji || displayScores[1]?.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <Medal className="w-6 sm:w-7 md:w-8 h-6 sm:h-7 md:h-8 mx-auto text-gray-400" />
                  <p className="font-bold text-xs sm:text-sm truncate max-w-[60px] sm:max-w-[80px] md:max-w-none mx-auto">{displayScores[1]?.name}</p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-primary">
                    {displayScores[1]?.score}
                  </p>
                  <div className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 bg-gray-300 rounded-t-lg mt-1 sm:mt-2" />
                </div>

                {/* 1st Place */}
                <div className="text-center">
                  {displayScores[0]?.avatarEmoji?.startsWith("/") ? (
                    <img
                      src={displayScores[0].avatarEmoji}
                      alt={displayScores[0].name}
                      className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 rounded-full object-cover mx-auto mb-1 sm:mb-2"
                    />
                  ) : (
                    <Avatar className="w-12 sm:w-16 md:w-20 h-12 sm:h-16 md:h-20 mx-auto mb-1 sm:mb-2">
                      <AvatarFallback
                        style={{ backgroundColor: displayScores[0]?.avatarEmoji ? "transparent" : displayScores[0]?.avatarColor }}
                        className={displayScores[0]?.avatarEmoji ? "text-3xl sm:text-4xl md:text-5xl" : "text-white text-xl sm:text-2xl md:text-3xl"}
                      >
                        {displayScores[0]?.avatarEmoji || displayScores[0]?.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <Trophy className="w-7 sm:w-8 md:w-10 h-7 sm:h-8 md:h-10 mx-auto text-yellow-500" />
                  <p className="font-bold text-sm sm:text-base truncate max-w-[60px] sm:max-w-[80px] md:max-w-none mx-auto">{displayScores[0]?.name}</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-primary">
                    {displayScores[0]?.score}
                  </p>
                  <div className="w-16 sm:w-20 md:w-24 h-20 sm:h-24 md:h-32 bg-yellow-400 rounded-t-lg mt-1 sm:mt-2" />
                </div>

                {/* 3rd Place */}
                <div className="text-center">
                  {displayScores[2]?.avatarEmoji?.startsWith("/") ? (
                    <img
                      src={displayScores[2].avatarEmoji}
                      alt={displayScores[2].name}
                      className="w-9 sm:w-11 md:w-14 h-9 sm:h-11 md:h-14 rounded-full object-cover mx-auto mb-1 sm:mb-2"
                    />
                  ) : (
                    <Avatar className="w-9 sm:w-11 md:w-14 h-9 sm:h-11 md:h-14 mx-auto mb-1 sm:mb-2">
                      <AvatarFallback
                        style={{ backgroundColor: displayScores[2]?.avatarEmoji ? "transparent" : displayScores[2]?.avatarColor }}
                        className={displayScores[2]?.avatarEmoji ? "text-xl sm:text-2xl md:text-3xl" : "text-white text-base sm:text-lg md:text-xl"}
                      >
                        {displayScores[2]?.avatarEmoji || displayScores[2]?.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <Award className="w-5 sm:w-6 md:w-7 h-5 sm:h-6 md:h-7 mx-auto text-amber-600" />
                  <p className="font-bold text-xs sm:text-sm truncate max-w-[60px] sm:max-w-[80px] md:max-w-none mx-auto">{displayScores[2]?.name}</p>
                  <p className="text-sm sm:text-base md:text-lg font-bold text-primary">
                    {displayScores[2]?.score}
                  </p>
                  <div className="w-16 sm:w-20 md:w-24 h-12 sm:h-14 md:h-16 bg-amber-600 rounded-t-lg mt-1 sm:mt-2" />
                </div>
              </div>
            )}

            {/* Full Leaderboard */}
            <div className="space-y-1.5 sm:space-y-2">
              {displayScores.map((player, index) => (
                <div
                  key={player.playerId}
                  className={`
                    flex items-center gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 rounded-lg bg-card
                    ${index === 0 ? "ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/20" : ""}
                  `}
                >
                  <span className="text-lg sm:text-xl md:text-2xl font-bold w-6 sm:w-8 text-center">
                    {index + 1}
                  </span>
                  {player.avatarEmoji?.startsWith("/") ? (
                    <img
                      src={player.avatarEmoji}
                      alt={player.name}
                      className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <Avatar className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 shrink-0">
                      <AvatarFallback
                        style={{ backgroundColor: player.avatarEmoji ? "transparent" : player.avatarColor }}
                        className={player.avatarEmoji ? "text-lg sm:text-xl md:text-2xl" : "text-white text-xs sm:text-sm"}
                      >
                        {player.avatarEmoji || player.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <span className="font-medium flex-1 flex items-center gap-1 sm:gap-1.5 truncate text-sm sm:text-base">
                    <span className="truncate">{player.name}</span>
                    {player.languageCode && player.languageCode !== "en" && (
                      <span
                        className="text-xs sm:text-sm shrink-0"
                        title={SupportedLanguages[player.languageCode]?.nativeName || player.languageCode}
                      >
                        {SupportedLanguages[player.languageCode]?.flag || ""}
                      </span>
                    )}
                  </span>

                  {/* Power-up indicators */}
                  {"powerUpsUsed" in player && player.powerUpsUsed && player.powerUpsUsed.length > 0 && (
                    <div className="hidden sm:flex gap-1 shrink-0">
                      {player.powerUpsUsed.slice(0, 5).map((usage, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-1 sm:px-1.5 py-0.5 bg-muted rounded"
                          title={`Q${usage.questionNumber}: ${usage.powerUpType}`}
                        >
                          {usage.powerUpType === "hint" && "💡"}
                          {usage.powerUpType === "copy" && "👥"}
                          {usage.powerUpType === "double" && "⚡"}
                        </span>
                      ))}
                    </div>
                  )}

                  {player.change !== 0 && (
                    <span
                      className={`text-xs sm:text-sm shrink-0 ${
                        player.change > 0 ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {player.change > 0 ? "↑" : "↓"}
                      {Math.abs(player.change)}
                    </span>
                  )}
                  <span className="text-base sm:text-lg md:text-xl font-bold text-primary shrink-0">
                    {player.score}
                  </span>
                </div>
              ))}
            </div>

            {isFinished && (
              <p className="text-center text-muted-foreground mt-8">
                Thanks for playing!
              </p>
            )}
          </div>
        </div>
        <AspectRatioHelper />
      </ThemeProvider>
    );
  }

  // Default / Loading state
  const theme = gameState.quizTheme;
  return (
    <ThemeProvider theme={theme}>
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          background: theme?.gradients?.pageBackground || 'linear-gradient(135deg, hsl(0 0% 25%) 0%, hsl(0 0% 15%) 100%)',
        }}
      >
        <BackgroundEffects theme={theme} />
        <div className="text-center relative z-10">
          <h1 className="text-3xl font-bold">{gameState.quizTitle}</h1>
          <p className="text-muted-foreground mt-2">{t("host.gameInProgress")}</p>
        </div>
      </div>
      <AspectRatioHelper />
    </ThemeProvider>
  );
}
