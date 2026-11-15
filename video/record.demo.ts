// Records the walkthrough: replays saved responses from ../results on stage.html, timed to the narration.
import { test, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const root = path.resolve(__dirname, '..');
const outDir = path.join(__dirname, 'out');
const SPEED = '1.0';
const GAP = 550;
// FAST=1: no narration, one screenshot per step in out/frames, no video
const FAST = !!process.env.FAST;
const OLD = 'MCP 0.0.68';
const MCP = 'MCP 0.0.85';
const CLI = 'CLI 0.1.24';
const LOGIN = 'https://the-internet.herokuapp.com/login';

type Call = { arm: string; task: string; n: number; call: string; tokens: number };
const data: { calls: Call[]; fixed: { arm: string; tokens: number }[] } = JSON.parse(fs.readFileSync(path.join(root, 'results/calls.json'), 'utf8'));
const versions = JSON.parse(fs.readFileSync(path.join(root, 'results/bisect.json'), 'utf8')).map((v: any) => ({ version: v.version, inline: v.inlineSnapshot, find: v.find }));
const call = (arm: string, task: string, n: number) => data.calls.find((c) => c.arm === arm && c.task === task && c.n === n)!;
const tok = (arm: string, task: string, n: number) => call(arm, task, n).tokens;
const raw = (arm: string, task: string, n: number) =>
  fs.readFileSync(path.join(root, 'results/raw', arm, `${task}-${n}-${call(arm, task, n).call.split(' ')[0]}.txt`), 'utf8');
const total = (arm: string, task: string) => data.calls.filter((c) => c.arm === arm && c.task === task).reduce((a, c) => a + c.tokens, 0);
const fixed = (arm: string) => data.fixed.find((f) => f.arm === arm)!.tokens;
const ref = (text: string, pattern: string) => text.match(new RegExp(`${pattern} \\[ref=(\\w+)\\]`))![1];
const shot = (name: string) => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', `${name}.png`)).toString('base64');

function speech(text: string) {
  if (FAST) return { wav: '', seconds: 0.3 };
  const dir = path.join(outDir, 'tts');
  fs.mkdirSync(dir, { recursive: true });
  const wav = path.join(dir, crypto.createHash('sha1').update(SPEED + text).digest('hex').slice(0, 12) + '.wav');
  if (!fs.existsSync(wav)) execFileSync(path.join(os.homedir(), 'bin/tts'), ['-s', SPEED, '-o', wav, text]);
  const seconds = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }));
  return { wav, seconds };
}

type Stage = (fn: string, ...args: unknown[]) => Promise<void>;
type Step = { ch?: string; cap: string; say: string; act?: (S: Stage) => Promise<unknown> };

// One MCP tool call: the call line, then the saved response
const mcp = async (S: Stage, id: string, arm: string, task: string, n: number, args: string, ms?: number) => {
  await S('type', id, `${call(arm, task, n).call} ${args}`, true);
  await S('out', id, raw(arm, task, n), tok(arm, task, n), ms);
};
const cli = async (S: Stage, id: string, task: string, n: number, ms?: number) => {
  await S('type', id, `playwright-cli ${call(CLI, task, n).call}`);
  await S('out', id, raw(CLI, task, n), tok(CLI, task, n), ms);
};

const oldSnap = raw(OLD, 'login', 1);
const mcpSnap = raw(MCP, 'login', 2);
const mcpFind = raw(MCP, 'docs-find', 2);

