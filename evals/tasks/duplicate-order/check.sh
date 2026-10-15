#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
outside_infrastructure() { added_prod | grep -v '^src/[^/]*\.Infrastructure/' || true; }
api() { added_in '^src/[^/]*\.Api/'; }
expect_some "API answers 409 Conflict" '\b409\b|Conflict' api
expect_none "database exceptions stay inside Infrastructure (hexagonal)" '\b(DbUpdateException|PostgresException|NpgsqlException)\b|using\s+Npgsql' outside_infrastructure
finish
