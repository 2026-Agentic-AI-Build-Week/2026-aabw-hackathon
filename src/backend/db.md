# Database implementation

The executable database design is defined in
`src/backend/prisma/schema.prisma` and follows the workflow in `plan.md`.

- PostgreSQL 16 runs from `src/backend/docker-compose.yml`.
- Prisma ORM owns schema, migrations, generated client, and seed execution.
- `User` requires unique email and phone; the application trims and lowercases
  email before every lookup or write.
- Catalog, modifiers, identity, OTP, loyalty, voucher, session, cart, quote,
  order, handoff, and audit data are normalized into dedicated models.
- Historical order data uses snapshots so later menu, voucher, address, or user
  changes do not alter completed orders.

See the root `README.md` for setup and package-targeted command documentation.
