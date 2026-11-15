# Results

Tokens: `gpt-tokenizer` (o200k_base). Responses only; the text of the calls is not counted.

## Fixed cost

| arm | what | chars | tokens |
|---|---|---|---|
| MCP 0.0.68 | 22 tool definitions (tools/list JSON) | 14080 | 3071 |
| MCP 0.0.85 | 25 tool definitions (tools/list JSON) | 21177 | 4568 |
| CLI 0.1.24 | SKILL.md shipped with the CLI | 15696 | 3760 |

## Per task (calls / chars / tokens)

| task | MCP 0.0.68 | MCP 0.0.85 | CLI 0.1.24 |
|---|---|---|---|
| login | 4 / 4587 / 1417 | 6 / 3710 / 1168 | 6 / 3802 / 1193 |
| large-page | 1 / 148502 / 48214 | 2 / 139403 / 43445 | 2 / 139379 / 43432 |
| docs | 2 / 63025 / 15197 | 4 / 73459 / 19178 | 4 / 73437 / 19166 |
| large-page-find | n/a | 2 / 1028 / 340 | 2 / 1004 / 328 |
| docs-find | n/a | 4 / 3520 / 1020 | 4 / 3498 / 1006 |

## Every call

| arm | task | # | call | chars | tokens |
|---|---|---|---|---|---|
| MCP 0.0.68 | login | 1 | `browser_navigate` | 2201 | 649 |
| MCP 0.0.68 | login | 2 | `browser_type` | 438 | 133 |
| MCP 0.0.68 | login | 3 | `browser_type` | 117 | 31 |
| MCP 0.0.68 | login | 4 | `browser_click` | 1831 | 604 |
| MCP 0.0.68 | large-page | 1 | `browser_navigate` | 148502 | 48214 |
| MCP 0.0.68 | docs | 1 | `browser_navigate` | 37498 | 9022 |
| MCP 0.0.68 | docs | 2 | `browser_click` | 25527 | 6175 |
| MCP 0.0.85 | login | 1 | `browser_navigate` | 411 | 138 |
| MCP 0.0.85 | login | 2 | `browser_snapshot` | 1452 | 425 |
| MCP 0.0.85 | login | 3 | `browser_type` | 105 | 30 |
| MCP 0.0.85 | login | 4 | `browser_type` | 117 | 31 |
| MCP 0.0.85 | login | 5 | `browser_click` | 412 | 145 |
| MCP 0.0.85 | login | 6 | `browser_snapshot` | 1213 | 399 |
| MCP 0.0.85 | large-page | 1 | `browser_navigate` | 305 | 97 |
| MCP 0.0.85 | large-page | 2 | `browser_snapshot` | 139098 | 43348 |
| MCP 0.0.85 | docs | 1 | `browser_navigate` | 272 | 86 |
| MCP 0.0.85 | docs | 2 | `browser_snapshot` | 32549 | 8586 |
| MCP 0.0.85 | docs | 3 | `browser_click` | 299 | 95 |
| MCP 0.0.85 | docs | 4 | `browser_snapshot` | 40339 | 10411 |
| MCP 0.0.85 | large-page-find | 1 | `browser_navigate` | 411 | 140 |
| MCP 0.0.85 | large-page-find | 2 | `browser_find` | 617 | 200 |
| MCP 0.0.85 | docs-find | 1 | `browser_navigate` | 272 | 86 |
| MCP 0.0.85 | docs-find | 2 | `browser_find` | 1546 | 440 |
| MCP 0.0.85 | docs-find | 3 | `browser_click` | 299 | 95 |
| MCP 0.0.85 | docs-find | 4 | `browser_find` | 1403 | 399 |
| CLI 0.1.24 | login | 1 | `open https://the-internet.herokuapp.com/login` | 434 | 137 |
| CLI 0.1.24 | login | 2 | `snapshot` | 1543 | 461 |
| CLI 0.1.24 | login | 3 | `fill e17 tomsmith` | 106 | 31 |
| CLI 0.1.24 | login | 4 | `fill e21 SuperSecretPassword!` | 118 | 32 |
| CLI 0.1.24 | login | 5 | `click e22` | 387 | 132 |
| CLI 0.1.24 | login | 6 | `snapshot` | 1214 | 400 |
| CLI 0.1.24 | large-page | 1 | `goto https://the-internet.herokuapp.com/large` | 386 | 127 |
| CLI 0.1.24 | large-page | 2 | `snapshot` | 138993 | 43305 |
| CLI 0.1.24 | docs | 1 | `goto https://playwright.dev/docs/intro` | 260 | 79 |
| CLI 0.1.24 | docs | 2 | `snapshot` | 32550 | 8587 |
| CLI 0.1.24 | docs | 3 | `click f3e458` | 287 | 88 |
| CLI 0.1.24 | docs | 4 | `snapshot` | 40340 | 10412 |
| CLI 0.1.24 | large-page-find | 1 | `goto https://the-internet.herokuapp.com/large` | 386 | 127 |
| CLI 0.1.24 | large-page-find | 2 | `find 50.50` | 618 | 201 |
| CLI 0.1.24 | docs-find | 1 | `goto https://playwright.dev/docs/intro` | 260 | 79 |
| CLI 0.1.24 | docs-find | 2 | `find Writing tests` | 1547 | 440 |
| CLI 0.1.24 | docs-find | 3 | `click f5e510` | 287 | 88 |
| CLI 0.1.24 | docs-find | 4 | `find Writing tests` | 1404 | 399 |
