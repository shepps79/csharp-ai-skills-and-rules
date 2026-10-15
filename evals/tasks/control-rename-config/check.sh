#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
renamed_in_config() { grep -q '"OrdersDb"' "$W/src/Orders.Api/appsettings.json" && ! grep -q '"Orders"\s*:' "$W/src/Orders.Api/appsettings.json"; }
renamed_in_code() { grep -q 'GetConnectionString("OrdersDb")' "$W/src/Orders.Api/Program.cs"; }
only_expected_files() { ! changed_files | grep -vP '^src/Orders\.Api/(appsettings[^/]*\.json|Program\.cs)$'; }
expect "appsettings.json uses OrdersDb" renamed_in_config
expect "Program.cs reads OrdersDb" renamed_in_code
expect "changes limited to appsettings*.json and Program.cs" only_expected_files
finish
