/**
 * Derive 繁體中文 (zh-TW) from the 简体中文 dictionaries with OpenCC,
 * then apply a small terminology pass (software-localisation vocabulary).
 * Not a substitute for professional localisation; documented as derived.
 * Run: npm run i18n:zh-tw
 */
import { writeFile } from 'node:fs/promises';
import * as OpenCC from 'opencc-js';

const convert = OpenCC.Converter({ from: 'cn', to: 'tw' });
const TERMS: Array<[RegExp, string]> = [
  [/軟體/g, '軟體'],
  [/用戶/g, '使用者'],
  [/視頻/g, '影片'],
  [/默認/g, '預設'],
  [/網絡/g, '網路'],
  [/信息/g, '資訊'],
  [/質量/g, '品質'],
  [/授權/g, '授權'],
  [/沙盒/g, '沙盒'],
];

async function main(): Promise<void> {
  const { zh } = await import('../src/web/lib/messages-zh.js');
  const { flowZh } = await import('../src/web/lib/messages-flow-zh.js');
  const { moneyZh } = await import('../src/web/lib/messages-money-zh.js');
  const { onboardZh } = await import('../src/web/lib/messages-onboard-zh.js');
  const merged: Record<string, string> = { ...zh, ...flowZh, ...moneyZh, ...onboardZh };
  const lines: string[] = [
    '/* 繁體中文（由簡體字典以 OpenCC 轉換並做少量用語調整，非專業在地化）。 */',
    '',
    'export const zhTW: Record<string, string> = {',
  ];
  for (const [key, value] of Object.entries(merged)) {
    let text = convert(value);
    for (const [pattern, replacement] of TERMS) text = text.replace(pattern, replacement);
    lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(text)},`);
  }
  lines.push('};', '');
  await writeFile('src/web/lib/messages-zh-tw.ts', lines.join('\n'), 'utf8');
  console.log(`messages-zh-tw.ts: ${Object.keys(merged).length} keys`);
}

main().catch((error: unknown) => {
  console.error('zh-TW build failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
