"use client";

// Live Scoreboard — Updated UI with image size, additional details, and long card design
import React, { useEffect, useMemo, useRef, useState } from "react";

// ---- Config you might tweak ----
const REFRESH_MS = 10_000;
const NAME_COL = "Name";
const SCORE_COL = "Sum";
const COUNT_COL = "Count";
const AVG_COL = "Avg";

// Local photos mapped by *exact* Name from the sheet
const PHOTO_BY_NAME: Record<string, string> = {
  "Midhuna": "/photos/Midhuna.jpg",      // Local images need to be in /public folder
  "Aswanth": "/photos/Aswanth.jpg",
  "Abin Sheen": "/photos/AbinSheen.jpg",
  "Rahul": "/photos/Rahul.jpg",
  "Aswathi": "/photos/Aswathi.jpg",
  "Jishnu": "/photos/Jishnu.jpg",
  "Hameed": "/photos/Hameed.jpg",
  "Deepak": "/photos/Deepak.jpg",
  "Anugrah": "/photos/Anugrah.jpg",
  "Arun": "/photos/Arun.jpg",
  "Gautham": "/photos/Gautham.jpg",
  "Sanjay": "/photos/Sanjay.jpg",
  "Muhsin": "/photos/Muhsin.jpg",
  "Nidheesh": "/photos/Nidheesh.jpg",
  "Asha": "/photos/Asha.jpg",
};

