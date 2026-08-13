import { prisma } from "@/lib/db";
import { SupportedLanguages, type LanguageCode } from "@/types";
import { getConfiguredProvider } from "@/lib/ai-provider";
import { resolveSourceLanguage } from "@/lib/source-language";

interface TranslationRequest {
  questionText: string;
  hint?: string | null;
  hostNotes?: string | null;
  easterEggButtonText?: string | null;
  answers: Array<{
    id: string;
    answerText: string;
  }>;
}

interface TranslationResponse {
  questionText: string;
  hint?: string | null;
  hostNotes?: string | null;
  easterEggButtonText?: string | null;
  answers: Array<{
    id: string;
    answerText: string;
  }>;
}

interface SectionTranslationRequest {
  title: string;
  description?: string | null;
}

interface SectionTranslationResponse {
  title: string;
  description?: string | null;
}

/**
 * Get the configured AI provider for translation.
 * Uses the shared provider abstraction so translation works with FreeLLMAPI,
 * OpenRouter, Ollama, etc., not just OpenAI.
 */
async function getProvider() {
  return getConfiguredProvider();
}

/**
 * Human-readable description of a language for AI prompts, including the
 * native name so the model produces the correct script/variant. For Serbian we
 * explicitly call out the required script (Latin vs Cyrillic) so the model does
 * not pick one arbitrarily.
 */
function languagePromptName(code: LanguageCode): string {
  const info = SupportedLanguages[code];
  switch (code) {
    case "sr-Latn":
      return `${info.name} (Latin script — "${info.nativeName}")`;
    case "sr-Cyrl":
      return `${info.name} (Cyrillic script — "${info.nativeName}")`;
    default:
      return `${info.name} (${info.nativeName})`;
  }
}

/**
 * Resolve the source language for a question by reading its quiz.
 */
async function resolveQuestionSourceLanguage(questionId: string): Promise<LanguageCode> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { quiz: { select: { sourceLanguage: true } } },
  });
  return resolveSourceLanguage(question?.quiz?.sourceLanguage);
}

/**
 * Translate a single question to a target language using the configured AI provider
 * @param questionId - The question ID to translate
 * @param targetLanguage - The target language code (e.g., 'es', 'fr')
 * @returns Success status
 */
export async function translateQuestion(
  questionId: string,
  targetLanguage: LanguageCode
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get configured provider
    const provider = await getProvider();

    // Get question with answers
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        answers: {
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!question) {
      return { success: false, error: "Question not found" };
    }

    // Resolve the actual source language of this quiz's content
    const sourceLanguage = await resolveQuestionSourceLanguage(questionId);

    // Prepare translation request
    const request: TranslationRequest = {
      questionText: question.questionText,
      hint: question.hint,
      hostNotes: question.hostNotes,
      easterEggButtonText: question.easterEggButtonText,
      answers: question.answers.map((a) => ({
        id: a.id,
        answerText: a.answerText,
      })),
    };

    const sourceInfo = SupportedLanguages[sourceLanguage];
    const targetName = languagePromptName(targetLanguage);
    const systemPrompt = `You are a professional translator for educational quiz content.
Translate from ${sourceInfo.name} (${sourceInfo.nativeName}) to ${targetName}.

CRITICAL RULES:
1. Maintain EXACT JSON structure
2. Only translate text values, never IDs or field names
3. Preserve formatting and line breaks
4. Keep technical terms accurate
5. Ensure cultural appropriateness
6. Return ONLY valid JSON with no markdown formatting or code blocks
7. If a field is null or empty, keep it null/empty in the response
8. The target language is ${targetName}; write the output in that language and script only.`;

    // Call configured AI provider
    const responseText = await provider.generateText({
      systemPrompt,
      userPrompt: `Translate this quiz question to ${targetName}:\n\n${JSON.stringify(request, null, 2)}`,
      jsonMode: true,
      temperature: 0.3,
    });

    if (!responseText) {
      return { success: false, error: "No response from AI provider" };
    }

    // Parse response
    const translated = JSON.parse(responseText) as TranslationResponse;

    // Save question translation
    await prisma.questionTranslation.upsert({
      where: {
        questionId_languageCode: {
          questionId: questionId,
          languageCode: targetLanguage,
        },
      },
      update: {
        questionText: translated.questionText,
        hint: translated.hint,
        hostNotes: translated.hostNotes,
        easterEggButtonText: translated.easterEggButtonText,
        isAutoTranslated: true,
        updatedAt: new Date(),
      },
      create: {
        questionId: questionId,
        languageCode: targetLanguage,
        questionText: translated.questionText,
        hint: translated.hint,
        hostNotes: translated.hostNotes,
        easterEggButtonText: translated.easterEggButtonText,
        isAutoTranslated: true,
      },
    });

    // Save answer translations
    for (const translatedAnswer of translated.answers) {
      const originalAnswer = question.answers.find((a) => a.id === translatedAnswer.id);
      if (originalAnswer) {
        await prisma.answerTranslation.upsert({
          where: {
            answerId_languageCode: {
              answerId: originalAnswer.id,
              languageCode: targetLanguage,
            },
          },
          update: {
            answerText: translatedAnswer.answerText,
            isAutoTranslated: true,
            updatedAt: new Date(),
          },
          create: {
            answerId: originalAnswer.id,
            languageCode: targetLanguage,
            answerText: translatedAnswer.answerText,
            isAutoTranslated: true,
          },
        });
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to translate question:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Translation failed",
    };
  }
}

