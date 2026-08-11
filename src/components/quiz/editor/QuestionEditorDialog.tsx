"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Image,
  Upload,
  Loader2,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Sparkles,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SupportedLanguages, type LanguageCode } from "@/types";

interface Answer {
  id?: string;
  answerText: string;
  imageUrl?: string | null;
  isCorrect: boolean;
}

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  hostNotes?: string | null;
  hint?: string | null;
  questionType: string;
  timeLimit: number;
  points: number;
  answers: Answer[];
}

interface QuestionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingQuestion: Question | null;
  hintRequired: boolean;

  // Form state
  questionText: string;
  setQuestionText: (value: string) => void;
  imageUrl: string;
  setImageUrl: (value: string) => void;
  hostNotes: string;
  setHostNotes: (value: string) => void;
  hint: string;
  setHint: (value: string) => void;
  questionType: string;
  setQuestionType: (value: string) => void;
  timeLimit: number;
  setTimeLimit: (value: number) => void;
  points: number;
  setPoints: (value: number) => void;
  answers: Answer[];
  setAnswers: (value: Answer[]) => void;

  // Easter egg state
  easterEggEnabled: boolean;
  setEasterEggEnabled: (value: boolean) => void;
  easterEggButtonText: string;
  setEasterEggButtonText: (value: string) => void;
  easterEggUrl: string;
  setEasterEggUrl: (value: string) => void;
  easterEggDisablesScoring: boolean;
  setEasterEggDisablesScoring: (value: boolean) => void;

  // Translation state (for editing existing questions)
  availableTranslationLanguages: LanguageCode[];
  activeTranslationTab: string;
  setActiveTranslationTab: (value: string) => void;
  questionTranslations: Record<LanguageCode, any>;
  answerTranslations: Record<string, Record<LanguageCode, string>>;
  onAddTranslationLanguage: (lang: LanguageCode) => void;
  onUpdateQuestionTranslation: (
    lang: LanguageCode,
    field: string,
    value: string
  ) => void;
  onUpdateAnswerTranslation: (
    answer: Answer,
    lang: LanguageCode,
    value: string
  ) => void;
  onCopyToTranslation: (field: string, value: string, lang: LanguageCode) => void;
  onCopyAnswerToTranslation: (answer: Answer, lang: LanguageCode) => void;
  onAutoTranslate: (lang: LanguageCode) => void;
  onSaveTranslation: (lang: LanguageCode) => void;
  autoTranslatingQuestion: LanguageCode | null;
  savingTranslation: LanguageCode | null;
  getTranslationStatus: (lang: LanguageCode) => "complete" | "partial" | "empty";

  // Handlers
  uploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function QuestionEditorDialog({
  open,
  onOpenChange,
  editingQuestion,
  hintRequired,

  questionText,
  setQuestionText,
  imageUrl,
  setImageUrl,
  hostNotes,
  setHostNotes,
  hint,
  setHint,
  questionType,
  setQuestionType,
  timeLimit,
  setTimeLimit,
  points,
  setPoints,
  answers,
  setAnswers,

  easterEggEnabled,
  setEasterEggEnabled,
  easterEggButtonText,
  setEasterEggButtonText,
  easterEggUrl,
  setEasterEggUrl,
  easterEggDisablesScoring,
  setEasterEggDisablesScoring,

  availableTranslationLanguages,
  activeTranslationTab,
  setActiveTranslationTab,
  questionTranslations,
  answerTranslations,
  onAddTranslationLanguage,
  onUpdateQuestionTranslation,
  onUpdateAnswerTranslation,
  onCopyToTranslation,
  onCopyAnswerToTranslation,
  onAutoTranslate,
  onSaveTranslation,
  autoTranslatingQuestion,
  savingTranslation,
  getTranslationStatus,

  uploading,
  onImageUpload,
  onRemoveImage,
  onSave,
  onCancel,
}: QuestionEditorDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(easterEggEnabled);

  const addAnswer = () => {
    if (answers.length < 6) {
      setAnswers([...answers, { answerText: "", isCorrect: false }]);
    }
  };

  const removeAnswer = (index: number) => {
    if (answers.length > 2) {
      setAnswers(answers.filter((_, i) => i !== index));
    }
  };

  const updateAnswer = (
    index: number,
    field: keyof Answer,
    value: unknown
  ) => {
    const newAnswers = [...answers];
    newAnswers[index] = { ...newAnswers[index], [field]: value };

    // For single select, ensure only one answer is correct
    if (
      field === "isCorrect" &&
      value === true &&
      questionType === "SINGLE_SELECT"
    ) {
      newAnswers.forEach((a, i) => {
        if (i !== index) a.isCorrect = false;
      });
    }

    setAnswers(newAnswers);
  };

  // Validation
  const validAnswers = answers.filter((a) => a.answerText.trim());
  const hasValidQuestion = questionText.trim().length > 0;
  const hasEnoughAnswers = validAnswers.length >= 2;
  const hasCorrectAnswer = validAnswers.some((a) => a.isCorrect);
  const hasRequiredHint = !hintRequired || hint.trim().length > 0;
  const canSave =
    hasValidQuestion && hasEnoughAnswers && hasCorrectAnswer && hasRequiredHint;

  return (
    <Dialog open={open ?? false} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Custom close button positioned at top-right, above sticky header */}
        <button
          type="button"
          onClick={() => {
            onCancel();
            onOpenChange(false);
          }}
          className="absolute right-4 top-4 z-20 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-background px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <DialogHeader className="flex-1">
              <DialogTitle>
                {editingQuestion ? "Edit" : "Add"} Question
              </DialogTitle>
              <DialogDescription>
                Create a multiple choice question with 2-6 answer options.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs
          value={activeTranslationTab}
          onValueChange={setActiveTranslationTab}
          className="py-2"
        >
          {/* Translation controls - show for editing existing questions */}
          {editingQuestion && (
            <div className="flex items-center gap-2 mb-4">
              {/* Only show tabs when there are multiple languages */}
              {availableTranslationLanguages.length > 1 && (
                <TabsList
                  className="grid"
                  style={{
                    gridTemplateColumns: `repeat(${availableTranslationLanguages.length}, minmax(0, 1fr))`,
                  }}
                >
                  {availableTranslationLanguages.map((lang) => (
                    <TabsTrigger
                      key={lang}
                      value={lang}
                      className="flex items-center gap-1.5"
                    >
                      {SupportedLanguages[lang].flag}{" "}
                      {SupportedLanguages[lang].name}
                      {lang !== "en" &&
                        (getTranslationStatus(lang) === "complete" ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : getTranslationStatus(lang) === "partial" ? (
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        ))}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}

              {/* Add Language dropdown - always visible when editing */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Translation
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(Object.keys(SupportedLanguages) as LanguageCode[])
                    .filter(
                      (lang) =>
                        lang !== "en" &&
                        !availableTranslationLanguages.includes(lang)
                    )
                    .map((lang) => (
                      <DropdownMenuItem
                        key={lang}
                        onClick={() => onAddTranslationLanguage(lang)}
                      >
                        {SupportedLanguages[lang].flag}{" "}
                        {SupportedLanguages[lang].name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* English (original) tab */}
          <TabsContent value="en" className="space-y-6 mt-0">
            {/* Section 1: Question Text + Image */}
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="questionText">
                  Question <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="questionText"
                  placeholder="Enter your question..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={2}
                  className={
                    !hasValidQuestion && questionText.length > 0
                      ? "border-destructive"
                      : ""
                  }
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>
                  <Image className="w-4 h-4 inline mr-2" />
                  Image (optional)
                </Label>

                {imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={imageUrl}
                      alt="Question"
                      className="max-h-32 rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={onRemoveImage}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={onImageUpload}
                      disabled={uploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-20"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin mb-1" />
                          <span className="text-xs">Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Upload className="w-5 h-5 mb-1" />
                          <span className="text-xs">Click to upload</span>
                        </div>
                      )}
                    </Button>
                    <Input
                      placeholder="Or paste URL"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Type + Time/Points */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={
                      questionType === "SINGLE_SELECT" ? "default" : "outline"
                    }
                    size="sm"
                    className="flex-1"
                    onClick={() => setQuestionType("SINGLE_SELECT")}
                  >
                    Single
                  </Button>
                  <Button
                    type="button"
                    variant={
                      questionType === "MULTI_SELECT" ? "default" : "outline"
                    }
                    size="sm"
                    className="flex-1"
                    onClick={() => setQuestionType("MULTI_SELECT")}
                  >
                    Multi
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeLimit">Time (sec)</Label>
                <Input
                  id="timeLimit"
                  type="number"
                  min={5}
                  max={120}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Section 3: Answers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>
                  Answers <span className="text-destructive">*</span>
                  {!hasEnoughAnswers && (
                    <span className="text-xs text-destructive ml-2">
                      (min 2 required)
                    </span>
                  )}
                  {hasEnoughAnswers && !hasCorrectAnswer && (
                    <span className="text-xs text-destructive ml-2">
                      (mark at least one correct)
                    </span>
                  )}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAnswer}
                  disabled={answers.length >= 6}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {answers.map((answer, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder={`Answer ${index + 1}`}
                      value={answer.answerText}
                      onChange={(e) =>
                        updateAnswer(index, "answerText", e.target.value)
                      }
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={answer.isCorrect ? "default" : "outline"}
                      size="icon"
                      className={`h-9 w-9 shrink-0 ${
                        answer.isCorrect
                          ? "bg-green-600 hover:bg-green-700"
                          : ""
                      }`}
                      onClick={() =>
                        updateAnswer(index, "isCorrect", !answer.isCorrect)
                      }
                    >
                      {answer.isCorrect ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAnswer(index)}
                      disabled={answers.length <= 2}
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {questionType === "MULTI_SELECT" && (
                <p className="text-xs text-muted-foreground">
                  Multiple answers can be marked as correct. Players get partial
                  credit for each correct answer selected.
                </p>
              )}
            </div>

            {/* Section 4: Host Notes + Hint */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hostNotes">Host Notes (optional)</Label>
                <Textarea
                  id="hostNotes"
                  placeholder="Notes visible only to the host..."
                  value={hostNotes}
                  onChange={(e) => setHostNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hint">
                    Hint{" "}
                    {hintRequired && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  {hintRequired && (
                    <span className="text-xs text-muted-foreground">
                      Required (Hint power-up enabled)
                    </span>
                  )}
                </div>
                <Textarea
                  id="hint"
                  placeholder="Provide a helpful hint..."
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  rows={2}
                  maxLength={200}
                  className={`text-sm ${
                    hintRequired && !hint.trim() ? "border-amber-500" : ""
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  {hint.length}/200 characters
                </p>
              </div>
            </div>

            {/* Section 5: Easter Egg (Collapsible) */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-between text-muted-foreground"
                >
                  <span>Advanced Options</span>
                  {advancedOpen ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-2">
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="easterEgg">Easter Egg Button</Label>
                      <p className="text-xs text-muted-foreground">
                        Add a special button that opens a web page
                      </p>
                    </div>
                    <Switch
                      id="easterEgg"
                      checked={easterEggEnabled}
                      onCheckedChange={setEasterEggEnabled}
                    />
                  </div>

                  {easterEggEnabled && (
                    <div className="space-y-3 pl-4 border-l-2">
                      <div className="space-y-2">
                        <Label htmlFor="easterEggButtonText">Button Text</Label>
                        <Input
                          id="easterEggButtonText"
                          placeholder="Click for a surprise!"
                          value={easterEggButtonText}
                          onChange={(e) =>
                            setEasterEggButtonText(e.target.value)
                          }
                          maxLength={50}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="easterEggUrl">URL</Label>
                        <Input
                          id="easterEggUrl"
                          type="url"
                          placeholder="https://example.com"
                          value={easterEggUrl}
                          onChange={(e) => setEasterEggUrl(e.target.value)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="disableScoring">Disable Scoring</Label>
                          <p className="text-xs text-muted-foreground">
                            Players who click won&apos;t earn points
                          </p>
                        </div>
                        <Switch
                          id="disableScoring"
                          checked={easterEggDisablesScoring}
                          onCheckedChange={setEasterEggDisablesScoring}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* Translation tabs */}
          {editingQuestion &&
            availableTranslationLanguages
              .filter((lang) => lang !== "en")
              .map((lang) => (
                <TabsContent
                  key={lang}
                  value={lang}
                  className="space-y-4 mt-0"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-muted-foreground">
                      Translate to {SupportedLanguages[lang].name}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAutoTranslate(lang)}
                        disabled={autoTranslatingQuestion === lang}
                      >
                        {autoTranslatingQuestion === lang ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Translating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            Auto-Translate
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onSaveTranslation(lang)}
                        disabled={savingTranslation === lang}
                      >
                        {savingTranslation === lang ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Question Translation */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Question</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onCopyToTranslation("questionText", questionText, lang)
                        }
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy English
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Textarea
                        value={questionText}
                        disabled
                        className="bg-muted text-sm"
                        rows={2}
                      />
                      <Textarea
                        value={questionTranslations[lang]?.questionText || ""}
                        onChange={(e) =>
                          onUpdateQuestionTranslation(
                            lang,
                            "questionText",
                            e.target.value
                          )
                        }
                        placeholder={`${SupportedLanguages[lang].name} translation...`}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* Answer Translations */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Answers</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          answers.forEach((answer) =>
                            onCopyAnswerToTranslation(answer, lang)
                          )
                        }
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy English
                      </Button>
                    </div>
                    {answers.map((answer, index) => (
                      <div key={index} className="grid grid-cols-2 gap-2">
                        <Input
                          value={answer.answerText}
                          disabled
                          className="bg-muted text-sm"
                        />
                        <div className="flex gap-1">
                          <Input
                            value={
                              answerTranslations[
                                answer.id || `answer-${index}`
                              ]?.[lang] || ""
                            }
                            onChange={(e) =>
                              onUpdateAnswerTranslation(
                                answer,
                                lang,
                                e.target.value
                              )
                            }
                            placeholder={`${SupportedLanguages[lang].name}...`}
                            className="text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() =>
                              onCopyAnswerToTranslation(answer, lang)
                            }
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Hint Translation */}
                  {hint && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Hint</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onCopyToTranslation("hint", hint, lang)
                          }
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy English
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Textarea
                          value={hint}
                          disabled
                          className="bg-muted text-sm"
                          rows={2}
                        />
                        <Textarea
                          value={questionTranslations[lang]?.hint || ""}
                          onChange={(e) =>
                            onUpdateQuestionTranslation(
                              lang,
                              "hint",
                              e.target.value
                            )
                          }
                          placeholder={`${SupportedLanguages[lang].name} translation...`}
                          rows={2}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
        </Tabs>
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-background px-6 py-4 border-t flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {editingQuestion ? "Save Changes" : "Add Question"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
