"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wand2, Plug, Check, X, Key, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  PROVIDER_PRESETS,
  PROVIDER_ORDER,
  apiKeySettingKey,
  baseUrlSettingKey,
  modelSettingKey,
  extraHeadersSettingKey,
  type AIProviderType,
} from "@/lib/ai-provider-config";

interface ProviderState {
  type: AIProviderType;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  apiKeyRequired: boolean;
  supportsBaseUrlOverride: boolean;
  supportsExtraHeaders: boolean;
  apiKeySettingKey: string;
  apiKeyMasked: string | null;
  hasApiKey: boolean;
  baseUrl: string | null;
  model: string | null;
  extraHeaders: string | null;
}

interface AISettingsResponse {
  provider: AIProviderType;
  providers: ProviderState[];
}

/**
 * AI Provider configuration section for the Admin Settings page.
 *
 * Loads masked secrets + raw non-secret config from /api/settings/ai, lets the
 * admin pick a provider and edit its fields, and saves through the same route.
 * A "Test Connection" button hits /api/settings/ai/test, which runs server-side
 * and never returns the API key.
 */
export function AIProviderSection() {
  const [data, setData] = useState<AISettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AIProviderType>("openai");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Editable field values, keyed by setting name.
  const [fields, setFields] = useState<Record<string, string>>({});
  // Track whether the API key field is being replaced (show input) per provider.
  const [editingKey, setEditingKey] = useState<AIProviderType | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings/ai");
      if (!res.ok) {
        toast.error("Failed to load AI settings");
        return;
      }
      const json = (await res.json()) as AISettingsResponse;
      setData(json);
      setSelected(json.provider);
      // Seed editable fields with raw non-secret values.
      const seeded: Record<string, string> = {};
      for (const p of json.providers) {
        if (p.supportsBaseUrlOverride) {
          const k = baseUrlSettingKey(p.type);
          seeded[k] = p.baseUrl ?? "";
        }
        seeded[modelSettingKey(p.type)] = p.model ?? "";
        const hk = extraHeadersSettingKey(p.type);
        if (hk) seeded[hk] = p.extraHeaders ?? "";
      }
      setFields(seeded);
    } catch {
      toast.error("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  }

  const current = data?.providers.find((p) => p.type === selected) ?? null;

  function setField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function saveConfig() {
    if (!current) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { provider: selected, fields: {} };
      // Send only the relevant fields for the selected provider to avoid
      // clobbering other providers' stored config with empty strings.
      const send: Record<string, string> = {};
      if (current.supportsBaseUrlOverride) {
        send[baseUrlSettingKey(selected)] = fields[baseUrlSettingKey(selected)] ?? "";
      }
      send[modelSettingKey(selected)] = fields[modelSettingKey(selected)] ?? "";
      const hk = extraHeadersSettingKey(selected);
      if (hk) send[hk] = fields[hk] ?? "";
      // API key: only send when actively editing (replacing) it.
      if (editingKey === selected) {
        send[apiKeySettingKey(selected)] = fields[apiKeySettingKey(selected)] ?? "";
      }
      payload.fields = send;

      const res = await fetch("/api/settings/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || "Failed to save AI settings");
      } else {
        toast.success("AI provider settings saved");
        setEditingKey(null);
        setShowKey(false);
        await fetchSettings();
      }
    } catch {
      toast.error("Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!current) return;
    setTesting(true);
    try {
      const send: Record<string, string> = {};
      if (current.supportsBaseUrlOverride) {
        send[baseUrlSettingKey(selected)] = fields[baseUrlSettingKey(selected)] ?? "";
      }
      send[modelSettingKey(selected)] = fields[modelSettingKey(selected)] ?? "";
      const hk = extraHeadersSettingKey(selected);
      if (hk) send[hk] = fields[hk] ?? "";
      if (editingKey === selected) {
        send[apiKeySettingKey(selected)] = fields[apiKeySettingKey(selected)] ?? "";
      }
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected, fields: send }),
      });
      const result = (await res.json()) as {
        success: boolean;
        message: string;
        model: string;
        availableModels?: string[];
      };
      if (result.success) {
        toast.success(result.message, {
          description: `Model: ${result.model || "n/a"}`,
        });
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Failed to test connection");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" />
            AI Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[120px]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const apiKeyKey = current ? apiKeySettingKey(selected) : "";
  const baseUrlKey = current && current.supportsBaseUrlOverride ? baseUrlSettingKey(selected) : "";
  const modelKey = current ? modelSettingKey(selected) : "";
  const headersKey = current ? extraHeadersSettingKey(selected) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          AI Provider
        </CardTitle>
        <CardDescription>
          Choose the AI backend used for quiz, theme, translation, and
          certificate generation. Credentials are stored server-side and never
          exposed to players.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider selector */}
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            value={selected}
            onValueChange={(v) => {
              setSelected(v as AIProviderType);
              setEditingKey(null);
              setShowKey(false);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_ORDER.map((p) => (
                <SelectItem key={p} value={p}>
                  {PROVIDER_PRESETS[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <p className="text-xs text-muted-foreground">{current.description}</p>
          )}
        </div>

        {current && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              Provider Configuration
              {current.apiKeyRequired ? (
                <Badge variant="secondary">API key required</Badge>
              ) : (
                <Badge variant="outline">API key optional</Badge>
              )}
            </div>

            {/* Base URL */}
            {current.supportsBaseUrlOverride && (
              <div className="space-y-2">
                <Label htmlFor="ai-base-url">Base URL</Label>
                <Input
                  id="ai-base-url"
                  placeholder={current.defaultBaseUrl}
                  value={baseUrlKey ? fields[baseUrlKey] ?? "" : ""}
                  onChange={(e) => baseUrlKey && setField(baseUrlKey, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  OpenAI-compatible endpoint ending in <code>/v1</code>. Default:{" "}
                  {current.defaultBaseUrl}
                </p>
              </div>
            )}

            {/* API Key (masked secret) */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-muted-foreground" />
                <Label>API Key</Label>
              </div>

              {current.hasApiKey && editingKey !== selected ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm">
                    {current.apiKeyMasked}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingKey(selected);
                      if (apiKeyKey) setField(apiKeyKey, "");
                    }}
                  >
                    Replace
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      placeholder={
                        current.hasApiKey
                          ? "Enter new key to replace stored value"
                          : current.apiKeyRequired
                          ? "Paste your API key..."
                          : "Optional API key"
                      }
                      value={apiKeyKey ? fields[apiKeyKey] ?? "" : ""}
                      onChange={(e) => apiKeyKey && setField(apiKeyKey, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowKey((s) => !s)}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Stored securely server-side. Never sent to clients or
                    players.
                  </p>
                </div>
              )}
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="ai-model">Model</Label>
              <Input
                id="ai-model"
                placeholder={current.defaultModel || "model id"}
                value={modelKey ? fields[modelKey] ?? "" : ""}
                onChange={(e) => modelKey && setField(modelKey, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Default: {current.defaultModel || "(none)"}
              </p>
            </div>

            {/* Extra Headers */}
            {current.supportsExtraHeaders && headersKey && (
              <div className="space-y-2">
                <Label htmlFor="ai-headers">Extra Headers (JSON)</Label>
                <Textarea
                  id="ai-headers"
                  rows={3}
                  placeholder={
                    current.type === "openrouter"
                      ? '{"HTTP-Referer": "https://quiz0r.app", "X-Title": "Quiz0r"}'
                      : '{"Header-Name": "value"}'
                  }
                  value={fields[headersKey] ?? ""}
                  onChange={(e) => setField(headersKey, e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Optional JSON object of extra HTTP headers. For OpenRouter,
                  preset <code>HTTP-Referer</code> and <code>X-Title</code>{" "}
                  headers are applied automatically.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="outline"
                onClick={testConnection}
                disabled={testing}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 h-4 w-4" />
                )}
                Test Connection
              </Button>
              <Button onClick={saveConfig} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
              {editingKey === selected && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingKey(null);
                    setShowKey(false);
                    if (apiKeyKey) setField(apiKeyKey, "");
                  }}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          The selected provider is used by AI quiz generation, theme generation,
          and AI translations. OpenAI keys configured here are shared with the
          existing OpenAI features.
        </p>
      </CardContent>
    </Card>
  );
}
