import { getConfiguredProvider } from "@/lib/ai-provider";
import { ThemeWizardAnswers, generateAIPrompt } from "@/lib/theme-template";
import { validateThemeJson } from "@/lib/theme";

/**
 * Generate a theme JSON string from wizard answers using the configured AI provider
 */
export async function generateThemeFromAnswers(
  answers: ThemeWizardAnswers
): Promise<string> {
  const provider = await getConfiguredProvider();

  const prompt = generateAIPrompt(answers);

  const responseText = await provider.generateText({
    systemPrompt:
      "You create JSON themes for a quiz app. Always return ONLY raw JSON with no code fences or explanations.",
    userPrompt: prompt,
    jsonMode: true,
    temperature: 0.7,
  });

  if (!responseText) {
    throw new Error("No response from AI provider");
  }

  let formattedJson: string;
  try {
    const parsed = JSON.parse(responseText);
    formattedJson = JSON.stringify(parsed, null, 2);
  } catch (error) {
    console.error("Failed to parse AI theme response:", error);
    throw new Error("Failed to parse AI response");
  }

  const validationError = validateThemeJson(formattedJson);
  if (validationError) {
    throw new Error(validationError);
  }

  return formattedJson;
}
