import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('../app/design-system/tokens.css');
const palette = read('../app/design-system/mdress-palette.css');
const components = read('../app/design-system/components.css');

function declarations(css, selector) {
  const start = css.indexOf(selector + '{');
  assert.notEqual(start, -1, 'Missing CSS selector: ' + selector);
  const block = css.slice(start + selector.length + 1).split('}')[0];
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()])
  );
}

function luminance(hex) {
  const value = hex.replace('#', '');
  assert.match(value, /^(?:[0-9a-f]{3}|[0-9a-f]{6})$/i, 'Expected solid hex color: ' + hex);
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value;
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('primary button uses semantic foreground in default and hover states', () => {
  assert.match(components, /\.ds-button--primary\{[^}]*color:var\(--ds-on-brand\)/);
  assert.match(components, /\.ds-button--primary:hover\{[^}]*color:var\(--ds-on-brand\)/);
});

test('primary button text meets WCAG AA normal-text contrast in every app theme and hover state', () => {
  const defaults = declarations(tokens, ':root');
  for (const theme of ['graphite', 'studio', 'oled', 'sand', 'neon', 'mdress']) {
    const overrides = declarations(theme === 'mdress' ? palette : tokens, 'body[data-theme=' + theme + ']');
    const resolved = { ...defaults, ...overrides };
    for (const background of ['--ds-brand', '--ds-brand-strong']) {
      const ratio = contrast(resolved['--ds-on-brand'], resolved[background]);
      assert.ok(ratio >= 4.5, theme + ' ' + background + ' contrast ' + ratio.toFixed(2) + ':1 < 4.5:1');
    }
  }
});
