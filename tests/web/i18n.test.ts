import { describe, expect, it } from 'vitest';
import { en } from '../../src/web/lib/messages-en.js';
import { flowEn } from '../../src/web/lib/messages-flow-en.js';
import { moneyEn } from '../../src/web/lib/messages-money-en.js';
import { onboardEn } from '../../src/web/lib/messages-onboard-en.js';
import { es } from '../../src/web/lib/messages-es.js';
import { fr } from '../../src/web/lib/messages-fr.js';
import { de } from '../../src/web/lib/messages-de.js';
import { ja } from '../../src/web/lib/messages-ja.js';
import { ko } from '../../src/web/lib/messages-ko.js';
import { zh } from '../../src/web/lib/messages-zh.js';
import { flowZh } from '../../src/web/lib/messages-flow-zh.js';
import { moneyZh } from '../../src/web/lib/messages-money-zh.js';
import { onboardZh } from '../../src/web/lib/messages-onboard-zh.js';
import { zhTW } from '../../src/web/lib/messages-zh-tw.js';

const english = { ...en, ...flowEn, ...moneyEn, ...onboardEn };

const dictionaries: Array<[string, Record<string, string>]> = [
  ['zh (Simplified Chinese)', { ...zh, ...flowZh, ...moneyZh, ...onboardZh }],
  ['zh-TW (Traditional Chinese)', zhTW],
  ['es (Spanish)', es],
  ['fr (French)', fr],
  ['de (German)', de],
  ['ja (Japanese)', ja],
  ['ko (Korean)', ko],
];

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe('i18n dictionaries', () => {
  it('English has a stable, non-trivial surface', () => {
    expect(Object.keys(english).length).toBeGreaterThan(700);
  });

  for (const [label, dictionary] of dictionaries) {
    describe(label, () => {
      it('has exactly the same keys as English', () => {
        const keys = Object.keys(dictionary).sort();
        const englishKeys = Object.keys(english).sort();
        expect(keys).toEqual(englishKeys);
      });

      it('keeps every placeholder intact', () => {
        for (const key of Object.keys(english)) {
          expect(placeholders(dictionary[key] ?? ''), key).toEqual(placeholders(english[key]!));
        }
      });

      it('does not leave a non-empty English string empty', () => {
        for (const key of Object.keys(english)) {
          if (english[key] === '') continue;
          expect((dictionary[key] ?? '').trim().length, key).toBeGreaterThan(0);
        }
      });
    });
  }
});
