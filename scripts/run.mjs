// Same two browser tasks through three arms; records every response the model would receive.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { countTokens } from 'gpt-tokenizer';

const BASE = 'https://the-internet.herokuapp.com';
const DOCS = 'https://playwright.dev/docs/intro';
const LINK = 'link "Next Writing tests »"';
const HEADING = 'heading "Writing tests" [level=1]';
const ref = (snapshot, pattern) => {
  const m = snapshot.match(new RegExp(`${pattern} \\[ref=(\\w+)\\]`));
  if (!m) throw new Error(`no ref for ${pattern}`);
  return m[1];
};
const measure = (text) => ({ chars: text.length, tokens: countTokens(text) });

const rows = [];
const record = (arm, task, n, call, text) => {
  mkdirSync(`results/raw/${arm}`, { recursive: true });
  writeFileSync(`results/raw/${arm}/${task}-${n}-${call.split(' ')[0]}.txt`, text);
  rows.push({ arm, task, n, call, ...measure(text) });
  return text;
};

async function mcpArm(arm, bin) {
  const transport = new StdioClientTransport({ command: 'node', args: [bin, '--headless', '--isolated', '--viewport-size', '1280x720', '--output-dir', `results/raw/${arm}/files`], stderr: 'ignore' });
  const client = new Client({ name: 'experiment', version: '0' });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const fixed = JSON.stringify(tools);
  mkdirSync(`results/raw/${arm}`, { recursive: true });
  writeFileSync(`results/raw/${arm}/tools.json`, JSON.stringify(tools, null, 2));
  const names = tools.map((t) => t.name);
  const targetKey = tools.find((t) => t.name === 'browser_type').inputSchema.properties.target ? 'target' : 'ref';
  let n = 0;
  let task = '';
  const call = async (name, args, label) => {
    const r = await client.callTool({ name, arguments: args });
    return record(arm, task, ++n, label ?? name, r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n'));
  };
  const inline = (text) => /```yaml/.test(text);

  task = 'login'; n = 0;
  let out = await call('browser_navigate', { url: `${BASE}/login` });
  if (!inline(out)) out = await call('browser_snapshot', {});
  await call('browser_type', { element: 'Username', [targetKey]: ref(out, 'textbox "Username"'), text: 'tomsmith' });
  await call('browser_type', { element: 'Password', [targetKey]: ref(out, 'textbox "Password"'), text: 'SuperSecretPassword!' });
  let done = await call('browser_click', { element: 'Login', [targetKey]: ref(out, 'button "[^"]*Login"') });
  if (!inline(done)) done = await call('browser_snapshot', {});
  if (!done.includes('You logged into a secure area!')) throw new Error(`${arm}: login not verified`);

  task = 'large-page'; n = 0;
  out = await call('browser_navigate', { url: `${BASE}/large` });
  if (!inline(out)) out = await call('browser_snapshot', {});
  if (!out.includes('50.50')) throw new Error(`${arm}: large page not verified`);

  task = 'docs'; n = 0;
  out = await call('browser_navigate', { url: DOCS });
  if (!inline(out)) out = await call('browser_snapshot', {});
  done = await call('browser_click', { element: 'Writing tests', [targetKey]: ref(out, LINK) });
  if (!inline(done)) done = await call('browser_snapshot', {});
  if (!done.includes(HEADING)) throw new Error(`${arm}: docs not verified`);

  if (names.includes('browser_find')) {
    task = 'large-page-find'; n = 0;
    await call('browser_navigate', { url: `${BASE}/large` });
    out = await call('browser_find', { text: '50.50' });
    if (!out.includes('50.50')) throw new Error(`${arm}: find not verified`);

    task = 'docs-find'; n = 0;
    await call('browser_navigate', { url: DOCS });
    out = await call('browser_find', { text: 'Writing tests' });
    await call('browser_click', { element: 'Writing tests', [targetKey]: ref(out, LINK) });
    done = await call('browser_find', { text: 'Writing tests' });
    if (!done.includes(HEADING)) throw new Error(`${arm}: docs find not verified`);
  }
  await client.close();
  return { arm, what: `${tools.length} tool definitions (tools/list JSON)`, ...measure(fixed) };
}

function cliArm(arm) {
  const cli = (...args) => execFileSync('node_modules/.bin/playwright-cli', ['-s=experiment', ...args], { encoding: 'utf8' });
  let n = 0;
  let task = '';
  const call = (...args) => record(arm, task, ++n, args.join(' '), cli(...args));

  task = 'login'; n = 0;
  call('open', `${BASE}/login`);
  let out = call('snapshot');
  call('fill', ref(out, 'textbox "Username"'), 'tomsmith');
  call('fill', ref(out, 'textbox "Password"'), 'SuperSecretPassword!');
  call('click', ref(out, 'button "[^"]*Login"'));
  if (!call('snapshot').includes('You logged into a secure area!')) throw new Error(`${arm}: login not verified`);

  task = 'large-page'; n = 0;
  call('goto', `${BASE}/large`);
  if (!call('snapshot').includes('50.50')) throw new Error(`${arm}: large page not verified`);

  task = 'docs'; n = 0;
  call('goto', DOCS);
  out = call('snapshot');
  call('click', ref(out, LINK));
  if (!call('snapshot').includes(HEADING)) throw new Error(`${arm}: docs not verified`);

  task = 'large-page-find'; n = 0;
  call('goto', `${BASE}/large`);
  if (!call('find', '50.50').includes('50.50')) throw new Error(`${arm}: find not verified`);

  task = 'docs-find'; n = 0;
  call('goto', DOCS);
  out = call('find', 'Writing tests');
  call('click', ref(out, LINK));
  if (!call('find', 'Writing tests').includes(HEADING)) throw new Error(`${arm}: docs find not verified`);
  cli('close');
  const skill = readFileSync('node_modules/playwright-core/lib/tools/skills/playwright-cli/SKILL.md', 'utf8');
  return { arm, what: 'SKILL.md shipped with the CLI', ...measure(skill) };
}

rmSync('results/raw', { recursive: true, force: true });
rmSync('.playwright-cli', { recursive: true, force: true });
const version = (p) => JSON.parse(readFileSync(`node_modules/${p}/package.json`, 'utf8')).version;
const arms = {
  mcpOld: `MCP ${version('mcp-inline')}`,
  mcpNew: `MCP ${version('@playwright/mcp')}`,
  cli: `CLI ${version('@playwright/cli')}`,
};
const fixed = [
  await mcpArm(arms.mcpOld, 'node_modules/mcp-inline/cli.js'),
  await mcpArm(arms.mcpNew, 'node_modules/@playwright/mcp/cli.js'),
  cliArm(arms.cli),
];
writeFileSync('results/calls.json', JSON.stringify({ fixed, calls: rows }, null, 2) + '\n');

const tasks = [...new Set(rows.map((r) => r.task))];
const sum = (arm, task, key) => rows.filter((r) => r.arm === arm && r.task === task).reduce((a, r) => a + r[key], 0);
const count = (arm, task) => rows.filter((r) => r.arm === arm && r.task === task).length;
const md = [
  '# Results',
  '',
  'Tokens: `gpt-tokenizer` (o200k_base). Responses only; the text of the calls is not counted.',
  '',
  '## Fixed cost',
  '',
  '| arm | what | chars | tokens |',
  '|---|---|---|---|',
  ...fixed.map((f) => `| ${f.arm} | ${f.what} | ${f.chars} | ${f.tokens} |`),
  '',
  '## Per task (calls / chars / tokens)',
  '',
  `| task | ${Object.values(arms).join(' | ')} |`,
  `|---|${Object.values(arms).map(() => '---').join('|')}|`,
  ...tasks.map((t) => `| ${t} | ${Object.values(arms).map((a) => (count(a, t) ? `${count(a, t)} / ${sum(a, t, 'chars')} / ${sum(a, t, 'tokens')}` : 'n/a')).join(' | ')} |`),
  '',
  '## Every call',
  '',
  '| arm | task | # | call | chars | tokens |',
  '|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.arm} | ${r.task} | ${r.n} | \`${r.call}\` | ${r.chars} | ${r.tokens} |`),
  '',
];
writeFileSync('results/summary.md', md.join('\n'));
console.log(md.slice(0, 16 + tasks.length).join('\n'));
