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
