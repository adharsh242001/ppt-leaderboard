// Live Scoreboard (Google Sheets) – Drop-in React component for Next.js
// ---------------------------------------------------------------
// What this does
// - Fetches rows from a Google Sheet (either a published CSV URL OR Sheets API v4)
// - Expects headers like: Name, Photo, Score (or customize below)
// - Renders presenter cards with image, average score, votes, and live ranking
// - Auto-refreshes every 10 seconds (configurable)
// - Mobile-friendly, clean Tailwind UI
//
// How to use (fastest path: Published CSV)
// 1) In Google Sheets: File → Share → Publish to web → Entire sheet → CSV. Copy the URL.
// 2) Paste it into the SHEET_CSV_URL below (or pass via props).
// 3) Import this component into a Next.js page (app or pages router) and render it.
//    Example: <Scoreboard csvUrl={"https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"} />
//
// Using private sheets (API key):
// - Create a Google Cloud API key with Sheets API enabled.
// - Note your SHEET_ID (the long id in the sheet URL) and RANGE (e.g., "Sheet1!A1:D").
// - Provide apiKey, sheetId, and range props instead of csvUrl.
//   Example: <Scoreboard apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY} sheetId={"1AbC..."} range={"Sheet1!A1:D"} />
//
// Customize column headers below (NAME_COL, PHOTO_COL, SCORE_COL, VOTES_COL)
// to match your sheet headers exactly.
// ---------------------------------------------------------------
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ---- Configuration ----
const REFRESH_MS = 10_000; // auto-refresh every 10 seconds
const NAME_COL = "Name";   // header for presenter name
const PHOTO_COL = "Photo"; // header for photo URL (can be empty)
const SCORE_COL = "Score"; // header for numeric score (1–10) or average; supports non-numeric rows gracefully
const VOTES_COL = "Votes"; // header for vote count (optional)

// Utility: tiny CSV parser (handles quotes, commas, and newlines)
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let i = 0, cur = '' as string, row: string[] = [], inQuotes = false;
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
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* ignore */ }
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

// Fetchers
async function fetchFromCSV(csvUrl: string) {
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const [header, ...data] = rows;
  const headerIdx: Record<string, number> = {};
  header.forEach((h, i) => headerIdx[h.trim()] = i);
  return data.map(r => ({
    name: r[headerIdx[NAME_COL]] ?? "",
    photo: r[headerIdx[PHOTO_COL]] ?? "",
    score: r[headerIdx[SCORE_COL]] ?? "",
    votes: r[headerIdx[VOTES_COL]] ?? "",
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
  const headerIdx: Record<string, number> = {};
  header.forEach((h: string, i: number) => headerIdx[h.trim()] = i);
  return data.map((r: string[]) => ({
    name: r[headerIdx[NAME_COL]] ?? "",
    photo: r[headerIdx[PHOTO_COL]] ?? "",
    score: r[headerIdx[SCORE_COL]] ?? "",
    votes: r[headerIdx[VOTES_COL]] ?? "",
  }));
}

// Card component
function PresenterCard({ rank, name, photo, score, votes }: { rank: number; name: string; photo?: string; score: string; votes?: string; }) {
  const initials = useMemo(() => name.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase(), [name]);
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
      let data: any[] = [];
      if (csvUrl) data = await fetchFromCSV(csvUrl);
      else if (apiKey && sheetId && range) data = await fetchFromSheetsApi(apiKey, sheetId, range);
      else throw new Error("Provide csvUrl OR apiKey+sheetId+range");

      // Normalize & clean
      const cleaned = data.map((d) => {
        const scoreNum = Number(String(d.score).replace(/,/g, '.'));
        const votesNum = d.votes !== undefined && d.votes !== "" ? Number(d.votes) : undefined;
        return {
          name: (d.name || "").trim(),
          photo: (d.photo || "").trim(),
          score: isFinite(scoreNum) ? scoreNum.toFixed(2) : "—",
          scoreNum: isFinite(scoreNum) ? scoreNum : -Infinity,
          votes: votesNum !== undefined && isFinite(votesNum) ? String(votesNum) : undefined,
        };
      }).filter(r => r.name);

      const ranked = withRanks(cleaned);
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
          <div className="text-sm text-gray-500">Auto-updates every {REFRESH_MS/1000}s</div>
        </header>

        {loading && (
          <div className="animate-pulse text-gray-500">Loading scores…</div>
        )}
        {error && (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">{error}</div>
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
          <div className="text-gray-600">No rows found. Check your sheet headers and data.</div>
        )}
      </div>
    </div>
  );
}

// Example Next.js page (App Router):
// Create app/scoreboard/page.tsx and paste:
//
// import Scoreboard from "@/components/Scoreboard"; // or the path where you place this file
// export default function Page() {
//   return (
//     <Scoreboard
//       title="Presentation Scores"
//       csvUrl="https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv"
//       // OR for private sheets:
//       // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
//       // sheetId="1AbCdef..."
//       // range="Sheet1!A1:D"
//     />
//   );
// }
