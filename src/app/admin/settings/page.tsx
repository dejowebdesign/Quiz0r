"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Settings,
  Globe,
  Key,
  Play,
  Square,
  Loader2,
  Check,
  ExternalLink,
  Copy,
  Link2,
  Download,
  Upload,
  AlertTriangle,
  Image,
} from "lucide-react";
import { ExportDialog } from "@/components/settings/ExportDialog";
import { ImportDialog } from "@/components/settings/ImportDialog";
import { AIProviderSection } from "@/components/settings/AIProviderSection";
import { useTranslation } from "@/hooks/useTranslation";

interface SettingsData {
  ngrokToken: string | null;
  hasToken: boolean;
  tunnelRunning: boolean;
  tunnelUrl: string | null;
  shortioApiKey: string | null;
  hasShortioApiKey: boolean;
  shortioDomain: string | null;
  openaiApiKey: string | null;
  hasOpenaiApiKey: boolean;
  unsplashApiKey: string | null;
  hasUnsplashApiKey: boolean;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [shortioApiKeyInput, setShortioApiKeyInput] = useState("");
  const [shortioDomainInput, setShortioDomainInput] = useState("");
  const [showShortio, setShowShortio] = useState(false);
  const [savingShortio, setSavingShortio] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [unsplashApiKeyInput, setUnsplashApiKeyInput] = useState("");
  const [showUnsplash, setShowUnsplash] = useState(false);
  const [savingUnsplash, setSavingUnsplash] = useState(false);
  const [showRemoveUnsplashDialog, setShowRemoveUnsplashDialog] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [showExportNotice, setShowExportNotice] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [removeTokenDialogOpen, setRemoveTokenDialogOpen] = useState(false);
  // Raw secret values fetched on demand from the export endpoint so that
  // secrets are not held in the regular settings state.
  const [rawSettings, setRawSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRawSettings() {
    try {
      const res = await fetch("/api/settings/export");
      if (res.ok) {
        const data = (await res.json()) as Record<string, string>;
        setRawSettings(data || {});
      }
    } catch (error) {
      console.error("Failed to fetch raw settings:", error);
    }
  }

  async function saveToken() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ngrokToken: tokenInput }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.tokenSaved") });
        setTokenInput("");
        setShowToken(false);
        fetchSettings();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || t("settings.failedToSaveToken") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToSaveToken") });
    } finally {
      setSaving(false);
    }
  }

  async function removeToken() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ngrokToken: "" }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.tokenRemoved") });
    fetchSettings();
  }

    } catch {
      setMessage({ type: "error", text: t("settings.failedToRemoveToken") });
    } finally {
      setSaving(false);
      setRemoveTokenDialogOpen(false);
    }
  }

  async function startTunnel() {
    setTunnelLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/tunnel", {
        method: "POST",
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.tunnelStarted") });
        fetchSettings();
      } else {
        setMessage({ type: "error", text: data.error || t("settings.failedToStartTunnel") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToStartTunnel") });
    } finally {
      setTunnelLoading(false);
    }
  }

  async function stopTunnel() {
    setTunnelLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/tunnel", {
        method: "DELETE",
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.tunnelStopped") });
        // Clear cached URL from localStorage
        localStorage.removeItem("quiz0r-base-url");
        fetchSettings();
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToStopTunnel") });
    } finally {
      setTunnelLoading(false);
    }
  }

  function copyUrl() {
    if (settings?.tunnelUrl) {
      navigator.clipboard.writeText(settings.tunnelUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function saveShortioSettings() {
    setSavingShortio(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortioApiKey: shortioApiKeyInput,
          shortioDomain: shortioDomainInput,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.shortioSaved") });
        setShortioApiKeyInput("");
        setShortioDomainInput("");
        setShowShortio(false);
        fetchSettings();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || t("settings.failedToSaveShortio") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToSaveShortio") });
    } finally {
      setSavingShortio(false);
    }
  }

  async function confirmRemoveShortioSettings() {
    setSavingShortio(true);
    setMessage(null);
    setShowRemoveDialog(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortioApiKey: "", shortioDomain: "" }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.shortioRemoved") });
        fetchSettings();
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToRemoveShortio") });
    } finally {
      setSavingShortio(false);
    }
  }

  async function saveUnsplashSettings() {
    setSavingUnsplash(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unsplashApiKey: unsplashApiKeyInput,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.unsplashSaved") });
        setUnsplashApiKeyInput("");
        setShowUnsplash(false);
        fetchSettings();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || t("settings.failedToSaveUnsplash") });
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToSaveUnsplash") });
    } finally {
      setSavingUnsplash(false);
    }
  }

  async function confirmRemoveUnsplashSettings() {
    setSavingUnsplash(true);
    setMessage(null);
    setShowRemoveUnsplashDialog(false);

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unsplashApiKey: "" }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("settings.unsplashRemoved") });
        fetchSettings();
      }
    } catch {
      setMessage({ type: "error", text: t("settings.failedToRemoveUnsplash") });
    } finally {
      setSavingUnsplash(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("settings.backToQuizzes")}
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="w-8 h-8" />
            {t("settings.title")}
          </h1>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Backup & Restore Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            {t("settings.backupRestore")}
          </CardTitle>
          <CardDescription>
            {t("settings.backupRestoreDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                await fetchRawSettings();
                setExportDialogOpen(true);
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              {t("settings.exportSettings")}
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await fetchRawSettings();
                setImportDialogOpen(true);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("settings.importSettings")}
            </Button>
          </div>

          {showExportNotice && (
            <div className="flex gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-900 dark:text-amber-100">
                {t("settings.exportNotice")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tunnel Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t("settings.externalTunnel")}
          </CardTitle>
          <CardDescription>
            {t("settings.externalTunnelDescPrefix")}{" "}
            <a
              href="https://dashboard.ngrok.com/get-started/your-authtoken"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              ngrok.com
            </a>
            {t("settings.externalTunnelDescSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Token Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label>{t("settings.ngrokAuthToken")}</Label>
            </div>

              {settings?.hasToken ? (
              <div className="flex items-center gap-4">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                  {settings.ngrokToken}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRemoveTokenDialogOpen(true)}
                  disabled={saving}
                >
                  {t("settings.remove")}
                </Button>
              </div>
            ) : showToken ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder={t("settings.tokenPlaceholder")}
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={saveToken} disabled={!tokenInput || saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("settings.save")}
                  </Button>
                  <Button variant="outline" onClick={() => setShowToken(false)}>
                    {t("settings.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowToken(true)}>
                <Key className="w-4 h-4 mr-2" />
                {t("settings.addToken")}
              </Button>
            )}
          </div>

          {/* Tunnel Status */}
          {settings?.hasToken && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("settings.tunnelStatus")}</span>
                  {settings.tunnelRunning ? (
                    <Badge className="bg-green-500">{t("settings.running")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("settings.stopped")}</Badge>
                  )}
                </div>

                {settings.tunnelRunning ? (
                  <Button
                    variant="outline"
                    onClick={stopTunnel}
                    disabled={tunnelLoading}
                  >
                    {tunnelLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Square className="w-4 h-4 mr-2" />
                    )}
                    {t("settings.stopTunnel")}
                  </Button>
                ) : (
                  <Button onClick={startTunnel} disabled={tunnelLoading}>
                    {tunnelLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {t("settings.startTunnel")}
                  </Button>
                )}
              </div>

              {settings.tunnelUrl && (
                <div className="space-y-2">
                  <Label>{t("settings.publicUrl")}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm break-all">
                      {settings.tunnelUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={copyUrl}>
                      {copied ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <a
                      href={settings.tunnelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.publicUrlHint")}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Short.io Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            {t("settings.shortio")}
          </CardTitle>
          <CardDescription>
            {t("settings.shortioDescPrefix")}{" "}
            <a
              href="https://app.short.io/settings/integrations/api-key"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              short.io
            </a>
            {t("settings.shortioDescSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Key Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label>{t("settings.shortioApiKey")}</Label>
            </div>

            {settings?.hasShortioApiKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                    {settings.shortioApiKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveDialog(true)}
                    disabled={savingShortio}
                  >
                    {t("settings.remove")}
                  </Button>
                </div>
                {settings.shortioDomain && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">{t("settings.domain")}</Label>
                    <code className="block px-3 py-2 bg-muted rounded-md text-sm">
                      {settings.shortioDomain}
                    </code>
                  </div>
                )}
              </div>
            ) : showShortio ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={t("settings.shortioKeyPlaceholder")}
                    value={shortioApiKeyInput}
                    onChange={(e) => setShortioApiKeyInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("settings.domainLabel")}</Label>
                  <Input
                    type="text"
                    placeholder={t("settings.domainPlaceholder")}
                    value={shortioDomainInput}
                    onChange={(e) => setShortioDomainInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.domainHint")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveShortioSettings}
                    disabled={!shortioApiKeyInput || !shortioDomainInput || savingShortio}
                  >
                    {savingShortio ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("settings.save")
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowShortio(false)}>
                    {t("settings.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowShortio(true)}>
                <Key className="w-4 h-4 mr-2" />
                {t("settings.addShortio")}
              </Button>
            )}
          </div>

          {settings?.hasShortioApiKey && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t("settings.shortioHint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Provider Card (unified: OpenAI / FreeLLMAPI / OpenRouter / Ollama / LM Studio / Custom) */}
      <AIProviderSection />

      {/* Unsplash Images Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            {t("settings.unsplash")}
          </CardTitle>
          <CardDescription>
            {t("settings.unsplashDescPrefix")}{" "}
            <a
              href="https://unsplash.com/developers"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              unsplash.com/developers
            </a>
            {t("settings.unsplashDescSuffix")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-muted-foreground" />
              <Label>{t("settings.unsplashKey")}</Label>
            </div>

            {settings?.hasUnsplashApiKey ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                    {settings.unsplashApiKey}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRemoveUnsplashDialog(true)}
                    disabled={savingUnsplash}
                  >
                    {t("settings.remove")}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("settings.unsplashHint")}
                </p>
              </div>
            ) : showUnsplash ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="password"
                    placeholder={t("settings.unsplashKeyPlaceholder")}
                    value={unsplashApiKeyInput}
                    onChange={(e) => setUnsplashApiKeyInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settings.unsplashKeyHint")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={saveUnsplashSettings}
                    disabled={!unsplashApiKeyInput || savingUnsplash}
                  >
                    {savingUnsplash ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t("settings.save")
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setShowUnsplash(false)}>
                    {t("settings.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setShowUnsplash(true)}>
                <Key className="w-4 h-4 mr-2" />
                {t("settings.addUnsplash")}
              </Button>
            )}
          </div>

          {settings?.hasUnsplashApiKey && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t("settings.unsplashHint2")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removeTokenDialogOpen} onOpenChange={setRemoveTokenDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.removeNgrokTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.removeNgrokDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>{t("settings.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeToken}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={saving}
            >
              {saving ? t("settings.removing") : t("settings.removeToken")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Short.io Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.removeShortioTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.removeShortioDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
              disabled={savingShortio}
            >
              {t("settings.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveShortioSettings}
              disabled={savingShortio}
            >
              {savingShortio ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("settings.removeSettings")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Unsplash Confirmation Dialog */}
      <Dialog open={showRemoveUnsplashDialog} onOpenChange={setShowRemoveUnsplashDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.removeUnsplashTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.removeUnsplashDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveUnsplashDialog(false)}
              disabled={savingUnsplash}
            >
              {t("settings.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveUnsplashSettings}
              disabled={savingUnsplash}
            >
              {savingUnsplash ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("settings.removeApiKey")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export/Import Dialogs */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        settings={{
          ngrok_token: rawSettings.ngrok_token || "",
          shortio_api_key: rawSettings.shortio_api_key || "",
          shortio_domain: settings?.shortioDomain || "",
          openai_api_key: rawSettings.openai_api_key || "",
          unsplash_api_key: rawSettings.unsplash_api_key || "",
        }}
        onExportSuccess={() => setShowExportNotice(true)}
      />

      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        currentSettings={{
          ngrok_token: rawSettings.ngrok_token || "",
          shortio_api_key: rawSettings.shortio_api_key || "",
          shortio_domain: settings?.shortioDomain || "",
          openai_api_key: rawSettings.openai_api_key || "",
          unsplash_api_key: rawSettings.unsplash_api_key || "",
        }}
        onImportSuccess={() => {
          // Refresh settings after import
          fetchSettings();
        }}
      />
    </div>
  );
}
