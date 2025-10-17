import Scoreboard from "@/components/Scoreboard";

export default function Page() {
  return (
    <Scoreboard
      title="Live Scores"
      logoSrc="/Logo.png"                     // put your logo in /public
      brandColor="#00000085"                    // any color (e.g., emerald)
      csvUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vTotvCpeAiaoYBIhx4WoO86wUQJ_ITeeTDuUPBEVs2V8PNlCLP7C1qvloOY3v15owLXFdznb1AioC95/pub?gid=680379986&single=true&output=csv"
      // Or, if private:
      // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
      // sheetId="1AbC..."
      // range="Sheet1!A1:B"
    />
  );
}
