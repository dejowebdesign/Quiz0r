"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  GameState,
  QuestionData,
  PlayerScore,
  AnswerStats,
  PlayerAnswerDetail,
  EasterEggClickDetail,
  ServerToClientEvents,
  ClientToServerEvents,
  PowerUpType,
  LanguageCode,
  PlayerViewState,
} from "@/types";

interface NextQuestionPreview {
  section?: QuestionData | null;
  question: QuestionData | null;
  questionNumber: number | null;
  totalQuestions: number;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface UseSocketOptions {
  gameCode: string;
  role: "host" | "player";
  playerName?: string;
  languageCode?: LanguageCode;
  enabled?: boolean;  // Allow conditional connection
}

interface UseSocketReturn {
  socket: TypedSocket | null;
  connected: boolean;
  gameState: GameState | null;
  currentQuestion: QuestionData | null;
  timeRemaining: number;
  scores: PlayerScore[];
  answerResult: { correct: boolean; points: number; position: number } | null;
  questionEnded: {
    correctAnswerIds: string[];
    stats: AnswerStats;
    correctCategorise?: Record<string, string>;
    correctMatching?: Record<string, string>;
  } | null;
  awaitingReveal: boolean;
  playerAnswers: Map<string, PlayerAnswerDetail[]>; // questionId -> answers
  easterEggClicks: Map<string, EasterEggClickDetail[]>; // questionId -> clicks
  powerUpUsages: Map<string, Array<{ playerId: string; powerUpType: PowerUpType }>>; // questionId -> power-ups
  nextQuestionPreview: NextQuestionPreview | null;
  error: string | null;
  gameCancelled: boolean;
  playerRemoved: boolean;
  removalReason: string | null;
  admissionRequests: Array<{playerId: string; playerName: string}>;
  admissionStatus: "admitted" | "refused" | null;
  playerViews: Map<string, PlayerViewState>;
  // Actions
  startGame: () => void;
  nextQuestion: () => void;
  showScoreboard: () => void;
  endGame: () => void;
  skipTimer: () => void;
  revealAnswers: () => void;
  cancelGame: () => void;
  submitAnswer: (questionId: string, answerIds: string[]) => void;
  removePlayer: (playerId: string) => void;
  admitPlayer: (playerId: string) => void;
  refusePlayer: (playerId: string) => void;
  toggleAutoAdmit: (autoAdmit: boolean) => void;
  requestPlayerViews: () => void;
}

export function useSocket({
  gameCode,
  role,
  playerName,
  languageCode,
  enabled = true,  // Default to true for backwards compatibility
}: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<TypedSocket | null>(null);
  const latestPlayerName = useRef(playerName);
  const latestLanguageCode = useRef(languageCode);
  const [hasJoined, setHasJoined] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [answerResult, setAnswerResult] = useState<{
    correct: boolean;
    points: number;
    position: number;
  } | null>(null);
  const [questionEnded, setQuestionEnded] = useState<{
    correctAnswerIds: string[];
    stats: AnswerStats;
    correctCategorise?: Record<string, string>;
    correctMatching?: Record<string, string>;
  } | null>(null);
  const [awaitingReveal, setAwaitingReveal] = useState(false);
  const [playerAnswers, setPlayerAnswers] = useState<Map<string, PlayerAnswerDetail[]>>(
    new Map()
  );
  const [easterEggClicks, setEasterEggClicks] = useState<Map<string, EasterEggClickDetail[]>>(
    new Map()
  );
  const [powerUpUsages, setPowerUpUsages] = useState<Map<string, Array<{ playerId: string; powerUpType: PowerUpType }>>>(
    new Map()
  );
  const [nextQuestionPreview, setNextQuestionPreview] = useState<NextQuestionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gameCancelled, setGameCancelled] = useState(false);
  const [playerRemoved, setPlayerRemoved] = useState(false);
  const [removalReason, setRemovalReason] = useState<string | null>(null);
  const [admissionRequests, setAdmissionRequests] = useState<Array<{playerId: string; playerName: string}>>([]);
  const [admissionStatus, setAdmissionStatus] = useState<"admitted" | "refused" | null>(null);
  const [playerViews, setPlayerViews] = useState<Map<string, PlayerViewState>>(new Map());

