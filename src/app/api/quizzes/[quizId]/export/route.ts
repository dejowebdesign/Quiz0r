/**
 * Quiz Export API
 * Exports a quiz as a ZIP file containing quiz.json and images
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import JSZip from "jszip";
import { ExportedQuiz } from "@/types/export";
import { requireAdmin } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ quizId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { quizId } = await params;

    // 1. Fetch quiz with all relations
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          include: {
            translations: true,
            answers: {
              include: {
                translations: true,
              },
              orderBy: { orderIndex: "asc" },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // 2. Create ZIP file
    const zip = new JSZip();
    const imagesFolder = zip.folder("images");

    // Track image downloads for de-duplication
    const downloadedImages = new Map<string, string>(); // url -> ref

    // 3. Process questions and download images
    const exportedQuestions = await Promise.all(
      quiz.questions.map(async (question, qIndex) => {
        let imageRef: string | null = null;

        // Download question image
        if (question.imageUrl && imagesFolder) {
          imageRef = await downloadAndAddImage(
            question.imageUrl,
            `q_${qIndex}`,
            imagesFolder,
            downloadedImages
          );
        }

        // Process answers
        const exportedAnswers = await Promise.all(
          question.answers.map(async (answer, aIndex) => {
            let answerImageRef: string | null = null;

            if (answer.imageUrl && imagesFolder) {
              answerImageRef = await downloadAndAddImage(
                answer.imageUrl,
                `a_${qIndex}_${aIndex}`,
                imagesFolder,
                downloadedImages
              );
            }

            return {
              answerText: answer.answerText,
              imageRef: answerImageRef,
              isCorrect: answer.isCorrect,
              orderIndex: answer.orderIndex,
              translations: answer.translations?.map((t) => ({
                languageCode: t.languageCode,
                answerText: t.answerText,
              })) ?? [],
            };
          })
        );

        return {
          questionText: question.questionText,
          imageRef,
          hostNotes: question.hostNotes,
          questionType: question.questionType as "SINGLE_SELECT" | "MULTI_SELECT" | "SECTION",
          timeLimit: question.timeLimit,
          points: question.points,
          orderIndex: question.orderIndex,
          hint: question.hint,
          easterEggEnabled: question.easterEggEnabled,
          easterEggButtonText: question.easterEggButtonText,
          easterEggUrl: question.easterEggUrl,
          easterEggDisablesScoring: question.easterEggDisablesScoring,
          translations: question.translations?.map((t) => ({
            languageCode: t.languageCode,
            questionText: t.questionText,
            hostNotes: t.hostNotes,
            hint: t.hint,
            easterEggButtonText: t.easterEggButtonText,
          })) ?? [],
          answers: exportedAnswers,
        };
      })
    );

    // 4. Create quiz.json
    const exportData: ExportedQuiz = {
      exportVersion: "1.1",
      exportedAt: new Date().toISOString(),
      title: quiz.title,
      description: quiz.description,
      theme: quiz.theme,
      autoAdmit: quiz.autoAdmit,
      powerUps: {
        hintCount: quiz.hintCount,
        copyAnswerCount: quiz.copyAnswerCount,
        doublePointsCount: quiz.doublePointsCount,
      },
      sourceLanguage: quiz.sourceLanguage,
      questions: exportedQuestions,
    };

    zip.file("quiz.json", JSON.stringify(exportData, null, 2));

    // 5. Generate ZIP as blob for NextResponse compatibility
    const zipBlob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    // 6. Return as download
    return new NextResponse(zipBlob, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(quiz.title)}.zip"`,
        "Content-Length": zipBlob.size.toString(),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export quiz" },
      { status: 500 }
    );
  }
}

// Helper: Download image and add to ZIP
async function downloadAndAddImage(
  url: string,
  baseName: string,
  imagesFolder: JSZip,
  cache: Map<string, string>
): Promise<string | null> {
  // Check cache for de-duplication
  if (cache.has(url)) {
    return cache.get(url)!;
  }

  try {
    // Handle relative URLs (uploaded images)
    const absoluteUrl = url.startsWith("http")
      ? url
      : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${url}`;

    const response = await fetch(absoluteUrl, {
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to download image: ${url}`);
      return null;
    }

    const buffer = await response.arrayBuffer();

    // Detect extension from Content-Type or URL
    const contentType = response.headers.get("content-type") || "";
    const ext = getExtensionFromContentType(contentType) || getExtensionFromUrl(url) || "jpg";

    const filename = `${baseName}.${ext}`;
    const ref = `images/${filename}`;

    imagesFolder.file(filename, buffer);
    cache.set(url, ref);

    return ref;
  } catch (error) {
    console.warn(`Error downloading image ${url}:`, error);
    return null;
  }
}

// Helper: Get file extension from content-type
function getExtensionFromContentType(contentType: string): string | null {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[contentType.split(";")[0].trim()] || null;
}

// Helper: Get extension from URL
function getExtensionFromUrl(url: string): string | null {
  const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : null;
}

// Helper: Sanitize filename for safe download
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9_\-]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
}
