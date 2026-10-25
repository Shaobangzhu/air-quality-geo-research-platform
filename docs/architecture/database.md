# Safe local PostgreSQL setup

## Observed status

On 2026-10-25 read-only `docker ps` succeeded and found only a MongoDB 7 container. No PostgreSQL container or repository DB configuration was identified. No credentials were inspected, inferred or printed; no database was queried or modified. No role, schema, container or volume was changed. Local PostgreSQL connectivity and migrations remain **unverified**.

## Supply an isolated target

Use PostgreSQL in your existing user-managed local Docker infrastructure. Have its owner provision a dedicated `air_quality_geo_research` database and a project role. Integration tests need a separate `air_quality_geo_research_test` database. Do not use another project's database even if your role has access. The repository does not create a Compose stack, roles or databases.

The role needs CONNECT and CREATE on its dedicated DB and ownership/use of its own schema/tables. No SUPERUSER, CREATEROLE, CREATEDB or PostGIS privilege is needed. Grant no access to unrelated data. Provisioning is an infrastructure-owner operation.

Set root `.env` with your own URI-encoded credentials and confirmed published host port:

```dotenv
DATABASE_URL=postgresql://PROJECT_ROLE:YOUR_PASSWORD@127.0.0.1:YOUR_PORT/air_quality_geo_research
DB_TARGET_CONFIRMED=air-quality-geo-research-platform
```

This is a template, not a working credential. The guard accepts `postgres:`/`postgresql:`, loopback (`localhost`, `127.0.0.1`, IPv6 `::1`) and the two project DB names. URI query parameters are rejected to prevent host/options overrides. Ownership confirmation asserts that you checked exclusive project use; naming alone is not proof. No connection occurs without a URL.

```sh
npm run db:status
npm run db:migrate
npm run db:migrate
```

Expect connected, one migration applied, then already current. Status exits 1 for not-configured/unavailable/rejected targets; this cannot be mistaken for verified connectivity. The shell runs without a DB.

## Migration behavior

One transaction uses a project advisory lock, bounded timeouts, SHA-256 checksums and fully qualified tables. Existing `aq_workbench` schemas must have the comment `air-quality-geo-research-platform`; unmarked schemas are refused. Changed/missing history, out-of-order migrations and SQL/permission errors roll back. Add monotonically ordered `NNN_description.sql` files; never edit applied SQL. No drops, down migrations or resets exist.

`001_foundation.sql` adds only a singleton project identity row; the runner maintains `aq_workbench.schema_migrations`. No domain ingestion exists. The schema comment is an accidental-adoption guard, not protection against a hostile DB owner. Driver errors are redacted; check configuration and local PostgreSQL logs without sharing secrets. Never wipe data to resolve checksum errors.

## Tests and CI

Explicitly export a confirmed test URL and `ALLOW_DB_TESTS=true`, then run `npm run test:db`. This test reads process environment, not root `.env`, to avoid silently selecting development data. It rejects the development DB name and never drops data. It checks connection, repeatability, unchanged singleton contents and checksum metadata. Default `npm test` does not connect.

GitHub Actions defines an ephemeral PostgreSQL 17 service with fixture-only credentials. Its role is privileged inside that disposable CI container; the migration SQL itself requires no elevated rights. CI checks connectivity, runs migrations twice and executes integration tests. The workflow is **configured, not verified remotely** and does not establish local Docker PostgreSQL connectivity.
