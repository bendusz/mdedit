import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { getCursorInfo } from '../src/observers';

function stateWith(doc: string, cursor?: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor ?? 0 },
  });
}

describe('getCursorInfo', () => {
  it('returns line 1, col 1 for cursor at start of document', () => {
    const info = getCursorInfo(stateWith('hello world', 0));
    expect(info.line).toBe(1);
    expect(info.col).toBe(1);
  });

  it('returns correct column within a line', () => {
    const info = getCursorInfo(stateWith('hello world', 5));
    expect(info.line).toBe(1);
    expect(info.col).toBe(6);
  });

  it('returns correct line and column on second line', () => {
    const doc = 'first line\nsecond line';
    // cursor at 's' of 'second' (index 11)
    const info = getCursorInfo(stateWith(doc, 11));
    expect(info.line).toBe(2);
    expect(info.col).toBe(1);
  });

  it('counts words correctly', () => {
    const info = getCursorInfo(stateWith('hello world foo bar'));
    expect(info.wordCount).toBe(4);
  });

  it('returns 0 words for empty document', () => {
    const info = getCursorInfo(stateWith(''));
    expect(info.wordCount).toBe(0);
  });

  it('returns 0 words for whitespace-only document', () => {
    const info = getCursorInfo(stateWith('   \n  \n  '));
    expect(info.wordCount).toBe(0);
  });

  it('returns correct charCount', () => {
    const info = getCursorInfo(stateWith('abc'));
    expect(info.charCount).toBe(3);
  });

  it('handles multiline word count', () => {
    const doc = 'one two\nthree four\nfive';
    const info = getCursorInfo(stateWith(doc));
    expect(info.wordCount).toBe(5);
  });
});