/**
 * Translate a section (SECTION type question) to a target language using the configured AI provider
 * Sections only have title (questionText) and description (hostNotes)
 * @param sectionId - The section ID to translate
 * @param targetLanguage - The target language code (e.g., 'es', 'fr')
 * @returns Success status
 */
export async function translateSection(
  sectionId: string,
  targetLanguage: LanguageCode
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get configured provider
    const provider = await getProvider();

    // Get section
    const section = await prisma.question.findUnique({
      where: { id: sectionId },
    });

    if (!section) {
      return { success: false, error: "Section not found" };
    }

    if (section.questionType !== "SECTION") {
      return { success: false, error: "Not a section" };
    }

    // Resolve the actual source language of this quiz's content
    const sourceLanguage = await resolveQuestionSourceLanguage(sectionId);

    // Prepare translation request
    const request: SectionTranslationRequest = {
      title: section.questionText,
      description: section.hostNotes,
    };

    const sourceInfo = SupportedLanguages[sourceLanguage];
    const targetName = languagePromptName(targetLanguage);
    const systemPrompt = `You are a professional translator for educational quiz content.
Translate from ${sourceInfo.name} (${sourceInfo.nativeName}) to ${targetName}.

CRITICAL RULES:
1. Maintain EXACT JSON structure
2. Only translate text values, never field names
3. Preserve formatting and line breaks
4. Keep the tone appropriate for quiz section headers
5. Return ONLY valid JSON with no markdown formatting or code blocks
6. If a field is null or empty, keep it null/empty in the response
7. The target language is ${targetName}; write the output in that language and script only.`;

    // Call configured AI provider
    const responseText = await provider.generateText({
      systemPrompt,
      userPrompt: `Translate this quiz section header to ${targetName}:\n\n${JSON.stringify(request, null, 2)}`,
      jsonMode: true,
      temperature: 0.3,
    });

    if (!responseText) {
      return { success: false, error: "No response from AI provider" };
    }

    // Parse response
    const translated = JSON.parse(responseText) as SectionTranslationResponse;

    // Save section translation (stored in questionText and hostNotes fields)
    await prisma.questionTranslation.upsert({
      where: {
        questionId_languageCode: {
          questionId: sectionId,
          languageCode: targetLanguage,
        },
      },
      update: {
        questionText: translated.title,
        hostNotes: translated.description,
        isAutoTranslated: true,
        updatedAt: new Date(),
      },
      create: {
        questionId: sectionId,
        languageCode: targetLanguage,
        questionText: translated.title,
        hostNotes: translated.description,
        isAutoTranslated: true,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to translate section:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Translation failed",
    };
  }
}

/**
 * Translate an entire quiz to a target language
 * @param quizId - The quiz ID to translate
 * @param targetLanguage - The target language code
 * @param onProgress - Optional progress callback (current, total)
 * @returns Success status with translation count
 */
export async function translateEntireQuiz(
  quizId: string,
  targetLanguage: LanguageCode,
  onProgress?: (current: number, total: number) => void
): Promise<{ success: boolean; translated: number; failed: number; errors: string[] }> {
  try {
    // Get all questions for the quiz (including sections)
    const allItems = await prisma.question.findMany({
      where: {
        quizId: quizId,
      },
      orderBy: { orderIndex: "asc" },
    });

    if (allItems.length === 0) {
      return { success: true, translated: 0, failed: 0, errors: [] };
    }

    // Separate sections and questions
    const sections = allItems.filter((item) => item.questionType === "SECTION");
    const questions = allItems.filter((item) => item.questionType !== "SECTION");

    const totalItems = sections.length + questions.length;
    let translated = 0;
    let failed = 0;
    const errors: string[] = [];
    let currentIndex = 0;

    // Translate sections first
    for (const section of sections) {
      currentIndex++;

      // Report progress
      if (onProgress) {
        onProgress(currentIndex, totalItems);
      }

      // Translate the section
      const result = await translateSection(section.id, targetLanguage);

      if (result.success) {
        translated++;
      } else {
        failed++;
        errors.push(`Section "${section.questionText}": ${result.error || "Unknown error"}`);
      }

      // Add delay between requests to avoid rate limits (500ms)
      if (currentIndex < totalItems) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Translate questions
    for (const question of questions) {
      currentIndex++;

      // Report progress
      if (onProgress) {
        onProgress(currentIndex, totalItems);
      }

      // Translate the question
      const result = await translateQuestion(question.id, targetLanguage);

      if (result.success) {
        translated++;
      } else {
        failed++;
        errors.push(`Question "${question.questionText.substring(0, 30)}...": ${result.error || "Unknown error"}`);
      }

      // Add delay between requests to avoid rate limits (500ms)
      if (currentIndex < totalItems) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return {
      success: failed === 0,
      translated,
      failed,
      errors,
    };
  } catch (error) {
    console.error("Failed to translate quiz:", error);
    return {
      success: false,
      translated: 0,
      failed: 0,
      errors: [error instanceof Error ? error.message : "Translation failed"],
    };
  }
}

/**
 * Get translation status for a quiz
 * @param quizId - The quiz ID
 * @returns Translation status for each supported language
 */
export async function getQuizTranslationStatus(quizId: string): Promise<
  Array<{
    languageCode: LanguageCode;
    languageName: string;
    isComplete: boolean;
    totalFields: number;
    translatedFields: number;
    lastUpdated: string | null;
  }>
> {
  try {
    // Get all items (questions and sections) with their answers
    const allItems = await prisma.question.findMany({
      where: {
        quizId: quizId,
      },
      include: {
        answers: true,
        translations: true,
      },
    });

    if (allItems.length === 0) {
      return [];
    }

    // Resolve the source language of this quiz so it is excluded from the list
    // of translatable targets (it is the base language, not a translation).
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { sourceLanguage: true },
    });
    const sourceLanguage = resolveSourceLanguage(quiz?.sourceLanguage);

    // Separate sections and questions
    const sections = allItems.filter((item) => item.questionType === "SECTION");
    const questions = allItems.filter((item) => item.questionType !== "SECTION");

    // Calculate total translatable fields per language
    let totalFieldsPerLanguage = 0;

    // Count section fields
    for (const section of sections) {
      // Section title (questionText) - always counted
      totalFieldsPerLanguage += 1;
      // Section description (hostNotes) - only count if exists
      if (section.hostNotes) totalFieldsPerLanguage += 1;
    }

    // Count question fields
    for (const question of questions) {
      // Question text (always counted)
      totalFieldsPerLanguage += 1;

      // Optional fields (only count if they exist in English)
      if (question.hint) totalFieldsPerLanguage += 1;
      if (question.hostNotes) totalFieldsPerLanguage += 1;
      if (question.easterEggButtonText) totalFieldsPerLanguage += 1;

      // Answer texts
      totalFieldsPerLanguage += question.answers.length;
    }

    // Build status for each supported language (excluding the source language)
    const statuses = await Promise.all(
      (Object.keys(SupportedLanguages) as LanguageCode[])
        .filter((code) => code !== sourceLanguage)
        .map(async (languageCode) => {
          const languageInfo = SupportedLanguages[languageCode];

          // Get all translations for this language (including sections)
          const questionTranslations = await prisma.questionTranslation.findMany({
            where: {
              questionId: { in: allItems.map((q) => q.id) },
              languageCode: languageCode,
            },
          });

          const answerTranslations = await prisma.answerTranslation.findMany({
            where: {
              answerId: {
                in: questions.flatMap((q) => q.answers.map((a) => a.id)),
              },
              languageCode: languageCode,
            },
          });

          // Count translated fields
          let translatedFields = 0;

          // Count section translations
          for (const section of sections) {
            const sTranslation = questionTranslations.find((t) => t.questionId === section.id);
            if (sTranslation) {
              // Section title
              if (sTranslation.questionText) translatedFields += 1;
              // Section description (only count if original has it)
              if (section.hostNotes && sTranslation.hostNotes) translatedFields += 1;
            }
          }

          // Count question translations
          for (const question of questions) {
            const qTranslation = questionTranslations.find((t) => t.questionId === question.id);

            if (qTranslation) {
              // Question text
              if (qTranslation.questionText) translatedFields += 1;

              // Optional fields (only count if they exist in English)
              if (question.hint && qTranslation.hint) translatedFields += 1;
              if (question.hostNotes && qTranslation.hostNotes) translatedFields += 1;
              if (question.easterEggButtonText && qTranslation.easterEggButtonText)
                translatedFields += 1;
            }

            // Answer texts
            for (const answer of question.answers) {
              const aTranslation = answerTranslations.find((t) => t.answerId === answer.id);
              if (aTranslation && aTranslation.answerText) {
                translatedFields += 1;
              }
            }
          }

          // Find most recent update
          const allTranslations = [
            ...questionTranslations.map((t) => t.updatedAt),
            ...answerTranslations.map((t) => t.updatedAt),
          ];
          const lastUpdated = allTranslations.length > 0
            ? new Date(Math.max(...allTranslations.map((d) => d.getTime()))).toISOString()
            : null;

          return {
            languageCode,
            languageName: `${languageInfo.flag} ${languageInfo.name}`,
            isComplete: translatedFields === totalFieldsPerLanguage,
            totalFields: totalFieldsPerLanguage,
            translatedFields,
            lastUpdated,
          };
        })
    );

    return statuses;
  } catch (error) {
    console.error("Failed to get translation status:", error);
    return [];
  }
}
