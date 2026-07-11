.PHONY: db-up db-down db-migrate db-migrate-dev db-seed db-reset run test lint

db-up:
	docker compose up -d --wait postgres

db-down:
	docker compose down

db-migrate:
	npm run db:migrate

db-migrate-dev:
	npm run db:migrate:dev

db-seed:
	npm run db:seed

db-reset:
	npm run db:reset

run:
	docker compose up -d --wait postgres

test:
	npm test

lint:
	npm run lint
