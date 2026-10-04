import type { KpopCalendarEvent } from "../types/music";

const kpopCalendarIcsUrl = "https://kpopcal.com/ics/all.ics";

type IcsEvent = Record<string, string>;

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function cleanIcsValue(value = "") {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .trim();
}

function readIcsProperty(line: string) {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;

  const key = line.slice(0, colonIndex).split(";")[0].toUpperCase();
  const value = cleanIcsValue(line.slice(colonIndex + 1));
  return { key, value };
}

function parseIcsDate(value = "") {
  const date = value.slice(0, 8);
  if (!/^\d{8}$/.test(date)) return "";
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
}

function parseSummary(summary: string) {
  const parts = summary.split(" — ");
  if (parts.length < 2) {
    return {
      artistName: "K-pop",
      title: summary
    };
  }

  return {
    artistName: parts[0].trim(),
    title: parts.slice(1).join(" — ").trim()
  };
}

function inferEventType(summary: string, description: string) {
  const text = `${summary} ${description}`.toLowerCase();
  if (text.includes("comeback")) return "comeback";
  if (text.includes("debut")) return "debut";
  if (text.includes("release") || text.includes("album") || text.includes("single")) return "release";
  if (text.includes("tour") || text.includes("concert")) return "tour";
  if (text.includes("music show")) return "music show";
  return "event";
}

function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;

  for (const line of unfoldIcs(text).split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const property = readIcsProperty(line);
    if (!property) continue;
    current[property.key] = property.value;
  }

  return events;
}

export async function fetchKpopCalendarEvents() {
  const response = await fetch(kpopCalendarIcsUrl);
  if (!response.ok) throw new Error("Could not load K-Pop Calendar feed.");

  const text = await response.text();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return parseIcs(text)
    .map((event): KpopCalendarEvent | null => {
      const summary = event.SUMMARY;
      const date = parseIcsDate(event.DTSTART);
      if (!summary || !date) return null;

      const { artistName, title } = parseSummary(summary);

      return {
        id: event.UID || `${date}-${summary}`,
        artistName,
        title,
        date,
        type: inferEventType(summary, event.DESCRIPTION ?? ""),
        source: {
          label: "K-Pop Calendar",
          url: "https://www.kpopcal.com/data",
          kind: "metadata"
        },
        url: event.URL || "https://kpopcal.com/",
        confirmed: !`${event.DESCRIPTION ?? ""} ${summary}`.toLowerCase().includes("tba"),
        description: event.DESCRIPTION
      };
    })
    .filter((event): event is KpopCalendarEvent => Boolean(event))
    .filter((event) => new Date(`${event.date}T00:00:00`).getTime() >= today.getTime())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 60);
}
