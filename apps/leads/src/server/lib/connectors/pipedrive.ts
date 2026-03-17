/**
 * Pipedrive Connector — CRM API client.
 *
 * Endpoints used:
 * - GET  /api/v2/users/me         — Test connection (validate API key)
 * - GET  /api/v2/persons/search   — Search contacts by email
 * - POST /api/v2/persons          — Create a person (contact)
 * - PATCH /api/v2/persons/{id}    — Update a person
 * - POST /api/v2/deals            — Create a deal
 *
 * Auth: `api_token` query parameter on every request.
 * API docs: https://developers.pipedrive.com/docs/api/v2
 */

import { z } from "zod/v4";
import { logger } from "@/lib/logger";

const PD_BASE = "https://api.pipedrive.com";

// ─── Zod Schemas ────────────────────────────────────────

const pdUserSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.number(),
    name: z.string().nullish(),
    email: z.string().nullish(),
  }).nullish(),
});

const pdPersonSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  org_name: z.string().nullish(),
  job_title: z.string().nullish(),
  phones: z.array(z.object({ value: z.string().nullish() })).nullish(),
  emails: z.array(z.object({ value: z.string().nullish(), primary: z.boolean().nullish() })).nullish(),
});

const pdSearchResultSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(z.object({
      item: pdPersonSchema,
    })),
  }).nullish(),
});

const pdCreatePersonSchema = z.object({
  success: z.boolean(),
  data: pdPersonSchema.nullish(),
});

const pdUpdatePersonSchema = z.object({
  success: z.boolean(),
  data: pdPersonSchema.nullish(),
});

const pdCreateDealSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.number(),
    title: z.string().nullish(),
    value: z.number().nullish(),
    stage_id: z.number().nullish(),
    person_id: z.number().nullish(),
  }).nullish(),
});

// ─── API Helper ─────────────────────────────────────────

async function pdFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${PD_BASE}${path}${sep}api_token=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pipedrive ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test Pipedrive API key by fetching the authenticated user.
 * Returns true if the key is valid.
 */
export async function testPipedriveConnection(apiKey: string): Promise<boolean> {
  try {
    const raw = await pdFetch(apiKey, "/api/v2/users/me");
    const parsed = pdUserSchema.safeParse(raw);
    return parsed.success && parsed.data.success === true;
  } catch {
    return false;
  }
}

/**
 * Search for a person (contact) by email.
 * Returns the first matching person or null.
 */
export async function searchPersonByEmail(
  apiKey: string,
  email: string,
): Promise<z.infer<typeof pdPersonSchema> | null> {
  try {
    const raw = await pdFetch(
      apiKey,
      `/api/v2/persons/search?term=${encodeURIComponent(email)}`,
    );
    const parsed = pdSearchResultSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.data?.items.length) return null;
    return parsed.data.data.items[0].item;
  } catch (err) {
    logger.warn(`[pipedrive] searchPersonByEmail failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Create a person (contact) in Pipedrive.
 */
export async function createPerson(
  apiKey: string,
  data: {
    name: string;
    email?: string;
    phone?: string;
    orgName?: string;
    jobTitle?: string;
  },
): Promise<z.infer<typeof pdPersonSchema> | null> {
  try {
    const body: Record<string, unknown> = { name: data.name };
    if (data.email) body.emails = [{ value: data.email, primary: true, label: "work" }];
    if (data.phone) body.phones = [{ value: data.phone, primary: true, label: "work" }];
    if (data.orgName) body.org_name = data.orgName;
    if (data.jobTitle) body.job_title = data.jobTitle;

    const raw = await pdFetch(apiKey, "/api/v2/persons", "POST", body);
    const parsed = pdCreatePersonSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.data) return null;
    return parsed.data.data;
  } catch (err) {
    logger.warn(`[pipedrive] createPerson failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Update a person (contact) in Pipedrive.
 */
export async function updatePerson(
  apiKey: string,
  personId: number,
  data: Record<string, unknown>,
): Promise<z.infer<typeof pdPersonSchema> | null> {
  try {
    const raw = await pdFetch(apiKey, `/api/v2/persons/${personId}`, "PATCH", data);
    const parsed = pdUpdatePersonSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.data) return null;
    return parsed.data.data;
  } catch (err) {
    logger.warn(`[pipedrive] updatePerson failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Create a deal in Pipedrive.
 */
export async function createDeal(
  apiKey: string,
  data: {
    title: string;
    value?: number;
    personId?: number;
    stageId?: number;
  },
): Promise<{ id: string; title: string; value?: number; stage?: string; contactId?: string } | null> {
  try {
    const body: Record<string, unknown> = { title: data.title };
    if (data.value !== undefined) body.value = data.value;
    if (data.personId) body.person_id = data.personId;
    if (data.stageId) body.stage_id = data.stageId;

    const raw = await pdFetch(apiKey, "/api/v2/deals", "POST", body);
    const parsed = pdCreateDealSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.data) return null;

    const d = parsed.data.data;
    return {
      id: String(d.id),
      title: d.title ?? data.title,
      value: d.value ?? undefined,
      stage: d.stage_id ? String(d.stage_id) : undefined,
      contactId: d.person_id ? String(d.person_id) : undefined,
    };
  } catch (err) {
    logger.warn(`[pipedrive] createDeal failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
