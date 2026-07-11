# Prisma migrations

After starting PostgreSQL, run `npm run db:migrate:dev` from `src/backend` to
generate migrations from `src/backend/prisma/schema.prisma`.
Commit the generated migration directory. Deployment environments apply
committed migrations with `npm run db:migrate` from `src/backend`.
