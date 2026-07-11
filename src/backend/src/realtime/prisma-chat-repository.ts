import type { PrismaClient } from "@prisma/client";
import type { ChatRepository } from "./chat-handler.js";

export class PrismaChatRepository implements ChatRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreateSession(userId: string) {
    return this.prisma.conversationSession.upsert({
      where: { sessionKey: `web:${userId}` },
      update: { userId, lastActivityAt: new Date() },
      create: { sessionKey: `web:${userId}`, channel: "WEB", userId },
      select: { id: true, sessionKey: true },
    });
  }

  async listMessages(sessionId: string) {
    const messages = await this.prisma.conversationMessage.findMany({
      where: { sessionId, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, role: true, redactedContent: true, externalMessageId: true, createdAt: true },
    });
    return messages.map((message) => ({ id: message.id, client_message_id: message.externalMessageId, text: message.redactedContent, sender: message.role === "USER" ? "user" as const : "bot" as const, timestamp: message.createdAt.toISOString(), status: "sent" as const }));
  }

  async findMessageByExternalId(sessionId: string, externalMessageId: string) {
    return this.prisma.conversationMessage.findUnique({ where: { sessionId_externalMessageId: { sessionId, externalMessageId } }, select: { id: true, createdAt: true } });
  }

  async createMessage(input: Parameters<ChatRepository["createMessage"]>[0]) {
    return this.prisma.conversationMessage.create({ data: input, select: { id: true, createdAt: true } });
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.conversationSession.update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } });
  }
}
