# poc-playwright-mcp-vs-cli

**The question:** does the Playwright CLI still put fewer tokens into an agent's context than the Playwright MCP server?

**The answer:** not in the responses of these tasks. MCP 0.0.85 and CLI 0.1.24 return the same response format: an action returns a link to a snapshot file, and only an explicit snapshot puts the page into the response. On 5 scripted tasks they were within 25 tokens of each other. MCP stopped putting the page into its `browser_navigate` response in 0.0.69. In two of the tasks, `find` in place of a full snapshot cut the tokens 19 times (a docs page) and 128 times (a large table). MCP 0.0.85 also comes with 4,568 tokens of tool definitions.

> Exploratory PoC, throwaway by default. Written up in
> [Playwright MCP vs CLI: Token Cost per Step Is Now the Same](https://garyparker.dev/blog/playwright-mcp-vs-cli-tokens).
> Eight-minute video: [youtu.be/f1L351xCbJ4](https://youtu.be/f1L351xCbJ4).

## Method

- `@playwright/mcp` 0.0.68 (the last tested version with the page in the `browser_navigate` response), `@playwright/mcp` 0.0.85, `@playwright/cli` 0.1.24. Node 24, macOS, headless, each tool's default browser. Viewport 1280x720: the CLI default (checked with `eval`), set with `--viewport-size` for MCP.
- `scripts/run.mjs` drives each tool with fixed calls. No model is involved. It saves every response in `results/raw/` and counts its characters and tokens.
- Tokens: `gpt-tokenizer` (o200k_base). Only responses are counted, not the text of the calls. An MCP call carries an `element` description that a CLI command does not.
- Each arm gets the page content it needs to do the task. MCP 0.0.68 returns the snapshot with `browser_navigate` and `browser_click`. MCP 0.0.85 and the CLI return a file link, so the script asks for a snapshot (or uses `find`) before it acts and before it checks the result.
- The script fails if a task's result is not in the last response.

| task | steps |
|---|---|
| login | open the-internet.herokuapp.com/login, fill 2 fields, click Login, read the success message |
| large-page | open the-internet.herokuapp.com/large, read cell 50.50 |
| docs | open playwright.dev/docs/intro, click "Next: Writing tests", read the heading |
| large-page-find, docs-find | the same two tasks with `find` in place of the full snapshot |

- `scripts/bisect.mjs` calls `browser_navigate` on 16 versions of `@playwright/mcp` and records whether the response holds the snapshot. Output: `results/bisect.json`.

## Results

Tokens in the responses, with the number of calls in brackets. Every call is in `results/summary.md`.

| task | MCP 0.0.68 | MCP 0.0.85 | CLI 0.1.24 |
|---|---|---|---|
| login | 1,417 (4) | 1,168 (6) | 1,193 (6) |
| large-page | 48,214 (1) | 43,445 (2) | 43,432 (2) |
| docs | 15,197 (2) | 19,178 (4) | 19,166 (4) |
| large-page-find | no `find` | 340 (2) | 328 (2) |
| docs-find | no `find` | 1,020 (4) | 1,006 (4) |

- MCP 0.0.85 and CLI 0.1.24 differ by 25 tokens at most (login).
- MCP 0.0.68 against 0.0.85: login 18% fewer tokens on 0.0.85, large-page 10% fewer, docs 26% more. On docs, 0.0.68 returns only the changed part of the page after the click (6,175 tokens, incremental mode, its default). 0.0.85 has no incremental mode, so the script takes a second full snapshot (10,411 tokens).
- The snapshot text also differs between the versions: the 0.0.78 release notes say snapshots are "distilled to reduce noise and token usage".
- `find` against a full snapshot on MCP 0.0.85: 43,445 to 340 tokens on the large page, 19,178 to 1,020 on the docs task. `find` needs a text to search for, and the script knew it.

Fixed cost:

| | what | tokens |
|---|---|---|
| MCP 0.0.68 | 22 tool definitions (`tools/list` JSON) | 3,071 |
| MCP 0.0.85 | 25 tool definitions (`tools/list` JSON) | 4,568 |
| CLI 0.1.24 | the `SKILL.md` it ships | 3,760 |

Versions (`results/bisect.json`):

| `@playwright/mcp` versions tested | snapshot in the `browser_navigate` response | `browser_find` |
|---|---|---|
| 0.0.41, 0.0.56, 0.0.64, 0.0.67, 0.0.68 (2026-02-14) | yes | no |
| 0.0.69 (2026-03-30), 0.0.70, 0.0.76, 0.0.77 (2026-06-29) | no, file link | no |
| 0.0.78 (2026-07-09), 0.0.79, 0.0.80, 0.0.81, 0.0.83, 0.0.84, 0.0.85 (2026-11-09) | no, file link | yes |

The change matches [microsoft/playwright#39768](https://github.com/microsoft/playwright/pull/39768), merged 2026-03-19. It removes the `--output-mode` option. The 0.0.69 release notes do not list it. Commits were not bisected.

## Limits

- The calls are scripted. An agent chooses its own calls, and can take more snapshots or fewer than the script.
- The tokenizer is o200k_base, not the tokenizer of any Claude model. Compare the columns, not the absolute numbers.
- Tool definitions and `SKILL.md` are not like for like. A client normally sends tool definitions with every request. An agent reads `SKILL.md` when it uses the skill.
- Three tasks on two public sites, and one version of the CLI. I ran the script twice. The MCP 0.0.85 and CLI numbers were the same in both runs; three MCP 0.0.68 responses changed by 4 to 6%.
- MCP 0.0.68 ran with its defaults (`--snapshot-mode incremental`, `--output-mode stdout`). It also has `--output-mode file`; I did not run it.
- playwright.dev can change, so the docs numbers are for 2026-11-15.

## Reproduce

```bash
npm install
npm run experiment
npm run bisect -- 0.0.68 0.0.69 0.0.77 0.0.78 0.0.85
```

The video is recorded from `video/`: `npm install && npm run record` there replays the saved responses on `stage.html` and adds the narration (needs a local `~/bin/tts`).

MIT. Independent experiment; no affiliation with the Playwright team.
