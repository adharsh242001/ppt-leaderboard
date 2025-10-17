import Scoreboard from "@/components/Scoreboard";

export default function Page() {
  return (
    <Scoreboard
      title="Live Scores"
      logoSrc="/Logo.png"                     // put your logo in /public
      brandColor="#732dff85"                    // any color (e.g., emerald)
      csvUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vTTGLO0aYsEDRX2zaPeDnGEbbJzupwP9gRwZCwX8Z2zxo6btmsmJ4Cvi1mnJ3_hCuaNQsJb-NMpVhVf/pub?output=csv"
      // Or, if private:
      // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
      // sheetId="1AbC..."
      // range="Sheet1!A1:B"
    />
  );
}
