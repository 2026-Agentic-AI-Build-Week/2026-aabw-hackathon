import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PasswordHasher } from "./auth/password-hasher.js";
import { PrismaAuthRepository } from "./auth/prisma-auth-repository.js";
import { TokenService } from "./auth/token-service.js";
import { loadAuthConfig } from "./config/auth-config.js";
import { createAuthApplication } from "./http/app.js";

const config = loadAuthConfig();
const prisma = new PrismaClient();
const application = createAuthApplication({ repository: new PrismaAuthRepository(prisma), hasher: new PasswordHasher(config.tokenPepper), tokens: new TokenService(config.accessTokenSecret, config.refreshTokenSecret, config.accessTokenTtlSeconds, config.refreshTokenTtlSeconds) }, prisma);
const port = Number(process.env.PORT ?? 3000);
await application.listen(port);
console.log(`Server is running on http://localhost:${port}`);
