import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  PROVIDER_PRESETS,
  PROVIDER_ORDER,
  apiKeySettingKey,
  baseUrlSettingKey,
  modelSettingKey,
  extraHeadersSettingKey,
  type AIProviderType,
} from "@/lib/ai-provider-config";

export const dynamic = "force-dynamic";

/** Mask a secret the same way the main /api/settings route does. */
function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 12) return "••••••••";
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

/** Raw (non-secret) configuration keys for each provider. */
const RAW_KEYS_BY_PROVIDER: Partial<Record<AIProviderType, string[]>> = {};
for (const p of PROVIDER_ORDER) {
  const keys: string[] = [];
  const b = baseUrlSettingKey(p);
  if (b) keys.push(b);
  keys.push(modelSettingKey(p));
  const h = extraHeadersSettingKey(p);
  if (h) keys.push(h);
  RAW_KEYS_BY_PROVIDER[p] = keys;
}

async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

/**
 * GET /api/settings/ai - AI provider configuration (admin only).
 *
 * Returns:
 *  - the selected provider
 *  - per-provider preset metadata (label, defaults, field visibility)
 *  - masked API keys (never raw) + a boolean indicating whether a key is set
 *  - raw base URLs, models, and extra headers (these are not secrets)
 *
 * Raw API keys are only available through the authenticated /api/settings/export
 * endpoint (encrypted export), never through this route.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const selected = (await getSetting("ai_provider")) as AIProviderType | null;
    const provider = selected && PROVIDER_PRESETS[selected] ? selected : "openai";

    const providers = PROVIDER_ORDER.map((p) => {
      const meta = PROVIDER_PRESETS[p];
      const apiKeyKey = apiKeySettingKey(p);
      return {
        type: p,
        label: meta.label,
        description: meta.description,
        defaultBaseUrl: meta.baseURL,
        defaultModel: meta.defaultModel,
        apiKeyRequired: meta.apiKeyRequired,
        supportsBaseUrlOverride: meta.supportsBaseUrlOverride,
        supportsExtraHeaders: meta.supportsExtraHeaders,
        apiKeySettingKey: apiKeyKey,
        // Masked secret + presence flag (never the raw key)
        apiKeyMasked: null as string | null,
        hasApiKey: false,
        // Raw, non-secret config
        baseUrl: null as string | null,
        model: null as string | null,
        extraHeaders: null as string | null,
      };
    });

    for (const prov of providers) {
      const p = prov.type as AIProviderType;
      const apiKeyRaw = await getSetting(apiKeySettingKey(p));
      prov.apiKeyMasked = maskSecret(apiKeyRaw);
      prov.hasApiKey = !!apiKeyRaw;
      if (prov.supportsBaseUrlOverride) {
        prov.baseUrl = (await getSetting(baseUrlSettingKey(p))) ?? prov.defaultBaseUrl;
      }
      prov.model = (await getSetting(modelSettingKey(p))) ?? prov.defaultModel ?? null;
      const hk = extraHeadersSettingKey(p);
      if (hk) {
        prov.extraHeaders = await getSetting(hk);
      }
    }

    return NextResponse.json({ provider, providers });
  } catch (error) {
    console.error("Failed to get AI settings:", error);
    return NextResponse.json(
      { error: "Failed to get AI settings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/ai - Save AI provider configuration (admin only).
 *
 * Accepts a partial configuration object. API keys are only persisted when a
 * non-empty value is sent; sending an empty string clears the key. Non-secret
 * fields (base URL, model, extra headers) are upserted or cleared as sent.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const normalize = (v: unknown) =>
      typeof v === "string" ? v.trim() : v;

    const provider = normalize(body.provider) as AIProviderType | undefined;
    if (provider !== undefined) {
      if (!PROVIDER_PRESETS[provider]) {
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
      }
      await prisma.setting.upsert({
        where: { key: "ai_provider" },
        update: { value: provider },
        create: { key: "ai_provider", value: provider },
      });
    }

    // Per-provider fields, keyed by setting name.
    const fields = (body.fields ?? {}) as Record<string, unknown>;

    const allowedSecretKeys = new Set(
      PROVIDER_ORDER.map((p) => apiKeySettingKey(p))
    );
    const allowedRawKeys = new Set<string>();
    for (const p of PROVIDER_ORDER) {
      const b = baseUrlSettingKey(p);
      if (b) allowedRawKeys.add(b);
      allowedRawKeys.add(modelSettingKey(p));
      const h = extraHeadersSettingKey(p);
      if (h) allowedRawKeys.add(h);
    }

    // Persist API keys (secret). Empty string => remove.
    for (const p of PROVIDER_ORDER) {
      const key = apiKeySettingKey(p);
      if (fields[key] !== undefined) {
        const val = normalize(fields[key]) as string;
        if (val) {
          await prisma.setting.upsert({
            where: { key },
            update: { value: val },
            create: { key, value: val },
          });
        } else {
          await prisma.setting.deleteMany({ where: { key } });
        }
      }
    }

    // Persist raw (non-secret) fields. Empty string => remove.
    for (const p of PROVIDER_ORDER) {
      const rawKeys = RAW_KEYS_BY_PROVIDER[p] ?? [];
      for (const key of rawKeys) {
        if (fields[key] === undefined) continue;
        if (!allowedRawKeys.has(key)) continue;
        const val = normalize(fields[key]) as string;
        if (val) {
          await prisma.setting.upsert({
            where: { key },
            update: { value: val },
            create: { key, value: val },
          });
        } else {
          await prisma.setting.deleteMany({ where: { key } });
        }
      }
    }

    // Unused-but-referenced to keep the secret allow-list explicit above.
    void allowedSecretKeys;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save AI settings:", error);
    return NextResponse.json(
      { error: "Failed to save AI settings" },
      { status: 500 }
    );
  }
}

