#!/usr/bin/env bash
source "$(dirname "$0")/../../lib.sh"; W="$1"
expect_some "uses the field keyword in an accessor" '\bfield\s*=[^=>]|=>\s*field\b'
expect_none "no manual backing field" 'private\s+(readonly\s+)?string\??\s+_[a-zA-Z]'
finish
