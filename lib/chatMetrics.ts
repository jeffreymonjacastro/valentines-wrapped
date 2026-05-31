export type ChatEntry = {
  timestamp: Date;
  sender: string;
  message: string;
  isMedia: boolean;
};

export type ChatMetrics = {
  totalMessages: number;
  totalWords: number;
  senderMessageCounts: Record<string, number>;
  senderWordCounts: Record<string, number>;
  topWords: Array<{ word: string; count: number }>;
  topEmojis: Array<{ emoji: string; count: number }>;
  topDay: { date: string; count: number } | null;
  loveQuote: { date: string; sender: string; text: string } | null;
  longestMessage: { sender: string; text: string } | null;
  firstMessageDate: string | null;
  lastMessageDate: string | null;
};

const DATE_PREFIX = /^\d{1,2}\/\d{1,2}\/\d{2,4}, /;
const MEDIA_PLACEHOLDER = /<\s*(media|multimedia)\s+omitted\s*>/i;
const EMOJI_REGEX = /\p{Extended_Pictographic}/gu;
const WORD_SPLIT = /\s+/;
const CLEAN_TEXT = /[^\p{L}\p{N}\s]/gu;
const URL_REGEX = /https?:\/\/\S+/g;
const LOVE_KEYWORDS = [
  "te quiero",
  "te amo",
  "amor",
  "love",
  "te adoro",
  "mi vida",
  "mi cielo",
];
const STOP_WORDS = new Set([
  "de",
  "la",
  "que",
  "y",
  "a",
  "el",
  "en",
  "los",
  "las",
  "un",
  "una",
  "por",
  "con",
  "para",
  "mi",
  "me",
  "te",
  "tu",
  "yo",
  "si",
  "no",
  "xd",
  "xddd",
  "xdddd",
  "jaja",
  "jeje",
  "ok",
  "okno",
  "hola",
  "adios",
  "buenas",
  "buenos",
]);

function normalizeText(value: string) {
  return value.replace(/[\u200E\u200F\u202A-\u202E]/g, "");
}

function normalizeWhitespace(value: string) {
  return normalizeText(value).replace(/[^\x00-\x7F]+/g, " ").trim();
}

function parseDateTime(header: string): Date | null {
  const [rawDate, rawTime] = header.split(", ");
  if (!rawDate || !rawTime) return null;

  const dateParts = rawDate.split("/").map((part) => Number(part));
  if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) return null;

  const [first, second, third] = dateParts;
  const year = third < 100 ? 2000 + third : third;
  const isDayFirst = first > 12 || (first <= 12 && second > 12);
  const day = isDayFirst ? first : second;
  const month = isDayFirst ? second : first;

  const timePart = normalizeWhitespace(rawTime);
  const timeMatch = timePart.match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const isPm = /p/i.test(timePart);
  const isAm = /a/i.test(timePart);

  if (isPm && hour < 12) hour += 12;
  if (isAm && hour === 12) hour = 0;

  return new Date(year, month - 1, day, hour, minute);
}

export function parseChatText(text: string): ChatEntry[] {
  const entries: ChatEntry[] = [];
  const lines = text.split(/\r?\n/);
  let lastEntry: ChatEntry | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    if (DATE_PREFIX.test(line)) {
      const [header, rest] = line.split(" - ");
      if (!rest) continue;

      const messageSplit = rest.split(": ");
      if (messageSplit.length < 2) {
        lastEntry = null;
        continue;
      }

      const sender = messageSplit.shift()?.trim() ?? "";
      const message = messageSplit.join(": ").trim();
      const timestamp = parseDateTime(header.trim());
      if (!sender || !timestamp) {
        lastEntry = null;
        continue;
      }

      const entry = {
        timestamp,
        sender,
        message,
        isMedia: MEDIA_PLACEHOLDER.test(message),
      };
      entries.push(entry);
      lastEntry = entry;
    } else if (lastEntry) {
      lastEntry.message = `${lastEntry.message} ${line.trim()}`.trim();
    }
  }

  return entries;
}

function countWords(message: string): string[] {
  const cleaned = message
    .toLowerCase()
    .replace(URL_REGEX, " ")
    .replace(CLEAN_TEXT, " ");

  return cleaned
    .split(WORD_SPLIT)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function buildMetricsFromChatText(texts: string[]): ChatMetrics {
  const entries = texts.flatMap(parseChatText);

  const senderMessageCounts: Record<string, number> = {};
  const senderWordCounts: Record<string, number> = {};
  const wordCounts = new Map<string, number>();
  const emojiCounts = new Map<string, number>();
  const dayCounts = new Map<string, number>();

  let totalMessages = 0;
  let totalWords = 0;
  let loveQuote: ChatMetrics["loveQuote"] = null;
  let longestMessage: ChatMetrics["longestMessage"] = null;

  for (const entry of entries) {
    totalMessages += 1;
    senderMessageCounts[entry.sender] =
      (senderMessageCounts[entry.sender] ?? 0) + 1;

    if (!entry.isMedia) {
      const words = countWords(entry.message);
      totalWords += words.length;
      senderWordCounts[entry.sender] =
        (senderWordCounts[entry.sender] ?? 0) + words.length;

      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }

      const emojis = entry.message.match(EMOJI_REGEX) ?? [];
      for (const emoji of emojis) {
        emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1);
      }

      if (
        !longestMessage ||
        entry.message.length > longestMessage.text.length
      ) {
        longestMessage = { sender: entry.sender, text: entry.message };
      }

      const messageLower = entry.message.toLowerCase();
      let score = 0;
      for (const keyword of LOVE_KEYWORDS) {
        if (messageLower.includes(keyword)) score += 1;
      }
      if (score > 0) {
        const formattedDate = formatDate(entry.timestamp);
        if (!loveQuote || score > 1) {
          loveQuote = {
            date: formattedDate,
            sender: entry.sender,
            text: entry.message,
          };
        } else if (loveQuote && !loveQuote.date) {
          loveQuote = {
            date: formattedDate,
            sender: entry.sender,
            text: entry.message,
          };
        }
      }
    }

    const dayKey = formatDate(entry.timestamp);
    dayCounts.set(dayKey, (dayCounts.get(dayKey) ?? 0) + 1);
  }

  const topWords = Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word, count]) => ({ word, count }));

  const topEmojis = Array.from(emojiCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([emoji, count]) => ({ emoji, count }));

  const topDayEntry = Array.from(dayCounts.entries()).sort(
    (a, b) => b[1] - a[1]
  )[0];

  const sortedDates = entries
    .map((entry) => entry.timestamp)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    totalMessages,
    totalWords,
    senderMessageCounts,
    senderWordCounts,
    topWords,
    topEmojis,
    topDay: topDayEntry ? { date: topDayEntry[0], count: topDayEntry[1] } : null,
    loveQuote,
    longestMessage,
    firstMessageDate: sortedDates[0] ? formatDate(sortedDates[0]) : null,
    lastMessageDate: sortedDates[sortedDates.length - 1]
      ? formatDate(sortedDates[sortedDates.length - 1])
      : null,
  };
}
