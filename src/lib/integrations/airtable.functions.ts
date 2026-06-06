import { createServerFn } from "@tanstack/react-start";

export type AirtableTestInput = {
  secretName: string; // env var name holding the PAT
  baseId: string;
  tableName: string;
};

export type AirtableTestResult = {
  ok: boolean;
  status: number;
  message: string;
  sampleRecordIds?: string[];
};

export const testAirtable = createServerFn({ method: "POST" })
  .inputValidator((d: AirtableTestInput) => d)
  .handler(async ({ data }): Promise<AirtableTestResult> => {
    const key = data.secretName ? process.env[data.secretName] : undefined;
    if (!key) {
      return { ok: false, status: 0, message: `Backend secret "${data.secretName}" is not set. Add it in project secrets.` };
    }
    if (!data.baseId || !data.tableName) {
      return { ok: false, status: 0, message: "Base ID and table name are required." };
    }
    try {
      const url = `https://api.airtable.com/v0/${encodeURIComponent(data.baseId)}/${encodeURIComponent(data.tableName)}?maxRecords=1`;
      const res = await fetch(url, { headers: { authorization: `Bearer ${key}` } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (body as { error?: { message?: string } })?.error?.message ?? res.statusText;
        return { ok: false, status: res.status, message: msg };
      }
      const ids = ((body as { records?: { id: string }[] }).records ?? []).map((r) => r.id);
      return { ok: true, status: 200, message: "Connection OK", sampleRecordIds: ids };
    } catch (e) {
      return { ok: false, status: 0, message: e instanceof Error ? e.message : String(e) };
    }
  });
