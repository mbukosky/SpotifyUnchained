import { describe, it, expect } from 'vitest';
import {
  clean,
  position,
  tileLabel,
  leadArtist,
  initials,
  hash,
  hexToHue,
  artistColor,
  moveIndex,
} from './tracks';

describe('clean', () => {
  it('strips markdown escapes from backfilled names', () => {
    expect(clean('Sorte \\- Ao Vivo')).toBe('Sorte - Ao Vivo');
    expect(clean('A\\_B \\(C\\)')).toBe('A_B (C)');
  });

  it('leaves plain names and missing values alone', () => {
    expect(clean('Plain Song')).toBe('Plain Song');
    expect(clean()).toBe('');
  });
});

describe('position and tileLabel', () => {
  it('pads positions to two digits from 01', () => {
    expect(position(0)).toBe('01');
    expect(position(8)).toBe('09');
    expect(position(148)).toBe('149');
  });

  it('names a tile after its track and artist', () => {
    expect(tileLabel({ name: 'Ao Vivo \\- Live', artist: 'Ana & Bia' })).toBe('Play Ao Vivo - Live by Ana & Bia');
  });
});

describe('leadArtist', () => {
  it.each([
    ['Taylor Swift', 'Taylor Swift'],
    ['Drake, 21 Savage', 'Drake'],
    ['Simon & Garfunkel', 'Simon'],
    ['Calvin Harris feat. Rihanna', 'Calvin Harris'],
    ['Skrillex x Fred again..', 'Skrillex'],
    ['Billie Eilish with Khalid', 'Billie Eilish'],
  ])('%s → %s', (input, lead) => {
    expect(leadArtist(input)).toBe(lead);
  });

  it('does not split inside words that contain "x" or "with"', () => {
    expect(leadArtist('Xavier Withers')).toBe('Xavier Withers');
  });

  it('falls back to the whole name when nothing precedes a separator', () => {
    expect(leadArtist('& Friends')).toBe('& Friends');
  });
});

describe('initials', () => {
  it('takes the first letters of two words', () => {
    expect(initials('Taylor Swift')).toBe('TS');
    expect(initials('henrique & juliano')).toBe('He');
    expect(initials('jão feat. Anitta')).toBe('Jã');
    expect(initials('mc ryan sp')).toBe('MR');
  });

  it('takes two letters of a one-word name', () => {
    expect(initials('Drake, 21 Savage')).toBe('Dr');
  });

  it('ignores punctuation and keeps accented letters', () => {
    expect(initials('Ñengo Flow')).toBe('ÑF');
    expect(initials('$uicideboy$')).toBe('Ui');
  });

  it('shows a note when the name has no letters or digits', () => {
    expect(initials('')).toBe('♪');
    expect(initials('!!!')).toBe('♪');
  });
});

describe('hash and hexToHue', () => {
  it('hashes the same string to the same unsigned number', () => {
    expect(hash('drake')).toBe(hash('drake'));
    expect(hash('drake')).not.toBe(hash('adele'));
    expect(hash('drake')).toBeGreaterThanOrEqual(0);
  });

  it('reads the hue of a hex color', () => {
    expect(hexToHue('#ff0000')).toBe(0);
    expect(hexToHue('#00ff00')).toBe(120);
    expect(hexToHue('#0000ff')).toBe(240);
  });

  it('falls back to violet for grey or malformed colors', () => {
    expect(hexToHue('#808080')).toBe(250);
    expect(hexToHue('nope')).toBe(250);
  });
});

describe('artistColor', () => {
  it('gives every track by the same lead artist the same color', () => {
    const a = artistColor('Drake, 21 Savage', '#5ce08a');
    const b = artistColor('drake feat. Future', '#5ce08a');
    expect(b).toEqual(a);
  });

  it('returns a hue and valid hsl color and gradient', () => {
    const c = artistColor('Anitta', '#5ce08a');
    expect(c.hue).toBeGreaterThanOrEqual(0);
    expect(c.hue).toBeLessThan(360);
    expect(c.color).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
    expect(c.gradient).toMatch(/^linear-gradient\(140deg, hsl\(.+\), hsl\(.+\)\)$/);
  });

  it('shifts with the region accent', () => {
    expect(artistColor('Anitta', '#ff0000').hue).not.toBe(artistColor('Anitta', '#0000ff').hue);
  });
});

describe('moveIndex', () => {
  // 10 tiles, 4 columns: rows 0–3, 4–7, 8–9.
  it('moves left and right by one and stops at the ends', () => {
    expect(moveIndex(5, 'ArrowRight', 4, 10)).toBe(6);
    expect(moveIndex(5, 'ArrowLeft', 4, 10)).toBe(4);
    expect(moveIndex(0, 'ArrowLeft', 4, 10)).toBe(0);
    expect(moveIndex(9, 'ArrowRight', 4, 10)).toBe(9);
  });

  it('moves up and down by a row', () => {
    expect(moveIndex(5, 'ArrowUp', 4, 10)).toBe(1);
    expect(moveIndex(1, 'ArrowDown', 4, 10)).toBe(5);
  });

  it('stays put going up from the first row', () => {
    expect(moveIndex(2, 'ArrowUp', 4, 10)).toBe(2);
  });

  it('lands on the last tile going down into a short row', () => {
    expect(moveIndex(7, 'ArrowDown', 4, 10)).toBe(9);
  });

  it('jumps to the ends with Home and End', () => {
    expect(moveIndex(5, 'Home', 4, 10)).toBe(0);
    expect(moveIndex(5, 'End', 4, 10)).toBe(9);
  });

  it('ignores other keys', () => {
    expect(moveIndex(5, 'Enter', 4, 10)).toBeNull();
  });
});
