"use client";

// Live Scoreboard (Google Sheets) – Local photos, sheet-driven scores
// ------------------------------------------------------------------
// What this does
// - Fetches rows from a Google Sheet (Published CSV OR Sheets API v4)
// - Expects headers: Name, Score
// - Aggregates per person (Total/Sum by default; can switch to Average)
// - Renders cards with local images + names + rank + votes count
// - Auto-refreshes every 10 seconds
//
// Quick usage (Published CSV - easiest):
// <Scoreboard
//   title="Presentation Scores"
//   csvUrl="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
// />
//
// If you need private Sheets:
// <Scoreboard
//   title="Presentation Scores"
//   apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
//   sheetId="1AbC..."
//   range="Sheet1!A1:B" // include headers row (Name, Score)
// />
//
// IMPORTANT:
// - The sheet's "Name" must match the keys in PHOTO_BY_NAME exactly.
// - Your local images live under /public. Example here uses "/Muhasin TP.JPG".
//

import React, { useEffect, useMemo, useRef, useState } from "react";

// ---- Scoreboard config (edit to taste) ----
const REFRESH_MS = 10_000; // auto-refresh every 10 seconds
const NAME_COL = "Name";   // Sheet header for presenter name
const SCORE_COL = "Score"; // Sheet header for numeric score (1–10)

// Choose how to rank:
//  - "sum" => total score across all votes
//  - "avg" => average score across votes
const DISPLAY_METRIC: "sum" | "avg" = "sum";
const DISPLAY_LABEL = DISPLAY_METRIC === "sum" ? "Total" : "Average";

// Map local photos by EXACT sheet name (case/spacing must match)
const PHOTO_BY_NAME: Record<string, string> = {
  "Muhasin TP": "/Muhasin%20TP.JPG", // your file in /public
  // Add more presenters here:
  // "Alice Chen": "/photos/alice.jpg",
  // "Bob Kumar": "/photos/bob.jpg",
};

// ---- Utility: tiny CSV parser (handles quotes, commas, and newlines) ----
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let i = 0, cur = "" as string, row: string[] = [], inQuotes = false;
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
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c === "\r") { /* ignore */ }
      else { cur += c; }
    }
    i++;
  }
  row.push(cur);
  rows.push(row);
  return rows.filter(r => r.length && r.some(cell => cell.trim() !== ""));
}

// Helper to compute ranks with ties (1, 2, 2, 4 ...)
function withRanks<T extends { scoreNum: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.scoreNum - a.scoreNum);
  let lastScore: number | null = null; let lastRank = 0;
  return sorted.map((item, idx) => {
    const rank = (lastScore === item.scoreNum) ? lastRank : (idx + 1);
    lastScore = item.scoreNum; lastRank = rank;
    return { ...item, rank };
  });
}

// ---- Fetchers ----
async function fetchFromCSV(csvUrl: string) {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const [header, ...data] = rows;
  const idx: Record<string, number> = {};
  header.forEach((h, i) => (idx[h.trim()] = i));
  return data.map(r => ({
    name: (r[idx[NAME_COL]] ?? "").trim(),
    score: (r[idx[SCORE_COL]] ?? "").trim(),
  }));
}

async function fetchFromSheetsApi(apiKey: string, sheetId: string, range: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheets API fetch failed: ${res.status}`);
  const json = await res.json();
  const values: string[][] = json.values || [];
  if (!values.length) return [] as any[];
  const [header, ...data] = values;
  const idx: Record<string, number> = {};
  header.forEach((h: string, i: number) => (idx[h.trim()] = i));
  return data.map((r: string[]) => ({
    name: (r[idx[NAME_COL]] ?? "").trim(),
    score: (r[idx[SCORE_COL]] ?? "").trim(),
  }));
}

// ---- UI ----
function PresenterCard({
  rank, name, photo, score, votes,
}: {
  rank: number; name: string; photo?: string; score: string; votes?: string;
}) {
  const initials = useMemo(
    () => name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase(),
    [name]
  );
  return (
    <div className="group relative rounded-2xl shadow-sm hover:shadow-lg transition p-4 bg-white border border-gray-100">
      <div className="absolute -top-3 -left-3 bg-black text-white text-sm font-semibold rounded-xl px-3 py-1">#{rank}</div>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} className="h-16 w-16 rounded-2xl object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-2xl bg-gray-100 grid place-items-center text-gray-600 font-semibold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold truncate">{name || "Unnamed"}</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums">{score}</span>
            <span className="text-xs text-gray-400">{DISPLAY_LABEL}</span>
            {votes ? <span className="text-sm text-gray-500">{votes} votes</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Scoreboard(props: {
  csvUrl?: string;                 // Published CSV URL (fastest)
  apiKey?: string; sheetId?: string; range?: string; // Sheets API (private)
  title?: string;
}) {
  const { csvUrl, apiKey, sheetId, range, title = "Live Scores" } = props;
  const [rows, setRows] = useState<{ name: string; photo?: string; score: string; votes?: string; }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      let raw: { name: string; score: string; }[] = [];

      if (csvUrl) raw = await fetchFromCSV(csvUrl);
      else if (apiKey && sheetId && range) raw = await fetchFromSheetsApi(apiKey, sheetId, range);
      else throw new Error("Provide csvUrl OR apiKey+sheetId+range");

      // Aggregate per person
      type Agg = { total: number; count: number };
      const map = new Map<string, Agg>();

      for (const r of raw) {
        if (!r.name) continue;
        const scoreNum = Number(String(r.score).replace(/,/g, "."));
        if (!Number.isFinite(scoreNum)) continue;

        const key = r.name;
        const cur = map.get(key) ?? { total: 0, count: 0 };
        cur.total += scoreNum;
        cur.count += 1;
        map.set(key, cur);
      }

      const aggregated = Array.from(map.entries()).map(([name, agg]) => {
        const scoreNum =
          DISPLAY_METRIC === "sum" ? agg.total : agg.total / Math.max(1, agg.count);
        const display =
          DISPLAY_METRIC === "sum" ? scoreNum.toFixed(0) : scoreNum.toFixed(2);
        return {
          name,
          photo: PHOTO_BY_NAME[name] || "",
          score: display,
          scoreNum,
          votes: String(agg.count),
        };
      });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [csvUrl, apiKey, sheetId, range]);

  const top3 = useMemo(() => rows.slice(0, 3), [rows]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          <div className="text-sm text-gray-500">Auto-updates every {REFRESH_MS / 1000}s</div>
        </header>

        {loading && <div className="animate-pulse text-gray-500">Loading scores…</div>}
        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        {rows.length > 0 && (
          <>
            {/* Podium */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {top3.map((r: any) => (
                <div key={r.name} className="rounded-2xl p-4 bg-gradient-to-br from-white to-gray-50 border border-gray-100">
                  <div className="text-sm text-gray-500 mb-1">Rank</div>
                  <div className="text-4xl font-extrabold mb-3">#{r.rank}</div>
                  <PresenterCard rank={r.rank} name={r.name} photo={r.photo} score={r.score} votes={r.votes} />
                </div>
              ))}
            </section>

            {/* All rankings */}
            <section>
              <h2 className="text-lg font-semibold mb-3">All Presentations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((r: any) => (
                  <PresenterCard key={`${r.rank}-${r.name}`} rank={r.rank} name={r.name} photo={r.photo} score={r.score} votes={r.votes} />
                ))}
              </div>
            </section>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-gray-600">No rows found. Make sure your sheet has headers: "{NAME_COL}", "{SCORE_COL}".</div>
        )}
      </div>
    </div>
  );
}