const steps: Step[] = [
  {
    ch: 'The claim',
    cap: "Playwright's README: agents favour the CLI for tokens",
    say: "Playwright's own read me says coding agents favour the C L I over the M C P server, because the C L I is more token efficient.",
    act: (S) => S('card', '<blockquote>CLI invocations are more token-efficient: they avoid loading <mark id="q1">large tool schemas</mark> and <mark id="q2">verbose accessibility trees</mark> into the model context.</blockquote><div class="src">github.com/microsoft/playwright-mcp · README</div>'),
  },
  {
    cap: 'Two reasons: tool schemas and accessibility trees',
    say: "It gives two reasons. The C L I avoids loading large tool schemas, and it avoids verbose accessibility trees in the model's context.",
    act: async (S) => { await S('on', '#q1'); await new Promise((r) => setTimeout(r, 2600)); await S('on', '#q2'); },
  },
  { cap: 'I measured both on the current versions', say: 'I measured both, on the current versions, and one of the two reasons is gone.' },
  {
    cap: 'Same steps, same page content: within 25 tokens',
    say: 'For the same steps, M C P and the C L I returned the same page content, within twenty-five tokens of each other.',
    act: async (S) => { await S('clear'); await S('card', '<h1>MCP 0.0.85 <span class="m">vs</span> CLI 0.1.24</h1><h2 id="h"><span class="g">within 25 tokens</span> on 5 scripted tasks</h2>'); },
  },
  {
    cap: 'The saving: a command that both tools have',
    say: 'The saving that matters is a command that both tools have. In one task, it cut the tokens one hundred and twenty-eight times. Here is the data.',
    act: (S) => S('append', '.card', '<h2><span class="w">find</span>: 128x fewer tokens than a full snapshot</h2>'),
  },

  {
    ch: 'Snapshots and refs',
    cap: 'An agent reads a snapshot, not the page',
    say: 'First, two terms. An agent does not look at the page. It reads a snapshot: a text outline of the page, built from the accessibility tree.',
    act: async (S) => {
      await S('clear');
      await S('shot', shot('login'), LOGIN);
      await S('term', 'a', CLI, 'cli');
      await cli(S, 'a', 'login', 2, 2500);
    },
  },
  {
    cap: 'Every element has a ref, such as e17',
    say: 'Every element in the snapshot has a ref. The user name field here is e seventeen. The agent uses the ref to type or to click.',
    act: (S) => S('mark', 'a', 'textbox "Username"'),
  },
  {
    cap: `This small page: ${tok(CLI, 'login', 2)} tokens`,
    say: "This login page is small, and the response is four hundred and sixty-one tokens. All of it goes into the model's context.",
  },

  {
    ch: 'The setup',
    cap: '3 tools: MCP 0.0.68, MCP 0.0.85, CLI 0.1.24',
    say: 'I compared three tools. The M C P server at version zero point zero point sixty-eight, from February. I will call it version sixty-eight. The current M C P server, version eighty-five. And the current C L I, zero point one point twenty-four.',
    act: async (S) => {
      await S('clear');
      await S('card', '<h1>Three tools, the same steps</h1><div class="cols"><div class="col"><b class="m">MCP 0.0.68</b><span>@playwright/mcp<br>February 2026</span></div><div class="col"><b class="b">MCP 0.0.85</b><span>@playwright/mcp<br>November 2026</span></div><div class="col"><b class="g">CLI 0.1.24</b><span>@playwright/cli<br>November 2026</span></div></div><ul id="how"></ul>');
    },
  },
  {
    cap: 'A script makes the same fixed calls. No model.',
    say: 'A script drives each tool with the same fixed steps. There is no model in the loop, so every run makes the same calls.',
    act: (S) => S('append', '#how', '<li><b>&gt;</b>scripted calls, no model</li>'),
  },
  {
    cap: 'Counted: the tokens in every response',
    say: 'It saves every response and counts the tokens. I count only the responses, because they are what the tool adds to the context.',
    act: (S) => S('append', '#how', '<li><b>&gt;</b>tokens counted in every response</li>'),
  },
  {
    cap: '3 tasks: login, large table, docs',
    say: 'There are three tasks. Log in on a small page. Read one cell from a large table. And click through a page of the Playwright docs.',
    act: (S) => S('append', '#how', '<li><b>&gt;</b>login · large table · docs</li>'),
  },

  {
    ch: 'MCP 0.0.68',
    cap: 'MCP 0.0.68: browser_navigate',
    say: 'Start with version sixty-eight. I call browser navigate on the login page.',
    act: async (S) => {
      await S('clear');
      await S('shot', shot('login'), LOGIN);
      await S('term', 'a', OLD, 'old');
      await S('type', 'a', `browser_navigate { url: "${LOGIN}" }`, true);
    },
  },
  {
    cap: `The whole snapshot comes back: ${tok(OLD, 'login', 1)} tokens`,
    say: 'The response contains the whole snapshot. Six hundred and forty-nine tokens, whether the agent needs the page or not.',
    act: (S) => S('out', 'a', oldSnap, tok(OLD, 'login', 1), 3000),
  },
  {
    cap: `Click Login: page content again, ${tok(OLD, 'login', 4)} tokens`,
    say: 'Then I fill the two fields and click Login. The click response carries page content again. Six hundred and four tokens.',
    act: async (S) => {
      await mcp(S, 'a', OLD, 'login', 2, `{ ref: "${ref(oldSnap, 'textbox "Username"')}", text: "tomsmith" }`);
      await mcp(S, 'a', OLD, 'login', 3, `{ ref: "${ref(oldSnap, 'textbox "Password"')}", text: "SuperSecretPassword!" }`);
      await mcp(S, 'a', OLD, 'login', 4, `{ ref: "${ref(oldSnap, 'button "[^"]*Login"')}" }`, 2500);
    },
  },
  {
    cap: `Login on 0.0.68: ${total(OLD, 'login').toLocaleString('en-US')} tokens in 4 calls`,
    say: 'That is the behaviour behind the advice. On this version, navigating and clicking put the page into the context. The login task costs one thousand four hundred and seventeen tokens.',
  },

  {
    ch: 'MCP 0.0.85 and the CLI',
    cap: `MCP 0.0.85: a link to a file, ${tok(MCP, 'login', 1)} tokens`,
    say: 'Now the current M C P server, with the same call. There is no page in the response. There is a link to a snapshot file. One hundred and thirty-eight tokens.',
    act: async (S) => {
      await S('clear');
      await S('term', 'a', MCP, 'mcp');
      await S('term', 'b', CLI, 'cli');
      await mcp(S, 'a', MCP, 'login', 1, `{ url: "${LOGIN}" }`);
      await S('mark', 'a', '- [Snapshot]');
    },
  },
  {
    cap: `CLI 0.1.24: the same format, ${tok(CLI, 'login', 1)} tokens`,
    say: 'The C L I prints the same format: a link to a file. One hundred and thirty-seven tokens.',
    act: async (S) => { await cli(S, 'b', 'login', 1); await S('mark', 'b', '- [Snapshot]'); },
  },
  { cap: 'The page enters the context only on request', say: 'In both tools, the page enters the context only when the agent asks for a snapshot.' },
  {
    cap: 'Login needs two snapshots: find the fields, read the result',
    say: 'So for the login task, the agent takes two snapshots. One to find the fields, and one to read the result.',
    act: (S) => Promise.all([
      (async () => {
        await mcp(S, 'a', MCP, 'login', 2, '{}', 1800);
        await mcp(S, 'a', MCP, 'login', 3, `{ target: "${ref(mcpSnap, 'textbox "Username"')}", text: "tomsmith" }`);
        await mcp(S, 'a', MCP, 'login', 4, `{ target: "${ref(mcpSnap, 'textbox "Password"')}", text: "SuperSecretPassword!" }`);
        await mcp(S, 'a', MCP, 'login', 5, `{ target: "${ref(mcpSnap, 'button "[^"]*Login"')}" }`);
        await mcp(S, 'a', MCP, 'login', 6, '{}', 1800);
      })(),
      (async () => { for (const n of [2, 3, 4, 5, 6]) await cli(S, 'b', 'login', n, n === 2 || n === 6 ? 1800 : undefined); })(),
    ]),
  },
  {
    cap: `Login: ${total(MCP, 'login').toLocaleString('en-US')} tokens on MCP, ${total(CLI, 'login').toLocaleString('en-US')} on the CLI`,
    say: 'The current M C P server needs one thousand one hundred and sixty-eight tokens. The C L I needs one thousand one hundred and ninety-three. Twenty-five tokens apart.',
  },

  {
    ch: 'When it changed',
    cap: 'browser_navigate on 16 versions of the server',
    say: 'When did M C P change? I called browser navigate on sixteen versions of the server.',
    act: async (S) => { await S('clear'); await S('timeline', versions); },
  },
  {
    cap: 'Up to 0.0.68: the page. From 0.0.69: a file link.',
    say: 'Up to version sixty-eight, the page is in the response. From version sixty-nine, released on the thirtieth of March, it is a file link.',
    act: async (S) => { await S('timelineColor', 'page'); await new Promise((r) => setTimeout(r, 3200)); await S('timelineColor', 'link'); },
  },
  {
    cap: 'microsoft/playwright #39768, merged 19 March 2026',
    say: 'The timing matches a pull request in the Playwright repository, merged eleven days earlier. It says: snapshots go to files for non-explicit mode, inline for explicit.',
    act: (S) => S('append', '#tlnote', '<h2 style="margin-top:56px">microsoft/playwright #39768 <span class="m">· merged 2026-03-19</span></h2><p>"snapshots go to files for non-explicit mode, inline for explicit"</p>'),
  },
  {
    cap: 'The 0.0.69 release notes do not list it',
    say: 'The release notes for that version do not list the change. So a comparison made before April measured the old behaviour.',
  },

  {
    ch: 'The results',
    cap: 'Login: the old server costs the most',
    say: 'Here are the three tasks. On login, version sixty-eight costs the most, and the two current tools are level.',
    act: async (S) => {
      await S('clear');
      await S('chart', 'Tokens in the responses', 'lower is better · bars are scaled per task');
      await S('group', 'login');
      const max = total(OLD, 'login');
      await S('bar', OLD, total(OLD, 'login'), max, 'old');
      await S('bar', MCP, total(MCP, 'login'), max, 'mcp');
      await S('bar', CLI, total(CLI, 'login'), max, 'cli');
    },
  },
  {
    cap: 'Large table: one snapshot is about 43,000 tokens',
    say: 'The second task reads one cell from a table with fifty rows and fifty columns. A snapshot of that page is about forty-three thousand tokens. The current M C P server and the C L I are thirteen tokens apart.',
    act: async (S) => {
      await S('group', 'large table');
      const max = total(OLD, 'large-page');
      await S('bar', OLD, total(OLD, 'large-page'), max, 'old');
      await S('bar', MCP, total(MCP, 'large-page'), max, 'mcp');
      await S('bar', CLI, total(CLI, 'large-page'), max, 'cli');
    },
  },
  {
    cap: `${tok(MCP, 'large-page', 2).toLocaleString('en-US')} of ${total(MCP, 'large-page').toLocaleString('en-US')} tokens are one snapshot`,
    say: 'Almost all of that is one response. The snapshot is forty-three thousand three hundred and forty-eight of the forty-three thousand four hundred and forty-five tokens.',
  },
  {
    cap: 'Docs: the old server is cheaper',
    say: 'The docs task is the surprise. Version sixty-eight is cheaper: about fifteen thousand tokens, against about nineteen thousand.',
    act: async (S) => {
      await S('group', 'docs');
      const max = total(MCP, 'docs');
      await S('bar', OLD, total(OLD, 'docs'), max, 'old');
      await S('bar', MCP, total(MCP, 'docs'), max, 'mcp');
      await S('bar', CLI, total(CLI, 'docs'), max, 'cli');
    },
  },
  {
    cap: `0.0.68 returned only what changed: ${tok(OLD, 'docs', 2).toLocaleString('en-US')} tokens`,
    say: 'After the click, version sixty-eight returned only the part of the page that changed. About six thousand tokens. It had an incremental mode, and that was the default.',
    act: async (S) => {
      await S('clear');
      await S('chart', 'Docs: the response after the click', 'what the script reads to check the new heading');
      const max = tok(MCP, 'docs', 4);
      await S('bar', '0.0.68 · changed part', tok(OLD, 'docs', 2), max, 'old');
    },
  },
  {
    cap: `0.0.85: a second full snapshot, ${tok(MCP, 'docs', 4).toLocaleString('en-US')} tokens`,
    say: 'The current server has no incremental mode. To read the new heading, the script takes a second full snapshot. About ten thousand tokens.',
    act: (S) => S('bar', '0.0.85 · full snapshot', tok(MCP, 'docs', 4), tok(MCP, 'docs', 4), 'mcp'),
  },
  {
    cap: 'The cost depends on what the agent asks for',
    say: 'So the newer version is not cheaper on every task. The cost now depends on what the agent asks for after each action.',
  },

  {
    ch: 'find',
    cap: `A full snapshot of the table: ${tok(CLI, 'large-page', 2).toLocaleString('en-US')} tokens`,
    say: 'Which brings us to the real saving. This is the full snapshot of the large table on the C L I. Forty-three thousand three hundred and five tokens, to read one cell.',
    act: async (S) => {
      await S('clear');
      await S('shot', shot('large'), 'https://the-internet.herokuapp.com/large');
      await S('term', 'a', CLI, 'cli');
      await cli(S, 'a', 'large-page', 2, 8000);
    },
  },
  {
    cap: 'find returns only the matches',
    say: 'Both current tools have a find command. Find searches the snapshot for a text, and returns only the matching elements, with a few lines around them.',
    act: async (S) => { await S('wipe', 'a'); await cli(S, 'a', 'large-page-find', 2, 1500); },
  },
  {
    cap: `${tok(CLI, 'large-page-find', 2)} tokens, and the match keeps its ref`,
    say: 'Here is the cell. The response is two hundred and one tokens, and it keeps the ref, so the agent can act on the match without a snapshot.',
    act: (S) => S('mark', 'a', 'cell "50.50"'),
  },
  {
    cap: 'Large table on MCP: 43,445 tokens become 340',
    say: 'On the current M C P server, the whole task drops from forty-three thousand four hundred and forty-five tokens to three hundred and forty. That is one hundred and twenty-eight times fewer. On the C L I, it is three hundred and twenty-eight.',
    act: async (S) => {
      await S('clear');
      await S('chart', 'Read one cell of the large table', 'tokens in the responses for the whole task');
      const max = total(MCP, 'large-page');
      await S('bar', 'MCP 0.0.85 · snapshot', total(MCP, 'large-page'), max, 'mcp');
      await S('bar', 'MCP 0.0.85 · find', total(MCP, 'large-page-find'), max, 'find', '128x');
      await S('bar', 'CLI 0.1.24 · find', total(CLI, 'large-page-find'), max, 'find');
    },
  },
  {
    cap: 'Docs: find the link, click its ref, find the heading',
    say: 'The docs task works the same way. Find returns the ref of the link. I click it. Then find again reads the new heading.',
    act: async (S) => {
      await S('clear');
      await S('shot', shot('docs'), 'https://playwright.dev/docs/intro');
      await S('term', 'a', MCP, 'mcp');
      await mcp(S, 'a', MCP, 'docs-find', 1, '{ url: "https://playwright.dev/docs/intro" }');
      await mcp(S, 'a', MCP, 'docs-find', 2, '{ text: "Writing tests" }', 1800);
      await mcp(S, 'a', MCP, 'docs-find', 3, `{ target: "${ref(mcpFind, 'link "Next Writing tests »"')}" }`);
      await mcp(S, 'a', MCP, 'docs-find', 4, '{ text: "Writing tests" }', 1800);
    },
  },
  {
    cap: 'Docs on MCP: 19,178 tokens become 1,020',
    say: 'Nineteen thousand one hundred and seventy-eight tokens become one thousand and twenty. Nineteen times fewer.',
    act: async (S) => {
      await S('clear');
      await S('chart', 'Click through the docs page', 'tokens in the responses for the whole task');
      const max = total(MCP, 'docs');
      await S('bar', 'MCP 0.0.85 · snapshots', total(MCP, 'docs'), max, 'mcp');
      await S('bar', 'MCP 0.0.85 · find', total(MCP, 'docs-find'), max, 'find', '19x');
      await S('bar', 'CLI 0.1.24 · find', total(CLI, 'docs-find'), max, 'find');
    },
  },
  {
    cap: 'Caveats: find needs a text, and the table is a worst case',
    say: 'Two caveats. Find needs a text to search for, and my script knew that text. And a table with two thousand five hundred cells is close to the worst case for a snapshot.',
  },
  {
    cap: 'browser_find: in @playwright/mcp from 0.0.78',
    say: 'In the M C P server, the tool is called browser find. It arrived in version seventy-eight, in July.',
    act: async (S) => { await S('clear'); await S('card', '<h1><span class="w">browser_find</span></h1><h2>@playwright/mcp 0.0.78 <span class="m">· 2026-07-09</span></h2><p class="mono">playwright-cli find "text"</p>'); },
  },

  {
    ch: 'The fixed cost',
    cap: 'The other reason: tool schemas',
    say: 'Now the first reason in the read me: tool schemas. This one still holds.',
    act: async (S) => { await S('clear'); await S('chart', 'What is loaded before any step', 'tokens · not like for like'); },
  },
  {
    cap: `MCP 0.0.85: 25 tool definitions, ${fixed(MCP).toLocaleString('en-US')} tokens`,
    say: 'The current M C P server describes twenty-five tools. In the format the server returns, that is four thousand five hundred and sixty-eight tokens, and a client normally sends it with every request.',
    act: (S) => S('bar', 'MCP 0.0.85 · 25 tools', fixed(MCP), fixed(MCP), 'mcp'),
  },
  {
    cap: '49% more than 0.0.68',
    say: 'That is forty-nine percent more than version sixty-eight.',
    act: (S) => S('bar', 'MCP 0.0.68 · 22 tools', fixed(OLD), fixed(MCP), 'old'),
  },
  {
    cap: `CLI: a skill file of ${fixed(CLI).toLocaleString('en-US')} tokens, read on use`,
    say: 'The C L I ships a skill file of three thousand seven hundred and sixty tokens. The agent reads it only when it uses the skill.',
    act: (S) => S('bar', 'CLI 0.1.24 · SKILL.md', fixed(CLI), fixed(MCP), 'cli'),
  },
  {
    cap: 'Not like for like, but the difference that remains',
    say: 'These are not like for like, and some clients load tool definitions only when they are needed. But this is the difference that remains in my data.',
  },

  {
    ch: 'Try it',
    cap: 'Install the CLI and its skills',
    say: 'To see this on your own machine, install the C L I, and add its skills to your project.',
    act: async (S) => {
      await S('clear');
      await S('term', 'a', 'your terminal', 'cli', 'big');
      await S('type', 'a', 'npm install -g @playwright/cli@latest');
      await S('type', 'a', 'playwright-cli install --skills');
    },
  },
  {
    cap: 'Compare snapshot with find on the same page',
    say: 'Open a page, take a snapshot, and then run find on the same page. Compare the size of the two responses.',
    act: async (S) => {
      await S('type', 'a', 'playwright-cli open https://playwright.dev/docs/intro');
      await S('type', 'a', 'playwright-cli snapshot');
      await S('type', 'a', 'playwright-cli find "Writing tests"');
    },
  },
  {
    cap: 'MCP: check the version your client starts',
    say: 'For M C P, check which version your client starts. If your configuration pins an old version, update it.',
    act: (S) => S('type', 'a', 'npx @playwright/mcp@latest --version'),
  },
  {
    cap: 'Repeat the numbers: one command',
    say: 'To repeat my numbers, clone the repository and run one command.',
    act: async (S) => {
      await S('type', 'a', 'git clone https://github.com/qa-gary-parker/poc-playwright-mcp-vs-cli');
      await S('type', 'a', 'npm install && npm run experiment');
    },
  },

  {
    ch: 'What to do',
    cap: "1. Don't choose on the token cost of a step",
    say: 'What would I do with this? One. Do not pick the C L I over M C P for the token cost of a step. In these tasks, the responses cost the same.',
    act: async (S) => { await S('clear'); await S('card', '<h1>What I would do</h1><ul id="todo"><li><b>1</b>Do not choose on the token cost of a step<span>MCP 0.0.85 and CLI 0.1.24: within 25 tokens</span></li></ul>'); },
  },
  {
    cap: '2. Check your MCP version',
    say: 'Two. Check your M C P version. On version sixty-eight, navigating and clicking put page content into the context.',
    act: (S) => S('append', '#todo', '<li><b>2</b>Check your @playwright/mcp version<span>the navigate response links a file from 0.0.69</span></li>'),
  },
  {
    cap: '3. find first, snapshot only when needed',
    say: 'Three. Tell your agent to try find first, and to take a full snapshot only when find is not enough.',
    act: (S) => S('append', '#todo', '<li><b>3</b>Tell the agent: find first, snapshot when find is not enough<span>128x and 19x fewer tokens in two tasks</span></li>'),
  },
  {
    cap: '4. Count the snapshot calls',
    say: 'Four. Count the snapshot calls in a session. In these tasks, that is where the tokens went.',
    act: (S) => S('append', '#todo', '<li><b>4</b>Count the snapshot calls in a session<span>43,348 of 43,445 tokens were one snapshot</span></li>'),
  },
  {
    cap: "Limits: scripted calls, 3 tasks, not Claude's tokenizer",
    say: 'The limits. The calls are scripted, and a real agent chooses its own calls. The tokenizer is not the tokenizer of any Claude model, so compare the columns, not the absolute numbers. And it is three tasks on two public sites.',
    act: async (S) => { await S('clear'); await S('card', '<h1>Limits</h1><ul><li><b>-</b>scripted calls: an agent chooses its own</li><li><b>-</b>o200k_base tokens: compare the columns</li><li><b>-</b>3 tasks, 2 public sites, 1 version of the CLI</li></ul>'); },
  },
];