// ---- CSV helpers ----
function parseCSV(csvText: string): string[][] {
  const firstLine = csvText.split(/\r?\n/)[0] ?? "";
  const useSemicolon = firstLine.includes(";") && !firstLine.includes(",");
  const delim = useSemicolon ? ";" : ",";

  const rows: string[][] = [];
  let i = 0, cur = "", row: string[] = [], inQuotes = false;

  while (i < csvText.length) {
    const c = csvText[i];
    if (inQuotes) {
      if (c === '"') {
        if (csvText[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* ignore */ }
      else { cur += c; }
    }
    i++;
  }
  row.push(cur);
  rows.push(row);
  return rows.filter(r => r.length && r.some(cell => (cell ?? "").trim() !== ""));
}

async function fetchFromCSV(csvUrl: string) {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  if (!rows.length) return [];

  const [header, ...data] = rows;
  const norm = (s: string) => (s ?? "").trim().toLowerCase();
  const headerIdx: Record<string, number> = {};
  header.forEach((h, i) => (headerIdx[norm(h)] = i));

  const nameIdx = headerIdx[norm(NAME_COL)];
  const sumIdx = headerIdx[norm(SCORE_COL)];
  const countIdx = headerIdx[norm(COUNT_COL)];
  const avgIdx = headerIdx[norm(AVG_COL)];

  if (nameIdx === undefined || sumIdx === undefined) return [];

  return data.map(r => ({
    name: (r[nameIdx] ?? "").trim(),
    sum: (r[sumIdx] ?? "").trim(),
    count: (r[countIdx] ?? "").trim(),
    avg: (r[avgIdx] ?? "").trim(),
  }));
}

async function fetchFromSheetsApi(apiKey: string, sheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API fetch failed: ${res.status}`);
  const json = await res.json();
  const values: string[][] = json.values || [];
  if (!values.length) return [];
  const [header, ...data] = values;
  const norm = (s: string) => (s ?? "").trim().toLowerCase();
  const headerIdx: Record<string, number> = {};
  header.forEach((h: string, i: number) => (headerIdx[norm(h)] = i));

  const nameIdx = headerIdx[norm(NAME_COL)];
  const sumIdx = headerIdx[norm(SCORE_COL)];
  const countIdx = headerIdx[norm(COUNT_COL)];
  const avgIdx = headerIdx[norm(AVG_COL)];

  if (nameIdx === undefined || sumIdx === undefined) return [];

  return data.map((r: string[]) => ({
    name: (r[nameIdx] ?? "").trim(),
    sum: (r[sumIdx] ?? "").trim(),
    count: (r[countIdx] ?? "").trim(),
    avg: (r[avgIdx] ?? "").trim(),
  }));
}

// ---- Ranking helper ----
function withRanks<T extends { scoreNum: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.scoreNum - a.scoreNum);
  let lastScore: number | null = null; let lastRank = 0;
  return sorted.map((item, idx) => {
    const rank = (lastScore === item.scoreNum) ? lastRank : (idx + 1);
    lastScore = item.scoreNum; lastRank = rank;
    return { ...item, rank };
  });
}

// ---- Presentational bits ----
function PresenterCard({
  rank, name, photo, sum, count, avg, brandColor,
}: {
  rank: number; name: string; photo?: string; sum: string; count: string; avg: string; brandColor: string;
}) {
  const initials = useMemo(
    () => name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase(),
    [name]
  );
  return (
    <div className="group relative rounded-lg shadow-lg hover:shadow-xl transition p-6 bg-white border border-gray-200">
      <div
        className="absolute -top-4 -left-4 text-white text-xs font-semibold rounded-xl px-3 py-2 shadow-md"
        style={{ backgroundColor: brandColor }}
      >
        #{rank}
      </div>
      <div className="flex items-center gap-6">
        {photo ? (
          <img src={photo} alt={name} className="h-24 w-24 rounded-xl object-cover" />
        ) : (
          <div className="h-24 w-24 rounded-xl bg-gray-100 grid place-items-center text-gray-700 font-semibold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xl font-semibold text-gray-900">{name || "Unnamed"}</div>
          <div className="mt-2 text-sm text-gray-500">
            <div><strong>Sum:</strong> {sum}</div>
            <div><strong>Count:</strong> {count}</div>
            <div><strong>Avg:</strong> {avg}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────── */
export default function Scoreboard(props: {
  title?: string;
  logoSrc?: string;            // e.g. "/logo.png"
  brandColor?: string;         // any CSS color, default "#6d28d9" (purple-700-ish)
  csvUrl?: string;
  apiKey?: string; sheetId?: string; range?: string;
}) {
  const {
    title = "Live Scores",
    logoSrc,
    brandColor = "#6d28d9",   // CodeAce vibe: deep purple; change if you want
    csvUrl, apiKey, sheetId, range,
  } = props;

  const [rows, setRows] = useState<{ name: string; photo?: string; sum: string; count: string; avg: string; scoreNum?: number; rank?: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      let raw: { name: string; sum: string; count: string; avg: string }[] = [];

      if (csvUrl) raw = await fetchFromCSV(csvUrl);
      else if (apiKey && sheetId && range) raw = await fetchFromSheetsApi(apiKey, sheetId, range);
      else throw new Error("Provide csvUrl OR apiKey+sheetId+range");

      const aggregated = raw.map((r) => ({
        ...r,
        sum: r.sum.trim(),
        count: r.count.trim(),
        avg: r.avg.trim(),
        scoreNum: parseFloat(r.sum) || 0, // Adding scoreNum (for example, as the numeric sum)
      }));

      const ranked = withRanks(aggregated);
      setRows(ranked as any);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    timerRef.current = window.setInterval(fetchData, REFRESH_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [csvUrl, apiKey, sheetId, range]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "#f5f7f9" }}>
      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Header with title (left) + logo (right) */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900">{title}</h1>
          {logoSrc && (
            <img
              src={logoSrc}
              alt="Logo"
              className="h-12 md:h-14 w-auto"
              style={{ boxShadow: "0 0 0 2px rgba(0,0,0,0.05)" }}
            />
          )}
        </header>

        {loading && <div className="text-gray-700">Loading scores...</div>}
        {error && (
          <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {rows.length > 0 && (
          <>
            {/* Podium */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {top3.map((r: any) => (
                <div key={r.name} className="rounded-xl p-6 bg-white border border-gray-200 shadow-lg">
                  <div className="text-sm text-gray-600">Rank #{r.rank}</div>
                  <div className="text-3xl font-bold text-gray-900 mb-2" style={{ color: brandColor }}>
                    #{r.rank}
                  </div>
                  <PresenterCard
                    rank={r.rank}
                    name={r.name}
                    photo={PHOTO_BY_NAME[r.name] || ""}
                    sum={r.sum}
                    count={r.count}
                    avg={r.avg}
                    brandColor={brandColor}
                  />
                </div>
              ))}
            </section>

            {/* All rankings */}
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">All Presentations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((r: any) => (
                  <PresenterCard
                    key={`${r.rank}-${r.name}`}
                    rank={r.rank}
                    name={r.name}
                    photo={PHOTO_BY_NAME[r.name] || ""}
                    sum={r.sum}
                    count={r.count}
                    avg={r.avg}
                    brandColor={brandColor}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-gray-600">No data found. Check your sheet headers.</div>
        )}

        <div className="mt-8 text-sm text-gray-600">Auto-updates every {REFRESH_MS / 1000}s</div>
      </div>
    </div>
  );
}
