import { describe, it, expect } from 'vitest';
import { isSafeImageSrc } from '../src/extensions/image-widget';

describe('security', () => {
  describe('isSafeImageSrc', () => {
    it('blocks http URLs', () => expect(isSafeImageSrc('http://evil.com/img.png')).toBe(false));
    it('blocks https URLs', () => expect(isSafeImageSrc('https://evil.com/img.png')).toBe(false));
    it('blocks javascript:', () => expect(isSafeImageSrc('javascript:alert(1)')).toBe(false));
    it('blocks protocol-relative', () => expect(isSafeImageSrc('//evil.com/img.png')).toBe(false));
    it('allows relative paths', () => expect(isSafeImageSrc('./images/photo.png')).toBe(true));
    it('allows file://', () => expect(isSafeImageSrc('file:///Users/ben/img.png')).toBe(true));
    it('allows data:image/', () => expect(isSafeImageSrc('data:image/png;base64,abc')).toBe(true));
    it('blocks data:text/', () => expect(isSafeImageSrc('data:text/html,<script>')).toBe(false));
  });
});