const END_SECONDS = 10;
const END_SAY = 'The scripts, every response, and the write-up are linked in the description.';

test('record the walkthrough', async ({ browser }, testInfo) => {
  const lines = [...steps.map((s) => s.say), END_SAY].map(speech);
  const viewport = testInfo.project.use.viewport!;
  const context = await browser.newContext({ viewport, recordVideo: { dir: testInfo.outputDir, size: viewport } });
  const page: Page = await context.newPage();
  await page.goto('file://' + path.join(__dirname, 'stage.html'));
  await page.evaluate(() => document.fonts.ready);
  const S: Stage = (fn, ...args) => page.evaluate(([f, a]) => (window as any).S[f as string](...(a as unknown[])), [fn, args] as const);

  const start = Date.now();
  const at = () => (Date.now() - start) / 1000;
  const cues: { at: number; wav: string; say: string }[] = [];
  const chapters: string[] = [];
  let chapter = 0;
  await page.waitForTimeout(400);
  for (const [i, step] of steps.entries()) {
    if (step.ch) {
      await S('chapter', ++chapter, step.ch);
      const t = Math.floor(at());
      chapters.push(`${chapter === 1 ? '0:00' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`} ${step.ch}`);
    }
    const began = Date.now();
    cues.push({ at: at(), wav: lines[i].wav, say: step.say });
    await S('caption', step.cap);
    await step.act?.(S);
    await page.waitForTimeout(Math.max(0, lines[i].seconds * 1000 + GAP - (Date.now() - began)));
    if (FAST) await page.screenshot({ path: path.join(outDir, 'frames', `${String(i + 1).padStart(2, '0')}.png`) });
  }
  await S('end', [
    ['write-up', 'garyparker.dev/blog/\nplaywright-mcp-vs-cli-tokens'],
    ['source', 'github.com/qa-gary-parker/\npoc-playwright-mcp-vs-cli'],
    ['try it', 'playwright-cli find "text"'],
  ], 'MCP 0.0.85 vs CLI 0.1.24: 25 tokens apart · find: 128x fewer');
  cues.push({ at: at(), wav: lines[steps.length].wav, say: END_SAY });
  if (FAST) {
    await page.screenshot({ path: path.join(outDir, 'frames', 'end.png') });
    await context.close();
    return;
  }
  await page.waitForTimeout(END_SECONDS * 1000);
  const length = at();

  const video = page.video()!;
  await context.close();
  const webm = path.join(outDir, 'walkthrough.webm');
  await video.saveAs(webm);
  fs.writeFileSync(path.join(outDir, 'chapters.txt'), chapters.join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'narration.tsv'), cues.map((c) => `${c.at.toFixed(2)}\t${c.say}`).join('\n') + '\n');

  const inputs = cues.flatMap((c) => ['-i', c.wav]);
  const delays = cues.map((c, i) => `[${i + 1}:a]adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`).join(';');
  const mix = cues.map((_, i) => `[a${i}]`).join('');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', webm, ...inputs,
    '-filter_complex', `${delays};${mix}amix=inputs=${cues.length}:normalize=0:duration=longest,apad,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`,
    '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-t', length.toFixed(3), '-movflags', '+faststart', path.join(outDir, 'walkthrough.mp4')]);
  console.log(`walkthrough.mp4 ${length.toFixed(1)} s, ${cues.length} lines, ${lines.reduce((a, l) => a + l.seconds, 0).toFixed(1)} s of speech`);
  console.log(chapters.join('\n'));
});
