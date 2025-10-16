import Scoreboard from "@/components/Scoreboard";

export default function Page() {
  return (
    <Scoreboard
      title="Presentation Scores"
      // Use one of these (not both):

      // Public CSV (easiest)
      csvUrl="https://docs.google.com/spreadsheets/d/e/2PACX-1vTTGLO0aYsEDRX2zaPeDnGEbbJzupwP9gRwZCwX8Z2zxo6btmsmJ4Cvi1mnJ3_hCuaNQsJb-NMpVhVf/pubhtml"

      // Private Sheets API
      // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
      // sheetId="1AbCdef..."
      // range="Sheet1!A1:D"
    />
  );
}
