import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PasswordHasher } from "./auth/password-hasher.js";
import { PrismaAuthRepository } from "./auth/prisma-auth-repository.js";
import { TokenService } from "./auth/token-service.js";
import { DemoAiClient } from "./ai/demo-ai-client.js";
import { OpenAiClient } from "./ai/openai-ai-client.js";
import { OpenAiMenuIntentExtractor } from "./ai/menu-intent-extractor.js";
import { OrderingAgent } from "./ai/ordering-agent.js";
import { PrismaOrderDraftStore } from "./ai/prisma-order-draft-store.js";
import { PrismaMenuSearch } from "./ai/menu-search.js";
import { loadAiConfig } from "./config/ai-config.js";
import { loadAuthConfig } from "./config/auth-config.js";
import { createAuthApplication } from "./http/app.js";
import { ChatHandler } from "./realtime/chat-handler.js";
import { PrismaChatRepository } from "./realtime/prisma-chat-repository.js";

const config = loadAuthConfig();
const aiConfig = loadAiConfig();
const prisma = new PrismaClient();
const menuSearch = new PrismaMenuSearch(prisma);
const ai = aiConfig.useDemoFallback ? new DemoAiClient(menuSearch) : (() => {
  const responder = new OpenAiClient(aiConfig.apiKey!, aiConfig.baseUrl, aiConfig.modelName, aiConfig.maxOutputTokens, menuSearch);
  return new OrderingAgent(new OpenAiMenuIntentExtractor(aiConfig.apiKey!, aiConfig.baseUrl, aiConfig.modelName, aiConfig.maxOutputTokens), menuSearch, responder, new PrismaOrderDraftStore(prisma));
})();
const application = createAuthApplication(
  { repository: new PrismaAuthRepository(prisma), hasher: new PasswordHasher(config.tokenPepper), tokens: new TokenService(config.accessTokenSecret, config.refreshTokenSecret, config.accessTokenTtlSeconds, config.refreshTokenTtlSeconds) },
  prisma,
  { chatHandler: new ChatHandler(new PrismaChatRepository(prisma), ai) },
);
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
await application.listen(port, host);
console.log(`Server is running on http://${host}:${port}`);
