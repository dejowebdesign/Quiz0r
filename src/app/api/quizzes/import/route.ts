/**
 * Quiz Import API
 * Imports a quiz from a ZIP file containing quiz.json and images
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import JSZip from "jszip";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { ExportedQuiz } from "@/types/export";
import { sanitizeQuizData } from "@/lib/sanitize";
import { validateQuizStructure } from "@/lib/validate-import";
import { requireAdmin } from "@/lib/auth";
import { resolveSourceLanguage } from "@/lib/source-language";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    // 1. Parse uploaded file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a .zip file" },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB" },
        { status: 400 }
      );
    }

    // 2. Parse ZIP file
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 3. Extract and validate quiz.json
    const quizJsonFile = zip.file("quiz.json");
    if (!quizJsonFile) {
      return NextResponse.json(
        { error: "Invalid quiz file: missing quiz.json" },
        { status: 400 }
      );
    }

    const quizJsonContent = await quizJsonFile.async("string");
    let quizData: ExportedQuiz;

    try {
      quizData = JSON.parse(quizJsonContent);
    } catch {
      return NextResponse.json(
        { error: "Invalid quiz file: quiz.json is not valid JSON" },
        { status: 400 }
      );
    }

    // 4. Validate structure
    const validation = validateQuizStructure(quizData);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Validation failed: ${validation.error}` },
        { status: 400 }
      );
    }

    // 5. Sanitize all text fields
    const sanitizedData = sanitizeQuizData(quizData);
    const powerUps = sanitizedData.powerUps ?? {
      hintCount: 0,
      copyAnswerCount: 0,
      doublePointsCount: 0,
    };

    // 6. Upload images and create mapping
    const imageMapping = new Map<string, string>(); // ref -> new URL
    const imageFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith("images/") && !zip.files[f].dir && !f.includes("__MACOSX")
    );
    console.log(`[quiz-import] Found ${imageFiles.length} images in ZIP`);

    for (const imagePath of imageFiles) {
      const imageFile = zip.file(imagePath);
      if (!imageFile) continue;

      try {
        // Use uint8array to avoid environment-specific buffer issues, then wrap in Buffer
        const imageBytes = await imageFile.async("uint8array");
        const imageBuffer = Buffer.from(imageBytes);
        const newUrl = await uploadImageToStorage(imageBuffer, imagePath);
        imageMapping.set(imagePath, newUrl);
      } catch (error) {
        console.warn(`Failed to upload image ${imagePath}:`, error);
        // Continue - image will be null in quiz
      }
    }
    console.log(`[quiz-import] Uploaded ${imageMapping.size} images`);

    // 7. Create new quiz in database
    const newQuiz = await prisma.quiz.create({
      data: {
        title: sanitizedData.title,
        description: sanitizedData.description,
        theme: sanitizedData.theme,
        autoAdmit: sanitizedData.autoAdmit ?? true,
        sourceLanguage: resolveSourceLanguage(sanitizedData.sourceLanguage),
        hintCount: powerUps.hintCount ?? 0,
        copyAnswerCount: powerUps.copyAnswerCount ?? 0,
        doublePointsCount: powerUps.doublePointsCount ?? 0,
        questions: {
          create: sanitizedData.questions.map((q) => ({
            questionText: q.questionText,
            imageUrl: q.imageRef ? imageMapping.get(q.imageRef) || null : null,
            hostNotes: q.hostNotes,
            questionType: q.questionType,
            timeLimit: q.timeLimit,
            points: q.points,
            orderIndex: q.orderIndex,
            hint: q.hint || null,
            categoriseData: q.categoriseData ? JSON.stringify(q.categoriseData) : null,
            matchingData: q.matchingData ? JSON.stringify(q.matchingData) : null,
            easterEggEnabled: q.easterEggEnabled ?? false,
            easterEggButtonText: q.easterEggEnabled ? q.easterEggButtonText : null,
            easterEggUrl: q.easterEggEnabled ? q.easterEggUrl : null,
            easterEggDisablesScoring: q.easterEggEnabled ? q.easterEggDisablesScoring ?? false : false,
            translations: q.translations && q.translations.length > 0 ? {
              create: q.translations.map((t) => ({
                languageCode: t.languageCode,
                questionText: t.questionText,
                hostNotes: t.hostNotes || null,
                hint: t.hint || null,
                easterEggButtonText: t.easterEggButtonText || null,
                isAutoTranslated: false,
              })),
            } : undefined,
            contentTranslations: q.contentTranslations && q.contentTranslations.length > 0 ? {
              create: q.contentTranslations.map((t) => ({
                languageCode: t.languageCode,
                contentData: t.contentData,
                isAutoTranslated: false,
              })),
            } : undefined,
            answers: {
              create: q.answers.map((a) => ({
                answerText: a.answerText,
                imageUrl: a.imageRef ? imageMapping.get(a.imageRef) || null : null,
                isCorrect: a.isCorrect,
                orderIndex: a.orderIndex,
                translations: a.translations && a.translations.length > 0 ? {
                  create: a.translations.map((t) => ({
                    languageCode: t.languageCode,
                    answerText: t.answerText,
                    isAutoTranslated: false,
                  })),
                } : undefined,
              })),
            },
          })),
        },
      },
      include: {
        questions: {
          include: {
            answers: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      quizId: newQuiz.id,
      message: `Quiz "${newQuiz.title}" imported successfully`,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import quiz" },
      { status: 500 }
    );
  }
}

// Helper: Upload image buffer to storage
async function uploadImageToStorage(
  buffer: Buffer,
  originalPath: string
): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }

  // Get extension from original path
  const ext = path.extname(originalPath) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  const filepath = path.join(uploadsDir, filename);

  await writeFile(filepath, buffer);

  return `/uploads/${filename}`;
}
