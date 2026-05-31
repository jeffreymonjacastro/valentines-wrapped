export type HelloResponse = {
  message: string;
};

export type ErrorResponse = {
  error: string;
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
