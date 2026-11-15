// Which @playwright/mcp versions inline the page snapshot in a browser_navigate result?
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const versions = process.argv.slice(2);
const rows = [];
for (const version of versions) {
  // cwd outside the repo: the local node_modules/.bin/playwright-mcp would shadow the requested version
  const transport = new StdioClientTransport({ command: 'npx', args: ['-y', `@playwright/mcp@${version}`, '--headless', '--isolated'], cwd: tmpdir(), stderr: 'ignore' });
  const client = new Client({ name: 'bisect', version: '0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const r = await client.callTool({ name: 'browser_navigate', arguments: { url: 'https://the-internet.herokuapp.com/login' } });
    const text = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    rows.push({ version, tools: tools.length, toolChars: JSON.stringify(tools).length, navigateChars: text.length, find: tools.some((t) => t.name === 'browser_find'), inlineSnapshot: /```yaml/.test(text), fileLink: /\[Snapshot\]\(/.test(text) });
  } catch (e) {
    rows.push({ version, error: String(e.message).slice(0, 120) });
  }
  await client.close().catch(() => {});
  console.log(JSON.stringify(rows.at(-1)));
}
writeFileSync('results/bisect.json', JSON.stringify(rows, null, 2) + '\n');
