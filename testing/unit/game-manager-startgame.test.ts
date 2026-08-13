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

vi.mock("@/lib/certificate-service", () => ({
  CertificateService: { generateAllCertificates: vi.fn() },
}));

import { GameManager } from "@/server/game-manager";

function makeSession(status: MockGameSession["status"]): MockGameSession {
  return {
    id: "session-1",
    gameCode: "ABC123",
    status,
    autoAdmit: true,
    quizId: "quiz-1",
    currentQuestionIndex: -1,
    quiz: {
      id: "quiz-1",
      title: "Start Game Quiz",
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
            { id: "a1", answerText: "Correct", isCorrect: true, orderIndex: 0 },
            { id: "a2", answerText: "Wrong", isCorrect: false, orderIndex: 1 },
          ],
          hostNotes: null,
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
}

describe("handleStartGame FINISHED guard", () => {
  beforeEach(() => {
    const prisma = getPrismaMock();
    prisma.reset();
  });

  it("rejects starting a FINISHED game with GAME_FINISHED", async () => {
    const prisma = getPrismaMock();
    prisma.seedGameSession(makeSession("FINISHED"));

    const io = createMockIo();
    const manager = new GameManager(io as any);

    const hostSocket = createMockSocket("host-1");
    hostSocket.data.isHostAuthorized = true;
    io.registerSocket(hostSocket);

    await (manager as any).handleStartGame(hostSocket as any, { gameCode: "ABC123" });

    const errors = hostSocket.emissions.filter((e: any) => e.event === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].payload.code).toBe("GAME_FINISHED");

    // Game must not be reactivated in memory ...
    expect((manager as any).activeGames.has("ABC123")).toBe(false);
    // ... nor in the database.
    const session = await (prisma as any).gameSession.findUnique({
      where: { gameCode: "ABC123" },
    });
    expect(session.status).toBe("FINISHED");
  });

  it("starts a WAITING game normally", async () => {
    const prisma = getPrismaMock();
    prisma.seedGameSession(makeSession("WAITING"));

    const io = createMockIo();
    const manager = new GameManager(io as any);

    const hostSocket = createMockSocket("host-1");
    hostSocket.data.isHostAuthorized = true;
    io.registerSocket(hostSocket);

    await (manager as any).handleStartGame(hostSocket as any, { gameCode: "ABC123" });

    const errors = hostSocket.emissions.filter((e: any) => e.event === "error");
    expect(errors).toHaveLength(0);

    // Game is activated in memory and the first question starts immediately,
    // advancing the session to QUESTION status.
    expect((manager as any).activeGames.has("ABC123")).toBe(true);

    const session = await (prisma as any).gameSession.findUnique({
      where: { gameCode: "ABC123" },
    });
    expect(session.status).toBe("QUESTION");
  });
});
