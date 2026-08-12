/// <reference types="vitest" />
import { describe, expect, it, vi, beforeEach } from "vitest";

// The congrats module now uses the configured AI provider abstraction
// (getConfiguredProvider().generateText) instead of a direct OpenAI client
// and no longer touches Prisma directly. Mock the provider so we can drive
// the text-generation result per test. vi.hoisted ensures the mocks exist
// before vi.mock's hoisted factory runs.
const { generateTextMock, getConfiguredProviderMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  getConfiguredProviderMock: vi.fn(),
}));

vi.mock("@/lib/ai-provider", () => ({
  getConfiguredProvider: getConfiguredProviderMock,
}));

import { generateCongratulatoryMessage, getFallbackMessage } from "@/lib/openai-congratulations";

describe("openai-congratulations", () => {
  beforeEach(() => {
    generateTextMock.mockReset();
    getConfiguredProviderMock.mockReset();
    // Default: a working provider that delegates to generateTextMock.
    getConfiguredProviderMock.mockResolvedValue({ generateText: generateTextMock });
  });

  it("returns fallback when AI provider is not configured (throws)", async () => {
    getConfiguredProviderMock.mockResolvedValueOnce({
      generateText: vi.fn().mockRejectedValue(new Error("not configured")),
    });

    const msg = await generateCongratulatoryMessage("Pat", 1, 5, 1000, "Quiz");
    expect(msg).toContain("Pat");
  });

  it("uses the configured provider when available", async () => {
    const fakeMessage = "Great job!";
    generateTextMock.mockResolvedValue(fakeMessage);

    const msg = await generateCongratulatoryMessage("Pat", 2, 10, 900, "Quiz");
    expect(msg).toBe(fakeMessage);
    expect(generateTextMock).toHaveBeenCalled();
  });

  it("provides ordinalized fallback messages", () => {
    expect(getFallbackMessage("Pat", 1, 10)).toContain("1st");
    expect(getFallbackMessage("Pat", 3, 10)).toContain("3rd");
  });
});
