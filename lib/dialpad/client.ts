const DIALPAD_API = "https://dialpad.com/api/v2";

export class DialpadError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DialpadError";
    this.status = status;
  }
}

export type DialpadCaller = {
  id: string;
  name: string;
  emails: string[];
  phones: string[];
  online: boolean;
};

export type DialpadCallLog = {
  id: string;
  direction: "inbound" | "outbound";
  state: string;
  startedAt: string;
  durationSeconds: number | null;
  externalNumber: string | null;
  contactName: string | null;
  targetName: string | null;
};

export function dialpadApiKey(): string | null {
  const key = process.env.BRASSHR_DIALPAD_API?.trim();
  return key ? key : null;
}

function idString(value: unknown): string | null {
  if (typeof value === "string" && /^\d{1,20}$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return null;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function parseDialpadCaller(value: unknown): DialpadCaller | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = idString(row.id);
  if (!id) return null;
  const displayName = typeof row.display_name === "string" ? row.display_name.trim() : "";
  const first = typeof row.first_name === "string" ? row.first_name.trim() : "";
  const last = typeof row.last_name === "string" ? row.last_name.trim() : "";
  const name = displayName || [first, last].filter(Boolean).join(" ") || `User ${id}`;
  return {
    id,
    name,
    emails: stringList(row.emails),
    phones: stringList(row.phone_numbers),
    online: row.is_online === true,
  };
}

async function dialpadError(response: Response): Promise<DialpadError> {
  const text = await response.text();
  let message = "";
  try {
    const body = JSON.parse(text) as {
      message?: unknown;
      error?: { message?: unknown } | string;
    };
    if (typeof body.message === "string") message = body.message.trim();
    else if (typeof body.error === "string") message = body.error.trim();
    else if (body.error && typeof body.error === "object" && typeof body.error.message === "string") {
      message = body.error.message.trim();
    }
  } catch {
    message = "";
  }
  if (/unable to create call/i.test(message)) {
    message =
      "Dialpad could not start the call because that user has no Dialpad app, desktop, or desk phone open.";
  }
  if (!message) {
    if (response.status === 401 || response.status === 403) message = "Dialpad rejected the API key.";
    else if (response.status === 429) message = "Dialpad rate limit reached. Wait a minute and try again.";
    else message = "Dialpad could not complete the request.";
  }
  return new DialpadError(message, response.status);
}

export async function listDialpadUsers(apiKey: string): Promise<DialpadCaller[]> {
  const callers: DialpadCaller[] = [];
  let cursor = "";

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(`${DIALPAD_API}/users`);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) throw await dialpadError(response);
    const body = (await response.json()) as { items?: unknown; cursor?: unknown };
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      const caller = parseDialpadCaller(item);
      if (caller) callers.push(caller);
    }
    cursor = typeof body.cursor === "string" ? body.cursor.trim() : "";
    if (!cursor) break;
  }

  return callers.sort((a, b) => a.name.localeCompare(b.name));
}

function parseDialpadBody(text: string): unknown {
  const quotedIds = text.replace(
    /"(call_id|master_call_id|entry_point_call_id|operator_call_id)"\s*:\s*(\d{1,20})/g,
    '"$1":"$2"'
  );
  return JSON.parse(quotedIds) as unknown;
}

function nestedName(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function nestedPhone(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const phone = (value as { phone?: unknown }).phone;
  return typeof phone === "string" && phone.trim() ? phone.trim() : null;
}

function epochIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Dialpad reports connected talk time in milliseconds. */
function durationSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value / 1000);
}

export function parseDialpadCall(value: unknown): DialpadCallLog | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = idString(row.call_id) ?? (typeof row.call_id === "string" && row.call_id.trim() ? row.call_id.trim() : null);
  const startedAt = epochIso(row.date_started);
  if (!id || !startedAt) return null;
  const direction = row.direction === "inbound" ? "inbound" : "outbound";
  const state = typeof row.state === "string" && row.state.trim() ? row.state.trim().toLowerCase() : "hangup";
  const externalNumber =
    (typeof row.external_number === "string" && row.external_number.trim()) || nestedPhone(row.contact) || null;
  const contactName = nestedName(row.contact);
  return {
    id,
    direction,
    state,
    startedAt,
    durationSeconds: durationSeconds(row.duration),
    externalNumber,
    contactName: contactName && contactName !== externalNumber ? contactName : null,
    targetName: nestedName(row.target),
  };
}

export async function listDialpadCalls(apiKey: string, startedAfterMs: number): Promise<DialpadCallLog[]> {
  const calls: DialpadCallLog[] = [];
  let cursor = "";

  for (let page = 0; page < 3 && calls.length < 40; page += 1) {
    const url = new URL(`${DIALPAD_API}/call`);
    url.searchParams.set("started_after", String(Math.trunc(startedAfterMs)));
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      if (response.status === 403) {
        await response.text().catch(() => "");
        throw new DialpadError(
          "Dialpad could not list calls. The API key needs the calls:list permission.",
          403
        );
      }
      throw await dialpadError(response);
    }
    const body = parseDialpadBody(await response.text()) as { items?: unknown; cursor?: unknown } | unknown[];
    const items = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      const call = parseDialpadCall(item);
      if (call) calls.push(call);
      if (calls.length >= 40) break;
    }
    cursor = !Array.isArray(body) && typeof body.cursor === "string" ? body.cursor.trim() : "";
    if (!cursor || items.length === 0) break;
  }

  return calls;
}

export async function initiateDialpadCall(
  apiKey: string,
  input: { phoneNumber: string; userId: string }
): Promise<{ callId: string | null }> {
  if (!/^\d{1,20}$/.test(input.userId)) {
    throw new DialpadError("Choose a Dialpad user to place the call.", 400);
  }
  const response = await fetch(`${DIALPAD_API}/call`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: `{"phone_number":${JSON.stringify(input.phoneNumber)},"user_id":${input.userId}}`,
    cache: "no-store",
  });
  if (!response.ok) throw await dialpadError(response);
  const body = (await response.json()) as { call_id?: unknown };
  return { callId: idString(body.call_id) };
}
