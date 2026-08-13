"use client";

import { useRef } from "react";
import {
  Image,
  Upload,
  Loader2,
  Trash2,
  X,
  Plus,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { SupportedLanguages, type LanguageCode } from "@/types";

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string | null;
  hostNotes?: string | null;
  questionType: string;
}

interface SectionEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSection: Question | null;

  // Form state
  sectionTitle: string;
  setSectionTitle: (value: string) => void;
  sectionDescription: string;
  setSectionDescription: (value: string) => void;
  imageUrl: string;
  setImageUrl: (value: string) => void;

  // Translation state (for editing existing sections)
  availableTranslationLanguages: LanguageCode[];
  activeTranslationTab: string;
  setActiveTranslationTab: (value: string) => void;
  sourceLanguage: LanguageCode;
  sectionTranslations: Record<LanguageCode, { questionText?: string; hostNotes?: string }>;
  onAddTranslationLanguage: (lang: LanguageCode) => void;
  onUpdateSectionTranslation: (
    lang: LanguageCode,
    field: string,
    value: string
  ) => void;
  onCopyToTranslation: (field: string, value: string, lang: LanguageCode) => void;
  onAutoTranslate: (lang: LanguageCode) => void;
  onSaveTranslation: (lang: LanguageCode) => void;
  autoTranslatingSection: LanguageCode | null;
  savingTranslation: LanguageCode | null;
  getTranslationStatus: (lang: LanguageCode) => "complete" | "partial" | "empty";

  // Handlers
  uploading: boolean;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function SectionEditorDialog({
  open,
  onOpenChange,
  editingSection,

  sectionTitle,
  setSectionTitle,
  sectionDescription,
  setSectionDescription,
  imageUrl,
  setImageUrl,

  availableTranslationLanguages,
  activeTranslationTab,
  setActiveTranslationTab,
  sourceLanguage,
  sectionTranslations,
  onAddTranslationLanguage,
  onUpdateSectionTranslation,
  onCopyToTranslation,
  onAutoTranslate,
  onSaveTranslation,
  autoTranslatingSection,
  savingTranslation,
  getTranslationStatus,

  uploading,
  onImageUpload,
  onRemoveImage,
  onSave,
  onCancel,
}: SectionEditorDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSave = sectionTitle.trim().length > 0;

  return (
    <Dialog open={open ?? false} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
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
                {editingSection ? t("editor.fields.editSection") : t("editor.fields.addSection")}
              </DialogTitle>
              <DialogDescription>
                Sections help organize your quiz into logical groups.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Tabs
            value={activeTranslationTab}
            onValueChange={setActiveTranslationTab}
            className="space-y-4"
          >
            {/* Translation controls - show for editing existing sections */}
            {editingSection && (
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
                        className="flex items-center gap-1.5 text-xs"
                      >
                        {SupportedLanguages[lang].flag}{" "}
                        <span className="hidden sm:inline">{SupportedLanguages[lang].name}</span>
                        {lang !== sourceLanguage &&
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
                      {t("editor.fields.addTranslation")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {(Object.keys(SupportedLanguages) as LanguageCode[])
                      .filter(
                        (lang) =>
                          lang !== sourceLanguage &&
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
            <TabsContent value={sourceLanguage} className="space-y-4 mt-0">
              {/* Section Title */}
              <div className="space-y-2">
                <Label htmlFor="sectionTitle">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sectionTitle"
                  placeholder={t("editor.fields.sectionTitlePlaceholder")}
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                />
              </div>

              {/* Section Description */}
              <div className="space-y-2">
                <Label htmlFor="sectionDescription">{t("editor.fields.sectionDescription")}</Label>
                <Textarea
                  id="sectionDescription"
                  placeholder={t("editor.fields.sectionDescriptionPlaceholder")}
                  value={sectionDescription}
                  onChange={(e) => setSectionDescription(e.target.value)}
                  rows={2}
                  className="text-sm"
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
                      alt="Section"
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
                          <span className="text-xs">{t("editor.fields.uploading")}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground">
                          <Upload className="w-5 h-5 mb-1" />
                          <span className="text-xs">{t("editor.fields.clickToUpload")}</span>
                        </div>
                      )}
                    </Button>
                    <Input
                      placeholder={t("editor.fields.orPasteUrl")}
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Translation tabs */}
            {editingSection &&
              availableTranslationLanguages
                .filter((lang) => lang !== sourceLanguage)
                .map((lang) => (
                  <TabsContent
                    key={lang}
                    value={lang}
                    className="space-y-4 mt-0"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">
                        {t("editor.fields.translateTo", { name: SupportedLanguages[lang].name })}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAutoTranslate(lang)}
                          disabled={autoTranslatingSection === lang}
                        >
                          {autoTranslatingSection === lang ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              {t("editor.translate.translating")}
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 mr-1" />
                              {t("editor.fields.autoTranslate")}
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
                            t("editor.fields.save")
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Title Translation */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("editor.fields.title")}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onCopyToTranslation("questionText", sectionTitle, lang)
                          }
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          {t("editor.fields.copySource", { name: SupportedLanguages[sourceLanguage].name })}
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={sectionTitle}
                          disabled
                          className="bg-muted text-sm"
                        />
                        <Input
                          value={sectionTranslations[lang]?.questionText || ""}
                          onChange={(e) =>
                            onUpdateSectionTranslation(
                              lang,
                              "questionText",
                              e.target.value
                            )
                          }
                          placeholder={t("editor.fields.translationPlaceholder", { name: SupportedLanguages[lang].name })}
                          className="text-sm"
                        />
                      </div>
                    </div>

                    {/* Description Translation */}
                    {sectionDescription && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>{t("editor.fields.description")}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              onCopyToTranslation("hostNotes", sectionDescription, lang)
                            }
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            {t("editor.fields.copySource", { name: SupportedLanguages[sourceLanguage].name })}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Textarea
                            value={sectionDescription}
                            disabled
                            className="bg-muted text-sm"
                            rows={2}
                          />
                          <Textarea
                            value={sectionTranslations[lang]?.hostNotes || ""}
                            onChange={(e) =>
                              onUpdateSectionTranslation(
                                lang,
                                "hostNotes",
                                e.target.value
                              )
                            }
                            placeholder={t("editor.fields.translationPlaceholder", { name: SupportedLanguages[lang].name })}
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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!canSave}>
            {editingSection ? t("editor.fields.saveChanges") : t("editor.fields.addSection")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
