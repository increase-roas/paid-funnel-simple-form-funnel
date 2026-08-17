const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export interface SheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

export interface VaultLead {
  leadUuid: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  zip: string;
  source: string;
  ghlContactId: string;
  answersJson: string;
  firstUrl: string;
  originalQueryString: string;
}

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemBytes(pem: string): Uint8Array {
  const encoded = pem.replace(/\\n/g, "\n").replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function accessToken(config: SheetsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.serviceAccountEmail,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3_300,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(config.privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Google authorization failed (${response.status})`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Google authorization returned no access token");
  return body.access_token;
}

function values(lead: VaultLead): string[] {
  return [
    lead.leadUuid,
    lead.createdAt,
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.phone,
    lead.zip,
    lead.source,
    lead.ghlContactId,
    lead.answersJson,
    lead.firstUrl,
    lead.originalQueryString,
  ];
}

async function sheetsFetch(config: SheetsConfig, path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken(config);
  return fetch(`${SHEETS_API}/${encodeURIComponent(config.spreadsheetId)}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(8_000),
  });
}

export async function upsertAllLeads(config: SheetsConfig, lead: VaultLead): Promise<void> {
  const lookup = await sheetsFetch(config, "/values/%27All%20Leads%27!A%3AA");
  if (!lookup.ok) throw new Error(`Lead-vault lookup failed (${lookup.status})`);
  const lookupBody = (await lookup.json()) as { values?: string[][] };
  const row = lookupBody.values?.findIndex((candidate) => candidate[0] === lead.leadUuid) ?? -1;
  const range = row >= 0 ? `'All Leads'!A${row + 1}:L${row + 1}` : "'All Leads'!A1";
  const mode = row >= 0 ? "PUT" : "POST";
  const suffix = row >= 0 ? "" : ":append";
  const write = await sheetsFetch(
    config,
    `/values/${encodeURIComponent(range)}${suffix}?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: mode, body: JSON.stringify({ values: [values(lead)] }) },
  );
  if (!write.ok) throw new Error(`Lead-vault write failed (${write.status})`);
}

export async function appendMissedLead(
  config: SheetsConfig,
  lead: VaultLead,
  reason: string,
): Promise<void> {
  const lookup = await sheetsFetch(config, "/values/%27Missed%20Leads%27!A%3AA");
  if (!lookup.ok) throw new Error(`Missed-lead lookup failed (${lookup.status})`);
  const lookupBody = (await lookup.json()) as { values?: string[][] };
  const row = lookupBody.values?.findIndex((candidate) => candidate[0] === lead.leadUuid) ?? -1;
  const range = row >= 0 ? `'Missed Leads'!A${row + 1}:M${row + 1}` : "'Missed Leads'!A1";
  const mode = row >= 0 ? "PUT" : "POST";
  const suffix = row >= 0 ? "" : ":append";
  const write = await sheetsFetch(
    config,
    `/values/${encodeURIComponent(range)}${suffix}?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: mode,
      body: JSON.stringify({ values: [[...values(lead), reason.slice(0, 300)]] }),
    },
  );
  if (!write.ok) throw new Error(`Missed-lead write failed (${write.status})`);
}
