import { describe, expect, it } from 'vitest';
import type { MatrixRow } from '../../src/web/lib/status.js';
import { alignedMatrixCells } from '../../src/web/lib/status.js';

const row: MatrixRow = {
  slotId: 'slot_a',
  label: 'Saturday, November 28, 2026 · 10:00–12:00',
  shortLabel: 'Sat 28 Nov · 10:00–12:00',
  fits: 1,
  ceiling: 2,
  meetsMinimum: false,
  isSelectedOfferSlot: false,
  cells: [
    { participantId: 'par_b', name: 'Ben', state: 'unknown' },
    { participantId: 'par_a', name: 'Alice', state: 'accepted' },
    { participantId: 'par_c', name: 'Cara', state: 'conditional' },
  ],
};

describe('alignedMatrixCells', () => {
  it('keeps every cell attached to its participant ID when input order is shuffled', () => {
    const columns = [
      { id: 'par_a', displayName: 'Alice' },
      { id: 'par_b', displayName: 'Ben' },
      { id: 'par_c', displayName: 'Cara' },
    ];
    const aligned = alignedMatrixCells(row, columns);
    expect(aligned.map((cell) => [cell.participantId, cell.name, cell.state])).toEqual([
      ['par_a', 'Alice', 'accepted'],
      ['par_b', 'Ben', 'unknown'],
      ['par_c', 'Cara', 'conditional'],
    ]);

    const shuffledColumns = [columns[2]!, columns[0]!, columns[1]!];
    const shuffled = alignedMatrixCells(row, shuffledColumns);
    expect(shuffled.map((cell) => [cell.participantId, cell.name])).toEqual([
      ['par_c', 'Cara'],
      ['par_a', 'Alice'],
      ['par_b', 'Ben'],
    ]);
    // Visual header order and cell order now always match.
    expect(shuffled.map((cell) => cell.participantId)).toEqual(shuffledColumns.map((p) => p.id));
  });

  it('fills a missing cell as unknown for that column instead of shifting', () => {
    const partial = { ...row, cells: row.cells.filter((cell) => cell.participantId !== 'par_a') };
    const aligned = alignedMatrixCells(partial, [
      { id: 'par_a', displayName: 'Alice' },
      { id: 'par_b', displayName: 'Ben' },
    ]);
    expect(aligned[0]).toMatchObject({ participantId: 'par_a', name: 'Alice', state: 'unknown' });
    expect(aligned[1]).toMatchObject({ participantId: 'par_b', name: 'Ben', state: 'unknown' });
  });
});
