export type ChatAiInput = {
  userId: string;
  sessionId: string;
  text: string;
  history: Array<{ sender: "user" | "bot"; text: string }>;
};

export interface ChatAi {
  respond(input: ChatAiInput): Promise<string>;
}
