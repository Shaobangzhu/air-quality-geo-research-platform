# Isolated local PostgreSQL

## Provisioned target — 2026-10-25

The user explicitly authorized a new target after identifying `cpi-postgres` as another project's container. All containers that existed before this operation remain untouched. A before/after comparison of their IDs, states, start/finish times, restart counts, port bindings and mounts passed for all eight existing containers.

| Resource                 | Value                                                  |
| ------------------------ | ------------------------------------------------------ |
| Container                | `air-quality-geo-research-platform-postgresql`         |
| Image                    | `postgres:18.6-bookworm` (already cached locally)      |
| Host address             | `127.0.0.1:55436` → container port 5432                |
| Dedicated volume         | `air-quality-geo-research-platform-postgresql-data`    |
| Dedicated bridge network | `air-quality-geo-research-platform-postgresql-network` |
| Development DB / role    | `air_quality_geo_research` / `aq_workbench_app`        |
| Integration DB / role    | `air_quality_geo_research_test` / `aq_workbench_test`  |
| Application schema       | `aq_workbench` in each project database                |

The container is healthy. Development connectivity, the foundation migration, a repeat migration, and the real PostgreSQL integration test have passed. Development and test roles have no SUPERUSER, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS attributes and cannot connect to each other's database. The administrative bootstrap role stays out of application connection URLs.

## Reproducible initial provisioning

`compose.postgresql.yml` defines only this project's PostgreSQL service. On a fresh checkout with Docker running and the image available locally:

```sh
npm ci
npm run db:setup
npm run db:status
npm run db:migrate
npm run db:migrate
npm run test:db:local
```

`db:setup` is an initial-provisioning command. It refuses to start, adopt, replace or modify an existing target/project container, named volume or network, and refuses to overwrite local DB credentials. Do not rerun it to restart an existing target. If the image is absent, obtain the official `postgres:18.6-bookworm` image before provisioning; the setup uses `--pull never` so it cannot silently change a cached image. For a different port, set `POSTGRESQL_PORT` before the first setup. The default is 55436; the script checks both host availability and reservations on stopped containers.

Provisioning generates random administrative, application and test passwords. Only the administrative password is mounted as a Compose secret, used through `POSTGRES_PASSWORD_FILE`. Application/test bootstrap SQL is passed to `psql` on stdin inside the newly created target, without credentials in command arguments or output. Infrastructure provisioning creates roles/databases; the application and migration runner do not require those privileges.

The `.env` development URL and `.env.database-test` test URL use separate restricted roles. `.local/postgresql/` holds generated passwords and a safe metadata snapshot of the original containers. Credential files are mode 600, the local directory is mode 700, and all are Git-ignored. Other root `.env` fields are preserved. Keep these files when restarting the service; changing a local password file does not rotate a password already stored by PostgreSQL.

PostgreSQL 18 stores versioned PGDATA below `/var/lib/postgresql`, so this Compose definition mounts the dedicated volume there. See the [official PostgreSQL image documentation](https://github.com/docker-library/docs/blob/master/postgres/README.md) and [Docker Compose secrets documentation](https://docs.docker.com/compose/how-tos/use-secrets/).

## Existing target lifecycle

Manage only this project's service:

```sh
docker compose -f compose.postgresql.yml ps
docker compose -f compose.postgresql.yml stop postgresql
docker compose -f compose.postgresql.yml start postgresql
```

Stopping/starting retains the named volume. No cleanup, volume removal, database reset or destructive migration is automated. If initial provisioning fails, preserve the generated files and volume and inspect only this project's target; setup will not guess a recovery or adopt existing data. Never start or change `cpi-postgres` or any other project's container as part of this work.

The API loads root `.env` at startup. Restart an API that predates the generated configuration, particularly one launched with an explicit empty `DATABASE_URL` environment variable. Shell environment values take precedence over `.env`.

## Target guard and migrations

The URL guard accepts only `postgres:`/`postgresql:`, loopback (`localhost`, `127.0.0.1`, IPv6 `::1`) and the two project database names. URI query parameters are rejected to prevent host/options overrides. `DB_TARGET_CONFIRMED=air-quality-geo-research-platform` asserts exclusive project use. No connection occurs without a URL. Status exits 1 for missing/unavailable/rejected targets.

Migrations use one transaction, a project advisory lock, bounded timeouts, SHA-256 checksums and fully qualified tables. Existing `aq_workbench` schemas must have the comment `air-quality-geo-research-platform`; unmarked schemas are refused. Changed/missing history, out-of-order migrations and SQL/permission errors roll back. Add ordered `NNN_description.sql` files; never edit applied SQL. No drops, down migrations or resets exist.

`001_foundation.sql` adds the singleton project identity row; the runner maintains `aq_workbench.schema_migrations`. Migration 002 adds bounded snapshots/observations, and 003 adds immutable historical cases. The schema comment is an accidental-adoption guard, not protection against a hostile DB owner. Driver errors are redacted; do not wipe data to resolve checksum errors.

## Tests and CI

`npm run test:db:local` explicitly loads the ignored test-only configuration and invokes `npm run test:db`. The integration test refuses the development database, requires `ALLOW_DB_TESTS=true`, checks connection/migration repeatability/checksum metadata/unchanged foundation data, and performs no drops. Default `npm test` remains independent of PostgreSQL.

Local verification additionally checked restricted role flags and denied cross-database CONNECT privileges. The API health endpoint reports database connectivity independently from data availability. Sample and checked-in Eaton history remain usable without a database; stored snapshot replay requires PostgreSQL.

GitHub Actions defines an ephemeral PostgreSQL 17 service; the local target uses PostgreSQL 18. The Prompt 10 review independently verified the successful remote baseline run at commit `5e05806`. Review changes are tested locally; see the [dated release report](../milestones/10-v1-freeze-review.md) for precise remote/local scope.

## Milestone 02 station BFF schema

`002_station_bff.sql` adds source/site/observation/snapshot/import tables within the same project schema. `001_foundation.sql` and its identity row are preserved. Both migrations were applied/repeated on the existing development target; the separate test DB also verifies snapshot round trips, monitor/averaging-period identity and parameterized SQL-shaped values. No Docker resources or unrelated database were changed.

The store permits 32 snapshots, 512 identities and 2,000 observations per snapshot, enforced under an advisory-locked transaction. Content hashes make identical imports idempotent; there is no automatic pruning. Development now contains the labeled synthetic BFF snapshot and the separately sourced Eaton historical snapshot. No live data was acquired.

## Repeatable project-only seeds

After migrations, run each command twice to demonstrate idempotency:

```sh
npm run db:seed:sample -- --target air_quality_geo_research
npm run db:seed:historical-case -- --target air_quality_geo_research
```

Each requires an explicit target matching the configured, confirmed loopback project database. Sample stores the same 69 synthetic observations used by the keyless app; it cannot become historical. Eaton validates asset checksums and stores 71 official EPA rows plus its immutable case manifest. An existing different case version is refused. Neither seed resets data, re-fetches providers or removes snapshots. CI runs both against `air_quality_geo_research_test` twice, alongside integration assertions of immutable IDs and data. For custom reviewed imports use the existing `snapshots:import -- --file` command. See [BFF architecture](provider-bff.md) and [mode/import rules](data-modes.md).