  // Keep latest join data without recreating socket
  useEffect(() => {
    latestPlayerName.current = playerName;
  }, [playerName]);

  useEffect(() => {
    latestLanguageCode.current = languageCode;
  }, [languageCode]);

  useEffect(() => {
    // Don't connect if explicitly disabled
    if (enabled === false) {
      return;
    }

    // Initialize socket. withCredentials sends the admin session cookie so
    // the server can authorize host events (player connections don't need it).
    const socket: TypedSocket = io({
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected");
      console.log(`[Socket] Role: ${role}, PlayerName: ${latestPlayerName.current}`);
      setConnected(true);
      setError(null);

      // Join room based on role
      if (role === "host") {
        console.log(`[Socket] Emitting host:joinRoom for ${gameCode}`);
        socket.emit("host:joinRoom", { gameCode: gameCode.toUpperCase() });
      } else if (role === "player" && latestPlayerName.current) {
        console.log(`[Socket] Emitting player:join for ${latestPlayerName.current} in game ${gameCode}${latestLanguageCode.current ? ` with language ${latestLanguageCode.current}` : ''}`);
        socket.emit("player:join", {
          gameCode: gameCode.toUpperCase(),
          name: latestPlayerName.current,
          languageCode: latestLanguageCode.current,
        });
        setHasJoined(true);
      } else if (role === "player" && !playerName) {
        console.log(`[Socket] Player role but no playerName yet, not emitting player:join`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    socket.on("game:state", (state) => {
      setGameState(state);
      if (state.currentQuestion) {
        setCurrentQuestion(state.currentQuestion);
      }
      if (state.timeRemaining !== undefined) {
        setTimeRemaining(state.timeRemaining);
      }
    });

    socket.on("game:playerJoined", ({ player }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        const exists = prev.players.some((p) => p.id === player.id);
        if (exists) {
          return {
            ...prev,
            players: prev.players.map((p) => (p.id === player.id ? player : p)),
          };
        }
        return { ...prev, players: [...prev.players, player] };
      });
    });

    socket.on("game:playerLeft", ({ playerId }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, isActive: false } : p
          ),
        };
      });
    });

    socket.on("game:questionStart", ({ question, questionIndex, questionNumber, startTime }) => {
      setCurrentQuestion(question);
      setTimeRemaining(question.timeLimit);
      setAnswerResult(null);
      setQuestionEnded(null);
      setAwaitingReveal(false);
      setNextQuestionPreview(null); // Clear preview when question starts
      // Clear answers for new question (but keep old questions' answers)
      setPlayerAnswers((prev) => {
        const newMap = new Map(prev);
        newMap.set(question.id, []);
        return newMap;
      });
      // Reset hasAnswered for all players for the new question
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) => ({ ...p, hasAnswered: false })),
        };
      });
      // Use SECTION status for sections, QUESTION for questions
      const isSection = question.questionType === "SECTION";
      setGameState((prev) =>
        prev ? {
          ...prev,
          status: isSection ? "SECTION" : "QUESTION",
          currentQuestion: question,
          currentQuestionIndex: questionIndex,
          currentQuestionNumber: questionNumber,
        } : prev
      );
    });

    socket.on("game:timerTick", ({ remaining }) => {
      setTimeRemaining(remaining);
    });

    socket.on("game:answerReceived", ({ playerId, answered }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, hasAnswered: answered } : p
          ),
        };
      });
    });

    socket.on("game:playerPreloadUpdate", ({ playerId, percentage, status }) => {
      console.log(`[Socket] Received preload update for ${playerId}: ${percentage}% (${status})`);
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, downloadStatus: { percentage, status } } : p
          ),
        };
      });
    });

    socket.on("game:playerAnswerDetail", ({ questionId, answer }) => {
      setPlayerAnswers((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId) || [];
        // Check if we already have this player's answer (avoid duplicates)
        if (!existing.some((a) => a.playerId === answer.playerId)) {
          newMap.set(questionId, [...existing, answer]);
        }
        return newMap;
      });
    });

    socket.on("game:easterEggClick", ({ questionId, click }) => {
      setEasterEggClicks((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId) || [];
        // Check if we already have this player's click (avoid duplicates)
        if (!existing.some((c) => c.playerId === click.playerId)) {
          newMap.set(questionId, [...existing, click]);
        }
        return newMap;
      });
    });

    socket.on("game:powerUpUsed", ({ playerId, questionId, powerUpType }) => {
      setPowerUpUsages((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(questionId) || [];
        newMap.set(questionId, [...existing, { playerId, powerUpType }]);
        return newMap;
      });
    });

    socket.on("game:questionEnd", (data) => {
      setQuestionEnded(data);
      setGameState((prev) => (prev ? { ...prev, status: "REVEALING" } : prev));
      setAwaitingReveal(false);
    });

    socket.on("game:timeUp", () => {
      setAwaitingReveal(true);
      setGameState((prev) => (prev ? { ...prev, status: "REVEALING" } : prev));
      setTimeRemaining(0);
    });
    socket.on("game:scoreUpdate", ({ scores: newScores }) => {
      setScores(newScores);
    });

    socket.on("game:showScoreboard", ({ scores: newScores, phase }) => {
      setScores(newScores);
      setGameState((prev) => (prev ? { ...prev, status: "SCOREBOARD" } : prev));
    });

    socket.on("game:finished", ({ finalScores, winners }) => {
      setScores(finalScores);
      setGameState((prev) => (prev ? { ...prev, status: "FINISHED" } : prev));
    });

    socket.on("game:cancelled", () => {
      setGameCancelled(true);
      setGameState(null);
    });

    socket.on("game:playerRemoved", ({ playerId }) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== playerId),
        };
      });
    });

    socket.on("player:removed", ({ reason }) => {
      setPlayerRemoved(true);
      setRemovalReason(reason);
      setGameState(null);
    });

    socket.on("game:admissionRequest", ({ playerId, playerName }) => {
      setAdmissionRequests((prev) => [...prev, { playerId, playerName }]);
    });

    socket.on("player:admissionStatus", ({ status }) => {
      setAdmissionStatus(status);
      if (status === "refused") {
        setGameState(null);
      }
    });

    socket.on("game:nextQuestionPreview", (data) => {
      setNextQuestionPreview(data);
    });

    socket.on("player:answerResult", (result) => {
      setAnswerResult(result);
    });

    socket.on("monitor:playerViewUpdate", ({ playerId, viewState }) => {
      setPlayerViews((prev) => {
        const map = new Map(prev);
        const previous = map.get(playerId);
        map.set(playerId, {
          ...previous,
          ...viewState,
          // Preserve the last screenshot when updates omit it to avoid flicker
          screenshot: viewState.screenshot ?? previous?.screenshot ?? null,
        });
        return map;
      });
    });

    socket.on("monitor:playerViewSnapshot", ({ views }) => {
      setPlayerViews((prev) => {
        const map = new Map<string, PlayerViewState>();
        Object.entries(views || {}).forEach(([id, view]) => {
          const previous = prev.get(id);
          map.set(id, {
            ...previous,
            ...view,
            screenshot: view.screenshot ?? previous?.screenshot ?? null,
          });
        });
        return map;
      });
    });

    socket.on("monitor:playerViewRemove", ({ playerId }) => {
      setPlayerViews((prev) => {
        const map = new Map(prev);
        map.delete(playerId);
        return map;
      });
    });

    socket.on("error", ({ message, code }) => {
      console.error("Socket error:", code, message);
      setError(message);
    });

    return () => {
      socket.disconnect();
    };
  }, [gameCode, role, enabled]);

  // Emit language change without reconnecting
  useEffect(() => {
    if (
      role === "player" &&
      socketRef.current &&
      socketRef.current.connected &&
      !hasJoined &&
      latestPlayerName.current
    ) {
      socketRef.current.emit("player:join", {
        gameCode: gameCode.toUpperCase(),
        name: latestPlayerName.current,
        languageCode: latestLanguageCode.current,
      });
      setHasJoined(true);
    }
  }, [role, gameCode, hasJoined, playerName, languageCode]);

  // Emit language change without reconnecting
  useEffect(() => {
    if (
      role === "player" &&
      socketRef.current &&
      socketRef.current.connected &&
      hasJoined &&
      latestPlayerName.current &&
      languageCode
    ) {
      socketRef.current.emit("player:updateLanguage", {
        gameCode: gameCode.toUpperCase(),
        languageCode,
      });
    }
  }, [languageCode, role, gameCode, hasJoined]);

  const startGame = useCallback(() => {
    socketRef.current?.emit("host:startGame", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const nextQuestion = useCallback(() => {
    socketRef.current?.emit("host:nextQuestion", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const showScoreboard = useCallback(() => {
    socketRef.current?.emit("host:showScoreboard", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const endGame = useCallback(() => {
    socketRef.current?.emit("host:endGame", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const skipTimer = useCallback(() => {
    socketRef.current?.emit("host:skipTimer", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const revealAnswers = useCallback(() => {
    socketRef.current?.emit("host:revealAnswers", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const cancelGame = useCallback(() => {
    console.log("cancelGame called, emitting host:cancelGame for", gameCode.toUpperCase());
    socketRef.current?.emit("host:cancelGame", { gameCode: gameCode.toUpperCase() });
  }, [gameCode]);

  const removePlayer = useCallback((playerId: string) => {
    socketRef.current?.emit("host:removePlayer", {
      gameCode: gameCode.toUpperCase(),
      playerId
    });
  }, [gameCode]);

  const admitPlayer = useCallback((playerId: string) => {
    socketRef.current?.emit("host:admitPlayer", {
      gameCode: gameCode.toUpperCase(),
      playerId
    });
    setAdmissionRequests((prev) => prev.filter((req) => req.playerId !== playerId));
  }, [gameCode]);

  const refusePlayer = useCallback((playerId: string) => {
    socketRef.current?.emit("host:refusePlayer", {
      gameCode: gameCode.toUpperCase(),
      playerId
    });
    setAdmissionRequests((prev) => prev.filter((req) => req.playerId !== playerId));
  }, [gameCode]);

  const toggleAutoAdmit = useCallback((autoAdmit: boolean) => {
    socketRef.current?.emit("host:toggleAutoAdmit", {
      gameCode: gameCode.toUpperCase(),
      autoAdmit
    });
  }, [gameCode]);

  const requestPlayerViews = useCallback(() => {
    socketRef.current?.emit("host:requestPlayerViews", {
      gameCode: gameCode.toUpperCase(),
    });
  }, [gameCode]);

  const submitAnswer = useCallback(
    (questionId: string, answerIds: string[]) => {
      socketRef.current?.emit("player:answer", {
        gameCode: gameCode.toUpperCase(),
        questionId,
        answerIds,
      });
    },
    [gameCode]
  );

  return {
    socket: socketRef.current,
    connected,
    gameState,
    currentQuestion,
    timeRemaining,
    scores,
    answerResult,
    questionEnded,
    awaitingReveal,
    playerAnswers,
    easterEggClicks,
    powerUpUsages,
    nextQuestionPreview,
    error,
    gameCancelled,
    playerRemoved,
    removalReason,
    admissionRequests,
    admissionStatus,
    playerViews,
    startGame,
    nextQuestion,
    showScoreboard,
    endGame,
    skipTimer,
    cancelGame,
    submitAnswer,
    removePlayer,
    admitPlayer,
    refusePlayer,
    toggleAutoAdmit,
    revealAnswers,
    requestPlayerViews,
  };
}
