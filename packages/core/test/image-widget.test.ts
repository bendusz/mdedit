import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEditor } from '../src/editor';
import { EditorView } from '@codemirror/view';
import { isSafeImageSrc } from '../src/extensions/image-widget';

/**
 * Helper: force the editor to parse the syntax tree synchronously
 * so decorations can be computed.
 */
function flushEditorUpdate(view: EditorView) {
  (view as any).observer?.flush?.();
  view.requestMeasure();
}

/**
 * Move cursor to a specific line (1-based) and flush so decorations recompute.
 */
function moveCursorToLine(view: EditorView, lineNumber: number) {
  const line = view.state.doc.line(lineNumber);
  view.dispatch({ selection: { anchor: line.from } });
  flushEditorUpdate(view);
}

describe('isSafeImageSrc', () => {
  it('should allow relative paths', () => {
    expect(isSafeImageSrc('images/photo.png')).toBe(true);
    expect(isSafeImageSrc('./screenshot.jpg')).toBe(true);
    expect(isSafeImageSrc('../assets/logo.svg')).toBe(true);
  });

  it('should allow file:// URIs', () => {
    expect(isSafeImageSrc('file:///Users/me/photo.png')).toBe(true);
  });

  it('should allow data: image URIs', () => {
    expect(isSafeImageSrc('data:image/png;base64,abc123')).toBe(true);
    expect(isSafeImageSrc('data:image/jpeg;base64,xyz')).toBe(true);
  });

  it('should block http:// URLs', () => {
    expect(isSafeImageSrc('http://example.com/image.png')).toBe(false);
  });

  it('should block https:// URLs', () => {
    expect(isSafeImageSrc('https://example.com/image.png')).toBe(false);
  });

  it('should block javascript: URIs', () => {
    expect(isSafeImageSrc('javascript:alert(1)')).toBe(false);
  });

  it('should block other schemes', () => {
    expect(isSafeImageSrc('ftp://example.com/image.png')).toBe(false);
  });

  it('should block non-image data: URIs', () => {
    expect(isSafeImageSrc('data:text/html,<h1>hi</h1>')).toBe(false);
  });
});

describe('image widget decorations', () => {
  let container: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    view?.destroy();
    container.remove();
  });

  it('should render an image widget for valid image syntax', () => {
    view = createEditor({
      parent: container,
      content: '![alt text](./photo.png)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(1);
    const img = widgets[0].querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('alt text');
    expect(img!.getAttribute('src')).toBe('./photo.png');
  });

  it('should show blocked warning for remote https:// images', () => {
    view = createEditor({
      parent: container,
      content: '![remote pic](https://example.com/img.png)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(1);
    expect(widgets[0].textContent).toBe('[Remote image blocked: remote pic]');
    expect(widgets[0].querySelector('img')).toBeNull();
  });

  it('should show blocked warning for remote http:// images', () => {
    view = createEditor({
      parent: container,
      content: '![pic](http://example.com/img.png)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(1);
    expect(widgets[0].textContent).toContain('[Remote image blocked:');
  });

  it('should allow data: image URIs', () => {
    view = createEditor({
      parent: container,
      content: '![embedded](data:image/png;base64,abc123)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(1);
    const img = widgets[0].querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('data:image/png;base64,abc123');
  });

  it('should not show widget when cursor is on the image line', () => {
    view = createEditor({
      parent: container,
      content: '![alt text](./photo.png)\n\nother line',
    });
    moveCursorToLine(view, 1);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(0);
  });

  it('should show widget when cursor moves away from image line', () => {
    view = createEditor({
      parent: container,
      content: '![alt text](./photo.png)\n\nother line',
    });

    // Start on the image line — no widget
    moveCursorToLine(view, 1);
    expect(container.querySelectorAll('.cm-image-widget').length).toBe(0);

    // Move to a different line — widget appears
    moveCursorToLine(view, 3);
    expect(container.querySelectorAll('.cm-image-widget').length).toBe(1);
  });

  it('should handle image with empty alt text', () => {
    view = createEditor({
      parent: container,
      content: '![](./photo.png)\n\ncursor here',
    });
    moveCursorToLine(view, 3);

    const widgets = container.querySelectorAll('.cm-image-widget');
    expect(widgets.length).toBe(1);
    const img = widgets[0].querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('alt')).toBe('');
  });
});
