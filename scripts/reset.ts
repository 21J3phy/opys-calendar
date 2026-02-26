import { loadCalendarFromFile, saveCalendarToFile } from "../shared/calendarMarkdown";
import path from "node:path";

async function run() {
    const calendarPath = path.join(process.cwd(), "calendar.md");
    const doc = await loadCalendarFromFile(calendarPath);
    doc.events = [];
    await saveCalendarToFile(calendarPath, doc);
    console.log("Calendar reset.");
}

run();
