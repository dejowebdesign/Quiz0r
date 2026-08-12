import { QuizTheme } from "./theme";

// Question types
export const QuestionType = {
  SINGLE_SELECT: "SINGLE_SELECT",
  MULTI_SELECT: "MULTI_SELECT",
  SECTION: "SECTION",
} as const;

export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

// Power-up types
export const PowerUpType = {
  HINT: "hint",
  COPY: "copy",
  DOUBLE: "double",
} as const;

export type PowerUpType = (typeof PowerUpType)[keyof typeof PowerUpType];

// Supported languages
export const SupportedLanguages = {
  en: { code: 'en', name: 'English', flag: '🇬🇧', nativeName: 'English' },
  es: { code: 'es', name: 'Spanish', flag: '🇪🇸', nativeName: 'Español' },
  fr: { code: 'fr', name: 'French', flag: '🇫🇷', nativeName: 'Français' },
  de: { code: 'de', name: 'German', flag: '🇩🇪', nativeName: 'Deutsch' },
  he: { code: 'he', name: 'Hebrew', flag: '🇮🇱', nativeName: 'עברית' },
  ja: { code: 'ja', name: 'Japanese', flag: '🇯🇵', nativeName: '日本語' },
  'zh-CN': { code: 'zh-CN', name: 'Chinese (Simplified)', flag: '🇨🇳', nativeName: '简体中文' },
  ar: { code: 'ar', name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
  pt: { code: 'pt', name: 'Portuguese', flag: '🇵🇹', nativeName: 'Português' },
  ru: { code: 'ru', name: 'Russian', flag: '🇷🇺', nativeName: 'Русский' },
  it: { code: 'it', name: 'Italian', flag: '🇮🇹', nativeName: 'Italiano' },
  sr: { code: 'sr', name: 'Serbian', flag: '🇷🇸', nativeName: 'Srpski' },
} as const;

export type LanguageCode = keyof typeof SupportedLanguages;

// Game status types
export const GameStatus = {
  WAITING: "WAITING",
  ACTIVE: "ACTIVE",
  QUESTION: "QUESTION",
  SECTION: "SECTION",
  REVEALING: "REVEALING",
  SCOREBOARD: "SCOREBOARD",
  FINISHED: "FINISHED",
} as const;

export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

// Socket event types
export interface GameState {
  gameCode: string;
  status: GameStatus;
  quizTitle: string;
  quizTheme: QuizTheme | null; // Quiz theme for styling
  currentQuestionIndex: number;
  currentQuestionNumber: number; // Excludes sections from count
  totalQuestions: number; // Excludes sections from count
  players: PlayerInfo[];
  currentQuestion?: QuestionData | null;
  timeRemaining?: number;
  autoAdmit?: boolean;
  powerUps: {
    hintCount: number;
    copyAnswerCount: number;
    doublePointsCount: number;
  };
}

export interface PlayerInfo {
  id: string;
  name: string;
  avatarColor: string;
  avatarEmoji?: string | null;
  score: number;
  isActive: boolean;
  hasAnswered?: boolean;
  admissionStatus?: "admitted" | "pending" | "refused";
  languageCode?: LanguageCode;
  downloadStatus?: {
    percentage: number;
    status: 'idle' | 'loading' | 'complete' | 'error';
  };
}

export interface QuestionData {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  hostNotes?: string | null;
  questionType: QuestionType;
  timeLimit: number;
  points: number;
  answers: AnswerOption[];
  hint?: string | null;
  easterEggEnabled?: boolean;
  easterEggButtonText?: string | null;
  easterEggUrl?: string | null;
  easterEggDisablesScoring?: boolean;
}

export interface AnswerOption {
  id: string;
  answerText: string;
  imageUrl?: string | null;
}

export interface AnswerOptionWithTranslations extends AnswerOption {
  translations?: Record<LanguageCode, {
    answerText: string;
  }>;
}

export interface QuestionDataWithTranslations extends QuestionData {
  translations?: Record<LanguageCode, {
    questionText: string;
    hostNotes?: string | null;
    hint?: string | null;
    easterEggButtonText?: string | null;
  }>;
  answers: AnswerOptionWithTranslations[];
}

export interface TranslationStatus {
  languageCode: LanguageCode;
  isComplete: boolean;
  totalFields: number;
  translatedFields: number;
  lastUpdated: string;
}

export interface PlayerScore {
  playerId: string;
  name: string;
  avatarColor: string;
  avatarEmoji?: string | null;
  languageCode?: LanguageCode;
  score: number;
  position: number;
  change: number;
  powerUpsUsed: Array<{
    powerUpType: PowerUpType;
    questionNumber: number;
  }>;
}

export interface AnswerStats {
  totalAnswered: number;
  answerDistribution: Record<string, number>;
}

export interface PlayerAnswerDetail {
  playerId: string;
  playerName: string;
  avatarColor: string;
  avatarEmoji?: string | null;
  selectedAnswerIds: string[];
  isCorrect: boolean;
  pointsEarned: number;
  totalScore: number;
  position: number;
  timeToAnswer: number;
}

export interface EasterEggClickDetail {
  playerId: string;
  playerName: string;
  avatarColor: string;
  avatarEmoji?: string | null;
  clickedAt: number;
}

export interface PowerUpUsageData {
  powerUpType: PowerUpType;
  questionId: string;
  copiedPlayerId?: string | null;
}

export interface PlayerPowerUpState {
  hintsRemaining: number;
  copyRemaining: number;
  doubleRemaining: number;
  usedThisQuestion: Set<PowerUpType>;
}

export interface QuizPreloadData {
  quizTitle: string;
  totalQuestions: number;
  questions: QuestionDataWithTranslations[];
  theme: QuizTheme | null;
  imageUrls: string[];
  startIndex?: number;
  availableLanguages: LanguageCode[];
}

export type PlayerViewStage =
  | "connecting"
  | "waiting"
  | "section"
  | "question"
  | "awaiting-reveal"
  | "reveal"
  | "scoreboard"
  | "finished"
  | "cancelled"
  | "removed";

export interface PlayerViewState {
  stage: PlayerViewStage;
  playerId: string;
  playerName: string;
  languageCode?: LanguageCode;
  question?: {
    id: string;
    questionText: string;
    questionType: QuestionType;
    answers: Array<{ id: string; answerText: string; imageUrl?: string | null }>;
    imageUrl?: string | null;
    points?: number;
    questionNumber?: number;
    totalQuestions?: number;
  };
  selectedAnswerIds?: string[];
  hasSubmitted?: boolean;
  awaitingReveal?: boolean;
  timeRemaining?: number;
  correctAnswerIds?: string[];
  answerResult?: { correct: boolean; points: number; position: number } | null;
  score?: number;
  downloadStatus?: {
    percentage: number;
    status: 'idle' | 'loading' | 'complete' | 'error';
  };
  scoreboard?: { scores: PlayerScore[]; phase?: "mid" | "final" };
  message?: string;
  isActive?: boolean;
  screenshot?: string | null;
}

// Socket events - Server to Client
export interface ServerToClientEvents {
  "game:state": (state: GameState) => void;
  "game:playerJoined": (data: { player: PlayerInfo }) => void;
  "game:playerLeft": (data: { playerId: string }) => void;
  "game:timeUp": () => void;
  "game:questionStart": (data: {
    question: QuestionData;
    questionIndex: number;
    questionNumber: number;
    startTime: number | null;
  }) => void;
  "game:timerTick": (data: { remaining: number }) => void;
  "game:answerReceived": (data: {
    playerId: string;
    answered: boolean;
  }) => void;
  "game:playerAnswerDetail": (data: {
    questionId: string;
    answer: PlayerAnswerDetail;
  }) => void;
  "game:questionEnd": (data: {
    correctAnswerIds: string[];
    stats: AnswerStats;
  }) => void;
  "game:scoreUpdate": (data: { scores: PlayerScore[] }) => void;
  "game:showScoreboard": (data: {
    scores: PlayerScore[];
    phase: "mid" | "final";
  }) => void;
  "game:finished": (data: {
    finalScores: PlayerScore[];
    winners: PlayerInfo[];
  }) => void;
  "game:cancelled": () => void;
  "game:nextQuestionPreview": (data: {
    section?: QuestionData | null;
    question: QuestionData | null;
    questionNumber: number | null;
    totalQuestions: number;
  } | null) => void;
  "player:answerResult": (data: {
    correct: boolean;
    points: number;
    position: number;
  }) => void;
  "game:quizDataPreload": (data: QuizPreloadData) => void;
  "game:playerPreloadUpdate": (data: {
    playerId: string;
    percentage: number;
    status: 'idle' | 'loading' | 'complete' | 'error';
  }) => void;
  "game:playerRemoved": (data: { playerId: string }) => void;
  "player:removed": (data: { reason: string }) => void;
  "game:admissionRequest": (data: { playerId: string; playerName: string }) => void;
  "player:admissionStatus": (data: { status: "admitted" | "refused" }) => void;
  "game:easterEggClick": (data: {
    questionId: string;
    click: EasterEggClickDetail;
  }) => void;
  "game:powerUpUsed": (data: {
    playerId: string;
    questionId: string;
    powerUpType: PowerUpType;
  }) => void;
  "game:powerUpRefunded": (data: {
    powerUpType: PowerUpType;
    reason: string;
  }) => void;
  "certificates:progress": (data: {
    completed: number;
    total: number;
    percentage: number;
    estimatedSecondsRemaining: number;
  }) => void;
  "certificates:ready": () => void;
  "certificates:error": (data: { message: string }) => void;
  "certificates:failed": (data: {
    failedCount: number;
    certificateIds: string[];
  }) => void;
  "monitor:playerViewUpdate": (data: { playerId: string; viewState: PlayerViewState }) => void;
  "monitor:playerViewSnapshot": (data: { views: Record<string, PlayerViewState> }) => void;
  "monitor:playerViewRemove": (data: { playerId: string }) => void;
  error: (data: { message: string; code: string }) => void;
}

// Socket events - Client to Server
export interface ClientToServerEvents {
  "host:joinRoom": (data: { gameCode: string }) => void;
  "host:startGame": (data: { gameCode: string }) => void;
  "host:nextQuestion": (data: { gameCode: string }) => void;
  "host:showScoreboard": (data: { gameCode: string }) => void;
  "host:endGame": (data: { gameCode: string }) => void;
  "host:pauseGame": (data: { gameCode: string }) => void;
  "host:resumeGame": (data: { gameCode: string }) => void;
  "host:skipTimer": (data: { gameCode: string }) => void;
  "host:revealAnswers": (data: { gameCode: string }) => void;
  "host:cancelGame": (data: { gameCode: string }) => void;
  "host:requestPlayerViews": (data: { gameCode: string }) => void;
  "player:join": (data: { gameCode: string; name: string; languageCode?: LanguageCode }) => void;
  "player:answer": (data: {
    gameCode: string;
    questionId: string;
    answerIds: string[];
  }) => void;
  "player:updateLanguage": (data: { gameCode: string; languageCode: LanguageCode }) => void;
  "player:reconnect": (data: { gameCode: string; playerId: string }) => void;
  "player:preloadProgress": (data: {
    gameCode: string;
    playerId: string;
    percentage: number;
    loadedAssets: number;
    totalAssets: number;
    status: 'idle' | 'loading' | 'complete' | 'error';
  }) => void;
  "host:removePlayer": (data: { gameCode: string; playerId: string }) => void;
  "host:admitPlayer": (data: { gameCode: string; playerId: string }) => void;
  "host:refusePlayer": (data: { gameCode: string; playerId: string }) => void;
  "host:toggleAutoAdmit": (data: { gameCode: string; autoAdmit: boolean }) => void;
  "player:easterEggClick": (data: {
    gameCode: string;
    questionId: string;
  }) => void;
  "player:usePowerUp": (data: {
    gameCode: string;
    questionId: string;
    powerUpType: PowerUpType;
    copiedPlayerId?: string;
  }) => void;
  "player:viewUpdate": (data: { gameCode: string; playerId: string; viewState: PlayerViewState }) => void;
}
