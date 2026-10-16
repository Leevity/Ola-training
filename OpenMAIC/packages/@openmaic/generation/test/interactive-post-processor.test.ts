import { describe, expect, it } from 'vitest';
import { postProcessInteractiveHtml } from '../src/interactive-post-processor.js';

describe('interactive HTML post-processing', () => {
  it('lets isolated hosts avoid injected CDN resources while retaining widget scripts', () => {
    const html = '<!DOCTYPE html><html><head></head><body><button>Start</button><script>window.ready=true;</script></body></html>';
    expect(postProcessInteractiveHtml(html, { injectMathResources: false })).toBe(html);
    expect(postProcessInteractiveHtml(html)).toContain('https://cdn.jsdelivr.net/npm/katex');
  });
  it('preserves a truncated script through EOF before KaTeX injection', () => {
    const source =
      '<script>const transform = `translate(${pos.x}, ${pos.y})`; const label = "$E$";';
    expect(postProcessInteractiveHtml(source).startsWith(source)).toBe(true);
  });

  it('does not match across template interpolation while converting inline math', () => {
    const source =
      '<div data-transform="translate(${pos.x}, ${pos.y})" data-price="cost $5 ${pos.x}" data-after="${pos.x}$x$">$\\frac{1}{2}$</div>';
    const processed = postProcessInteractiveHtml(source);
    expect(processed).toContain('translate(${pos.x}, ${pos.y})');
    expect(processed).toContain('cost $5 ${pos.x}');
    expect(processed).toContain('data-after="${pos.x}\\(x\\)"');
    expect(processed).toContain('\\(\\frac{1}{2}\\)');
  });

  it('still protects closed scripts and converts math after them', () => {
    const source = '<script>const label = "$E$";</script><p>$x$</p>';
    const processed = postProcessInteractiveHtml(source);
    expect(processed).toContain('const label = "$E$";');
    expect(processed).toContain('<p>\\(x\\)</p>');
  });
});
