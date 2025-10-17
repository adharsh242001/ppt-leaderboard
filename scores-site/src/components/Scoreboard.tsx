"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// ---- Config ----
const REFRESH_MS = 10_000;
const NAME_COL = "Name";
const SCORE_COL = "Sum";
const COUNT_COL = "Count";
const AVG_COL = "Avg";

// Local photos mapped by *exact* Name from the sheet
const PHOTO_BY_NAME: Record<string, string> = {
  "Midhuna": "/photos/Midhuna.jpg",
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

// ---- Floating Background Elements ----
function BackgroundElements() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* Animated circles */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-100 rounded-full opacity-30 animate-pulse"></div>
      <div className="absolute top-1/2 -left-20 w-60 h-60 bg-blue-100 rounded-full opacity-20 animate-bounce" style={{animationDuration: '3s'}}></div>
      <div className="absolute bottom-10 right-1/4 w-40 h-40 bg-green-100 rounded-full opacity-25 animate-pulse" style={{animationDelay: '1s'}}></div>
      
      {/* Floating geometric shapes */}
      <div className="absolute top-1/4 left-1/4 w-6 h-6 bg-purple-200 rotate-45 opacity-40 animate-spin" style={{animationDuration: '8s'}}></div>
      <div className="absolute top-3/4 right-1/3 w-4 h-4 bg-blue-200 rounded-full opacity-30 animate-bounce" style={{animationDuration: '4s', animationDelay: '2s'}}></div>
      <div className="absolute bottom-1/3 left-1/3 w-8 h-2 bg-green-200 opacity-30 animate-pulse" style={{animationDelay: '3s'}}></div>
      
      {/* Gradient orbs */}
      <div className="absolute top-20 right-1/3 w-32 h-32 bg-gradient-to-br from-purple-200 to-transparent rounded-full opacity-20 animate-pulse"></div>
      <div className="absolute bottom-40 left-1/4 w-24 h-24 bg-gradient-to-br from-blue-200 to-transparent rounded-full opacity-15 animate-bounce" style={{animationDuration: '5s'}}></div>
    </div>
  );
}

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

// ---- Header Component ----
function Header({ title, logoSrc, lastUpdated }: { title: string; logoSrc?: string; lastUpdated?: Date }) {
  return (
    <header className="relative z-10 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {logoSrc && (
              <img
                src={logoSrc}
                alt="Logo"
                className="h-12 w-12 rounded-xl object-cover shadow-md"
              />
            )}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-500 mt-1">Real-time presentation scores</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="flex items-center space-x-2 text-green-600 bg-green-50 px-3 py-2 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">LIVE</span>
            </div>
            {lastUpdated && (
              <p className="text-xs text-gray-400 mt-1">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

// ---- Podium Component ----
function Podium({ top3, brandColor }: { top3: any[]; brandColor: string }) {
  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32']; // Gold, Silver, Bronze
  const podiumHeights = ['h-32', 'h-24', 'h-20'];
  
  return (
    <section className="relative z-10 mb-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">🏆 Top Performers</h2>
      <div className="flex justify-center items-end space-x-4 max-w-4xl mx-auto">
        {top3.map((performer, index) => {
          const initials = performer.name.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
          const position = index === 0 ? 1 : index === 1 ? 2 : 3;
          const actualIndex = position === 1 ? 0 : position === 2 ? 1 : 2;
          
          return (
            <div key={performer.name} className="flex flex-col items-center">
              {/* Avatar */}
              <div className="mb-4 relative">
                {PHOTO_BY_NAME[performer.name] ? (
                  <img 
                    src={PHOTO_BY_NAME[performer.name]} 
                    alt={performer.name}
                    className="w-20 h-20 rounded-full object-cover border-4 shadow-lg"
                    style={{ borderColor: podiumColors[actualIndex] }}
                  />
                ) : (
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold border-4 shadow-lg"
                    style={{ backgroundColor: brandColor, borderColor: podiumColors[actualIndex] }}
                  >
                    {initials}
                  </div>
                )}
                {/* Crown for 1st place */}
                {position === 1 && (
                  <div className="absolute -top-2 -right-2 text-2xl">👑</div>
                )}
              </div>
              
              {/* Name and Score */}
              <div className="text-center mb-4">
                <h3 className="font-bold text-gray-900">{performer.name}</h3>
                <p className="text-2xl font-bold" style={{ color: brandColor }}>{performer.sum}</p>
                <p className="text-sm text-gray-500">Avg: {performer.avg}</p>
              </div>
              
              {/* Podium */}
              <div 
                className={`w-24 ${podiumHeights[actualIndex]} rounded-t-lg flex items-center justify-center text-white font-bold text-xl shadow-lg`}
                style={{ backgroundColor: podiumColors[actualIndex] }}
              >
                {position}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Participant Card ----
function ParticipantCard({ participant, brandColor }: { participant: any; brandColor: string }) {
  const initials = participant.name.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
  
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-gray-200 group">
      <div className="flex items-center space-x-4">
        {/* Rank */}
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-md"
          style={{ backgroundColor: brandColor }}
        >
          #{participant.rank}
        </div>
        
        {/* Avatar */}
        {PHOTO_BY_NAME[participant.name] ? (
          <img 
            src={PHOTO_BY_NAME[participant.name]} 
            alt={participant.name}
            className="w-16 h-16 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
          />
        ) : (
          <div 
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-semibold shadow-md group-hover:scale-105 transition-transform"
            style={{ backgroundColor: `${brandColor}80` }}
          >
            {initials}
          </div>
        )}
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-lg truncate">{participant.name}</h3>
          <div className="flex space-x-4 mt-2">
            <div className="text-center">
              <p className="text-xs text-gray-500">Score</p>
              <p className="font-bold text-lg" style={{ color: brandColor }}>{participant.sum}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Count</p>
              <p className="font-semibold text-gray-700">{participant.count}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Average</p>
              <p className="font-semibold text-gray-700">{participant.avg}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Main Scoreboard Component ----
export default function Scoreboard(props: {
  title?: string;
  logoSrc?: string;
  brandColor?: string;
  csvUrl?: string;
  apiKey?: string; 
  sheetId?: string; 
  range?: string;
}) {
  const {
    title = "Live Scores",
    logoSrc,
    brandColor = "#6366f1",
    csvUrl, 
    apiKey, 
    sheetId, 
    range,
  } = props;

  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>();
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
        scoreNum: parseFloat(r.sum) || 0,
      }));

      const ranked = withRanks(aggregated);
      setRows(ranked);
      setLastUpdated(new Date());
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
  const remaining = useMemo(() => rows.slice(3), [rows]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative">
      <BackgroundElements />
      
      <Header title={title} logoSrc={logoSrc} lastUpdated={lastUpdated} />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading scores...</p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-8 rounded-r-lg">
            <div className="flex">
              <div className="ml-3">
                <p className="text-red-700 font-medium">Error loading data</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            {/* Podium for top 3 */}
            {top3.length >= 3 && (
              <Podium top3={top3} brandColor={brandColor} />
            )}
            
            {/* All participants */}
            <section className="relative z-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                📊 All Participants ({rows.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((participant: any) => (
                  <ParticipantCard
                    key={`${participant.rank}-${participant.name}`}
                    participant={participant}
                    brandColor={brandColor}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl text-gray-600 mb-2">No data found</p>
            <p className="text-gray-500">Check your sheet headers and data source</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 text-center text-sm text-gray-500">
          <p>Updates automatically every {REFRESH_MS / 1000} seconds</p>
        </footer>
      </main>
    </div>
  );
}