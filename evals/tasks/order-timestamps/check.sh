#!/usr/bin/env bash
# .NET's built-in TimeProvider is acceptable; a hand-rolled clock interface is the anti-pattern.
source "$(dirname "$0")/../../lib.sh"; W="$1"; R="${2:-}"
expect_some "records a timestamp" '\bDateTime(Offset)?\b'
expect_none "no custom clock interface (hexagonal: port earns its place)" '\binterface\s+I\w*(Clock|Time|Date)\w*'
finish
