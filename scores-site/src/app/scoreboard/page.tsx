import Scoreboard from "@/components/Scoreboard";

export default function Page() {
  return (
    <Scoreboard
      title="Presentation Scores"
      // Use one of these (not both):

      // Public CSV (easiest)
      csvUrl="https://docs.google.com/spreadsheets/d/e/XXXX/pub?output=csv"

      // Private Sheets API
      // apiKey={process.env.NEXT_PUBLIC_GSHEETS_API_KEY!}
      // sheetId="1AbCdef..."
      // range="Sheet1!A1:D"
    />
  );
}
