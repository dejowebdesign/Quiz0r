-- Add sourceLanguage column to Quiz.
-- Existing quizzes predate the field; they were authored under the
-- historical assumption that English is the base language, so default to 'en'.
ALTER TABLE "Quiz" ADD COLUMN "sourceLanguage" TEXT;

-- Backfill existing quizzes with the historical English base language.
UPDATE "Quiz" SET "sourceLanguage" = 'en' WHERE "sourceLanguage" IS NULL;

-- Split Serbian into Latin (sr-Latn) and Cyrillic (sr-Cyrl) variants.
-- All previously-stored 'sr' content was authored in Latin script, so migrate
-- existing 'sr' translations to the new 'sr-Latn' code.
UPDATE "QuestionTranslation" SET "languageCode" = 'sr-Latn' WHERE "languageCode" = 'sr';
UPDATE "AnswerTranslation" SET "languageCode" = 'sr-Latn' WHERE "languageCode" = 'sr';
