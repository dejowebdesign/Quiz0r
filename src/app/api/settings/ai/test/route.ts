import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  PROVIDER_PRESETS,
  apiKeySettingKey,
  baseUrlSettingKey,
  modelSettingKey,
  extraHeadersSettingKey,
  type AIProviderType,
} from "@/lib/ai-provider-config";
import { OpenAICompatibleProvider } from "@/lib/providers/openai-compatible-provider";

export const dynamic = "force-dynamic";

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/**
 * Build an OpenAICompatibleProvider from a posted (in-memory) configuration
 * for testing, without persisting anything. Falls back to stored settings for
 * any field the client did not send.
 */
async function buildProviderFromRequest(
  body: Record<string, unknown>
): Promise<OpenAICompatibleProvider> {
  const providerType = (body.provider as AIProviderType) || "openai";
  if (!PROVIDER_PRESETS[providerType]) {
    throw new Error(`Unknown provider: ${providerType}`);
  }
  const meta = PROVIDER_PRESETS[providerType];
  const fields = (body.fields ?? {}) as Record<string, unknown>;

  const apiKeyKey = apiKeySettingKey(providerType);
  const baseUrlKey = baseUrlSettingKey(providerType);
  const modelKey = modelSettingKey(providerType);
  const headersKey = extraHeadersSettingKey(providerType);

  const apiKey =
    (fields[apiKeyKey] as string | undefined) ?? (await getSetting(apiKeyKey));

  let baseURL = meta.baseURL;
  if (meta.supportsBaseUrlOverride && baseUrlKey) {
    baseURL =
      (fields[baseUrlKey] as string | undefined) ??
      (await getSetting(baseUrlKey)) ??
      meta.baseURL;
  }

  const model =
    (fields[modelKey] as string | undefined) ??
    (await getSetting(modelKey)) ??
    meta.defaultModel;

  let extraHeaders = meta.presetExtraHeaders;
  if (meta.supportsExtraHeaders && headersKey) {
    const raw =
      (fields[headersKey] as string | undefined) ??
      (await getSetting(headersKey));
    if (raw) {
      try {
        extraHeaders = { ...(meta.presetExtraHeaders || {}), ...JSON.parse(raw) };
      } catch {
        // ignore invalid JSON
      }
    }
  }

  return new OpenAICompatibleProvider({
    name: providerType,
    baseURL,
    apiKey: apiKey || undefined,
    defaultModel: model || undefined,
    extraHeaders,
  });
}

/**
 * POST /api/settings/ai/test - Test an AI provider connection (admin only).
 *
 * Builds a provider from the posted config (falling back to stored settings),
 * calls testConnection() server-side, and returns a simple success/failure.
 * The API key is never returned or logged.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const provider = await buildProviderFromRequest(body);
    const result = await provider.testConnection();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test connection";
    // Sanitize: never echo a key.
    const sanitized = message
      .replace(/Bearer [^\s]+/gi, "Bearer ***")
      .replace(/(sk-[A-Za-z0-9_-]{6,})[^\s]*/g, "***")
      .replace(/api[_-]?key[^\s]*/gi, "***");
    return NextResponse.json(
      { success: false, message: `Connection failed: ${sanitized}`, model: "" },
      { status: 200 }
    );
  }
}
