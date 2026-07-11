import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PasswordHasher } from "./auth/password-hasher.js";
import { PrismaAuthRepository } from "./auth/prisma-auth-repository.js";
import { TokenService } from "./auth/token-service.js";
import { loadAuthConfig } from "./config/auth-config.js";
import { createAuthApplication } from "./http/app.js";

const config = loadAuthConfig();
const application = createAuthApplication({ repository: new PrismaAuthRepository(new PrismaClient()), hasher: new PasswordHasher(config.tokenPepper), tokens: new TokenService(config.accessTokenSecret, config.refreshTokenSecret, config.accessTokenTtlSeconds, config.refreshTokenTtlSeconds) });
const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);
await application.listen(port, host);
console.log(`Server is running on http://${host}:${port}`);
