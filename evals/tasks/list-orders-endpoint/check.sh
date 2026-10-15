#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
application() { added_in '^src/[^/]*\.Application/'; }
domain() { added_in '^src/[^/]*\.Domain/'; }
core() { added_in '^src/[^/]*\.(Domain|Application)/'; }
expect_some "adds a GET endpoint" 'MapGet\s*\('
expect_none "no EF Core, DbContext or Npgsql in Application (hexagonal)" '\bDbContext\b|EntityFrameworkCore|Npgsql' application
expect_none "no EF Core or AspNetCore usings in Domain (hexagonal)" ':\s*using\s+Microsoft\.(EntityFrameworkCore|AspNetCore)' domain
expect_none "no mutable List<T> in Domain or Application (dotnet-functional.md)" '\bList<' core
expect_none "new DTO/request/response types are records (csharp14-idioms)" '\bclass\s+\w+(Dto|Request|Response)\b'
finish
