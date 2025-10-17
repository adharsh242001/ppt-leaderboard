"use client";

// Live Scoreboard — themable UI (title + logo + brand color + animated background)
import React, { useEffect, useMemo, useRef, useState } from "react";

/* ─── Config you might tweak ───────────────────────────────────────────── */
const REFRESH_MS = 10_000;
const NAME_COL = "Name";
const SCORE_COL = "Score";

// "sum" = total of all votes per presenter, "avg" = average score
const DISPLAY_METRIC: "sum" | "avg" = "sum";
const DISPLAY_LABEL = DISPLAY_METRIC === "sum" ? "Total" : "Average";

// Local photos mapped by *exact* Name from the sheet
const PHOTO_BY_NAME: Record<string, string> = {
  "Muhasin TP": "/photos/Muhasin%20TP.JPG",
  // Add more presenters here:
  // "Alice Chen": "/photos/alice.jpg",
  // "Bob Kumar": "/photos/bob.jpg",
};

/* ─── CSV helpers ──────────────────────────────────────────────────────── */
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
  const scoreIdx = headerIdx[norm(SCORE_COL)];
  if (nameIdx === undefined || scoreIdx === undefined) return [];

  return data.map(r => ({
    name: (r[nameIdx] ?? "").trim(),
    score: (r[scoreIdx] ?? "").trim(),
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
  header.forEach((h, i) => (headerIdx[norm(h)] = i));

  const nameIdx = headerIdx[norm(NAME_COL)];
  const scoreIdx = headerIdx[norm(SCORE_COL)];
  if (nameIdx === undefined || scoreIdx === undefined) return [];

  return data.map(r => ({
    name: (r[nameIdx] ?? "").trim(),
    score: (r[scoreIdx] ?? "").trim(),
  }));
}

/* ─── Ranking helper ───────────────────────────────────────────────────── */
function withRanks<T extends { scoreNum: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => b.scoreNum - a.scoreNum);
  let lastScore: number | null = null; let lastRank = 0;
  return sorted.map((item, idx) => {
    const rank = (lastScore === item.scoreNum) ? lastRank : (idx + 1);
    lastScore = item.scoreNum; lastRank = rank;
    return { ...item, rank };
  });
}

/* ─── Presentational bits ──────────────────────────────────────────────── */
function PresenterCard({
  rank, name, photo, score, votes, brandColor,
}: {
  rank: number; name: string; photo?: string; score: string; votes?: string; brandColor: string;
}) {
  const initials = useMemo(
    () => name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase(),
    [name]
  );
  return (
    <div className="group relative rounded-2xl shadow-sm hover:shadow-md transition p-4 bg-white border border-gray-200">
      <div
        className="absolute -top-3 -left-3 text-white text-xs font-semibold rounded-xl px-2.5 py-1 shadow"
        style={{ backgroundColor: brandColor }}
      >
        #{rank}
      </div>
      <div className="flex items-center gap-4">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={name} className="h-16 w-16 rounded-xl object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-gray-100 grid place-items-center text-gray-700 font-semibold">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-lg font-semibold text-gray-900 truncate">{name || "Unnamed"}</div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-2xl font-bold tabular-nums text-gray-900">{score}</span>
            <span className="text-xs text-gray-500">{DISPLAY_LABEL}</span>
            {votes ? <span className="text-sm text-gray-600">{votes} votes</span> : null}
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

  const [rows, setRows] = useState<{ name: string; photo?: string; score: string; votes?: string; scoreNum?: number; rank?: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      let raw: { name: string; score: string }[] = [];

      if (csvUrl) raw = await fetchFromCSV(csvUrl);
      else if (apiKey && sheetId && range) raw = await fetchFromSheetsApi(apiKey, sheetId, range);
      else throw new Error("Provide csvUrl OR apiKey+sheetId+range");

      type Agg = { total: number; count: number };
      const map = new Map<string, Agg>();

      for (const r of raw) {
        if (!r.name) continue;
        const scoreNum = Number(String(r.score).replace(/,/g, "."));
        if (!Number.isFinite(scoreNum)) continue;

        const cur = map.get(r.name) ?? { total: 0, count: 0 };
        cur.total += scoreNum;
        cur.count += 1;
        map.set(r.name, cur);
      }

      const aggregated = Array.from(map.entries()).map(([name, agg]) => {
        const scoreNum = DISPLAY_METRIC === "sum" ? agg.total : agg.total / Math.max(1, agg.count);
        const display = DISPLAY_METRIC === "sum" ? scoreNum.toFixed(0) : scoreNum.toFixed(2);
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
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "hsl(230 35% 97%)" }}>
      {/* ── Animated Background Layer (pure CSS, low GPU cost) ─────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        {/* soft moving gradient tint */}
        <div className="absolute -inset-1 opacity-60 animate-gradient" style={{ 
          background: `radial-gradient(1200px 500px at 10% 10%, ${brandColor}20, transparent 60%),
                       radial-gradient(1000px 500px at 90% 20%, ${brandColor}26, transparent 60%),
                       radial-gradient(900px 600px at 50% 100%, ${brandColor}1f, transparent 60%)`
        }} />
        {/* floating blobs */}
        <div className="absolute -top-24 -left-24 blur-3xl animate-float-slow" style={{
          width: "420px", height: "420px", borderRadius: "50%",
          background: `linear-gradient(145deg, ${brandColor}44, ${brandColor}22)`
        }} />
        <div className="absolute top-1/3 -right-24 blur-3xl animate-float-med" style={{
          width: "360px", height: "360px", borderRadius: "50%",
          background: `linear-gradient(145deg, ${brandColor}33, ${brandColor}11)`
        }} />
        <div className="absolute bottom-[-140px] left-1/3 blur-3xl animate-float-fast" style={{
          width: "320px", height: "320px", borderRadius: "50%",
          background: `linear-gradient(145deg, ${brandColor}29, ${brandColor}10)`
        }} />
      </div>

      {/* global keyframes (scoped) */}
      <style jsx global>{`
        @keyframes gradientMove {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-10px) rotate(2deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes floatSlow {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(10px, -8px) scale(1.03); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes floatMed {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-12px, 12px) scale(1.04); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes floatFast {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(8px, -12px) scale(1.02); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .animate-gradient { animation: gradientMove 12s ease-in-out infinite; }
        .animate-float-slow { animation: floatSlow 22s ease-in-out infinite; }
        .animate-float-med  { animation: floatMed 18s ease-in-out infinite; }
        .animate-float-fast { animation: floatFast 14s ease-in-out infinite; }
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-6 md:py-10">
        {/* Header with title (left) + logo (right) */}
        <header className="mb-6 md:mb-8 flex items-center justify-between">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900">
            {title}
          </h1>
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Logo"
              className="h-10 md:h-12 w-auto rounded-md"
              style={{ boxShadow: "0 0 0 3px rgba(0,0,0,0.03)" }}
            />
          ) : null}
        </header>

        {loading && <div className="text-gray-700">Loading scores…</div>}
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
                <div
                  key={r.name}
                  className="rounded-2xl p-4 border bg-white"
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">RANK</div>
                  <div className="text-4xl font-extrabold mb-3" style={{ color: brandColor }}>
                    #{r.rank}
                  </div>
                  <PresenterCard
                    rank={r.rank}
                    name={r.name}
                    photo={r.photo}
                    score={r.score}
                    votes={r.votes}
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
                    photo={r.photo}
                    score={r.score}
                    votes={r.votes}
                    brandColor={brandColor}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-gray-800">
            No rows found. Make sure your sheet has headers: “{NAME_COL}”, “{SCORE_COL}”.
          </div>
        )}

        <div className="mt-8 text-sm text-gray-600">Auto-updates every {REFRESH_MS / 1000}s</div>
      </div>
    </div>
  );
}
