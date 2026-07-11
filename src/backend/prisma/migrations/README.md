# Prisma migrations

Run `make -C src/backend db-migrate-dev` from the repository root after starting
PostgreSQL to generate migrations from `src/backend/prisma/schema.prisma`.
Commit the generated migration directory. Deployment environments apply
committed migrations with `make -C src/backend db-migrate`.
