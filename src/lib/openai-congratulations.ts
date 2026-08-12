import { getConfiguredProvider } from "@/lib/ai-provider";
import { ordinalNumber } from "./certificate-utils";

/**
 * Fallback messages when the AI provider is not configured or fails
 */
export function getFallbackMessage(
  playerName: string,
  position: number,
  totalPlayers: number
): string {
  const ordinal = ordinalNumber(position);
  const topPercentile = Math.ceil((position / totalPlayers) * 100);

  if (position === 1) {
    return `Congratulations on your 1st place finish, ${playerName}! You're the champion! 🏆`;
  }

  if (position === 2) {
    return `Amazing job securing 2nd place, ${playerName}! You're on the podium! 🥈`;
  }

  if (position === 3) {
    return `Excellent work earning 3rd place, ${playerName}! You made the podium! 🥉`;
  }

  if (topPercentile <= 25) {
    return `Great job finishing in ${ordinal} place, ${playerName}! You're in the top 25%! Keep up the awesome work! ⭐`;
  }

  return `Well done completing the quiz, ${playerName}! You finished in ${ordinal} place. Every quiz makes you smarter! 🎯`;
}

/**
 * Generate a personalized congratulatory message using the configured AI provider
 * Falls back to generic messages if the provider is not configured or fails
 */
export async function generateCongratulatoryMessage(
  playerName: string,
  position: number,
  totalPlayers: number,
  score: number,
  quizTitle: string
): Promise<string> {
  try {
    const ordinal = ordinalNumber(position);
    const systemPrompt = `You are a fun and encouraging quiz game announcer. Generate short, playful congratulatory messages for players who just completed a quiz. Keep it to 2-3 sentences maximum. Be enthusiastic but not over the top. Match the tone to their performance - more celebratory for winners, encouraging for everyone else.`;

    const userPrompt = `Player: ${playerName}
Position: ${ordinal} out of ${totalPlayers} players
Score: ${score} points
Quiz: "${quizTitle}"

Generate a personalized, fun, and playful congratulatory message. Make it feel warm and encouraging.`;

    // Use the configured AI provider (FreeLLMAPI, OpenRouter, Ollama, ...).
    // If no provider is configured/available, getConfiguredProvider() throws
    // and we fall back to a generic message below.
    const provider = await getConfiguredProvider();

    const message = await provider.generateText({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      timeoutMs: 5000,
    });

    const trimmed = message?.trim();
    if (!trimmed) {
      console.warn("AI provider returned empty response");
      return getFallbackMessage(playerName, position, totalPlayers);
    }

    return trimmed;
  } catch (error) {
    console.warn("Failed to generate AI congratulatory message:", error);
    return getFallbackMessage(playerName, position, totalPlayers);
  }
}
