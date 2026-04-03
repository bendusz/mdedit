/**
 * Print styled HTML content using a hidden iframe.
 *
 * Creates a temporary hidden iframe, loads the HTML document via srcdoc,
 * triggers the native print dialog (which on macOS includes "Save as PDF"),
 * and cleans up the iframe after printing completes.
 */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';

  // Restrict srcdoc content — allow-modals is required for window.print().
  // Do NOT add allow-scripts: the HTML comes from marked output and must not
  // be able to reach the Tauri bridge.
  iframe.sandbox.add('allow-modals');

  iframe.onload = () => {
    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      cleanup();
      console.error('Failed to access print iframe window');
      return;
    }

    try {
      iframeWindow.focus();
      // Use afterprint for deterministic cleanup; fall back to a long timeout
      // in case afterprint never fires (e.g. user cancels before the dialog opens).
      iframeWindow.addEventListener('afterprint', cleanup, { once: true });
      iframeWindow.print();
      // Safety-net fallback — remove if afterprint already fired
      setTimeout(cleanup, 10000);
    } catch (e) {
      console.error('Print failed:', e);
      cleanup();
    }
  };

  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  function cleanup() {
    if (iframe.parentNode) {
      document.body.removeChild(iframe);
    }
  }
}
