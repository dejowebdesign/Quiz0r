"use client";

import { useTranslation } from "@/hooks/useTranslation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export function LanguageSelector({ className, showLabel = false }: LanguageSelectorProps) {
  const { locale, setLocale, availableLocales } = useTranslation();

  return (
    <Select value={locale} onValueChange={(value) => setLocale(value as typeof locale)}>
      <SelectTrigger className={className} aria-label="Select language">
        <Globe className="w-4 h-4 mr-2" />
        {showLabel && (
          <span className="mr-2">
            {availableLocales[locale].flag} {availableLocales[locale].name}
          </span>
        )}
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(availableLocales) as Array<keyof typeof availableLocales>).map(
          (localeKey) => {
            const localeInfo = availableLocales[localeKey];
            return (
              <SelectItem key={localeKey} value={localeKey}>
                <span className="flex items-center gap-2">
                  <span>{localeInfo.flag}</span>
                  <span>{localeInfo.name}</span>
                </span>
              </SelectItem>
            );
          }
        )}
      </SelectContent>
    </Select>
  );
}
