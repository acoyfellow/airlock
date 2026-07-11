# Oracle review — `ter_20260711175623049_l2g97u`

Status: verified task contract; must-fixes integrated.

The reviewer confirmed mutations 25 through 29 and the promotion-effect API, then
constructed two bypasses:

- `sha256:not-a-digest` passed because only the prefix was checked;
- an empty preview deployment version passed because only its type was checked.

The oracle now requires a complete lowercase SHA-256 digest and non-empty preview URL
and version. These bypasses are permanent mutations 30 and 31.

Usage: 470,835 tokens, $0.466723875; provider/model identity confirmed as
`opencode.cloudflare.dev/gpt-5.6-terra`.
