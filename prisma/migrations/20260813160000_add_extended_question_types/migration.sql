-- Add nullable structured-content JSON columns for the extended question
-- types (CATEGORISE, MATCHING). Existing SINGLE_SELECT/MULTI_SELECT/SECTION
-- questions keep NULL and are unaffected (backward compatible).
ALTER TABLE "Question" ADD COLUMN "categoriseData" TEXT;
ALTER TABLE "Question" ADD COLUMN "matchingData" TEXT;

-- Translation table for the structured content (category/item/pair labels)
-- of CATEGORISE/MATCHING questions.
CREATE TABLE "QuestionContentTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "contentData" TEXT NOT NULL,
    "isAutoTranslated" BOOLEAN NOT NULL DEFAULT true,
    "translatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuestionContentTranslation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "QuestionContentTranslation_questionId_languageCode_key" ON "QuestionContentTranslation"("questionId", "languageCode");
CREATE INDEX "QuestionContentTranslation_questionId_idx" ON "QuestionContentTranslation"("questionId");
CREATE INDEX "QuestionContentTranslation_languageCode_idx" ON "QuestionContentTranslation"("languageCode");
