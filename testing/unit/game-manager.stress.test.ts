/// <reference types="vitest" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockIo, createMockSocket } from "./mocks/socket";
import { getPrismaMock, MockGameSession } from "./mocks/prisma";

vi.mock("@prisma/client", async () => {
  const mod = await import("./mocks/prisma");
  return { PrismaClient: mod.PrismaClient };
});

vi.mock("@/lib/db", async () => {
  const mod = await import("./mocks/prisma");
  const prisma = mod.PrismaClient.instance ?? new mod.PrismaClient();
  return { prisma };
});

// Avoid loading heavy certificate generation during tests
vi.mock("@/lib/certificate-service", () => ({
  CertificateService: { generateAllCertificates: vi.fn() },
}));

import { GameManager } from "@/server/game-manager";

describe("GameManager stress test", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const prisma = getPrismaMock();
    prisma.reset();

    const session: MockGameSession = {
      id: "session-1",
      gameCode: "ABC123",
      status: "WAITING",
      autoAdmit: true,
      quizId: "quiz-1",
      currentQuestionIndex: -1,
      quiz: {
        id: "quiz-1",
        title: "Stress Quiz",
        theme: null,
        hintCount: 0,
        copyAnswerCount: 0,
        doublePointsCount: 0,
        questions: [
          {
            id: "q1",
            questionText: "First question",
            questionType: "SINGLE_SELECT",
            timeLimit: 10,
            points: 100,
            orderIndex: 0,
            answers: [
              {
                id: "a1",
                answerText: "Correct",
                isCorrect: true,
                orderIndex: 0,
                translations: [],
              },
              {
                id: "a2",
                answerText: "Wrong",
                isCorrect: false,
                orderIndex: 1,
                translations: [],
              },
            ],
            translations: [],
            hostNotes: null,
            hint: null,
            imageUrl: null,
            easterEggEnabled: false,
            easterEggButtonText: null,
            easterEggUrl: null,
            easterEggDisablesScoring: false,
          },
        ],
      },
      players: [],
      questionStartedAt: null,
    };

    prisma.seedGameSession(session);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("handles 50 concurrent player joins and answers", async () => {
    const io = createMockIo();
    const manager = new GameManager(io as any);
    const prisma = getPrismaMock();

    const playerSockets = [];
    for (let i = 0; i < 50; i++) {
      const socket = createMockSocket(`p-${i + 1}`);
      io.registerSocket(socket);
      await (manager as any).handlePlayerJoin(socket as any, {
        gameCode: "ABC123",
        name: `Player ${i + 1}`,
      });
      playerSockets.push(socket);
    }

    const hostSocket = createMockSocket("host-1");
    // The stress test bypasses handleConnection, so mark the host socket as
    // authorized to satisfy the requireHostSocket guard.
    hostSocket.data.isHostAuthorized = true;
    io.registerSocket(hostSocket);
    await (manager as any).handleStartGame(hostSocket as any, { gameCode: "ABC123" });

    const activeGame = (manager as any).activeGames.get("ABC123");
    const firstQuestion = activeGame.questions[0];
    const correctAnswerId =
      activeGame.correctAnswerIds.get(firstQuestion.id)[0];

    // Simulate power-ups and answers
    for (const socket of playerSockets) {
      await (manager as any).handlePowerUpUsage(socket as any, {
        gameCode: "ABC123",
        questionId: firstQuestion.id,
        powerUpType: "double",
      });
      await (manager as any).handlePlayerAnswer(socket as any, {
        gameCode: "ABC123",
        questionId: firstQuestion.id,
        answerIds: [correctAnswerId],
      });
    }

    await (manager as any).endQuestion("ABC123");

    const scores = await (manager as any).getPlayerScores("ABC123");
    expect(scores).toHaveLength(50);
    expect(scores.every((s: any) => s.score > 0)).toBe(true);

    const answerEvents = io.emitted.get("game:ABC123") || [];
    const answerCount = answerEvents.filter((e) => e.event === "game:answerReceived").length;
    expect(answerCount).toBe(50);

    // Ensure Prisma recorded answers and players remain active
    expect(prisma.getPlayerAnswerCount()).toBe(50);
    expect(prisma.getPlayerCount()).toBe(50);
  });
});
