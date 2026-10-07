import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { Input } from '@/components/ui/Input';
import { BRAND_NAME } from '@/utils/brand';
import { LANGUAGE_ORDER } from '@/utils/constants';

const REQUIRED_KEYS = [
  'login.show_key',
  'login.hide_key',
  'login.error_required',
  'login.heading',
  'login.spec_title',
  'login.spec_backend',
  'login.spec_backend_value',
  'login.spec_panel',
  'common.skip_to_content',
  'sidebar.nav_label',
];

const BRANDED_KEYS = ['title.login', 'title.abbr', 'splash.title', 'system_info.about_title'];

describe('CloudProxyz branding and accessibility strings', () => {
  test('every locale translates the new labels instead of falling back', () => {
    for (const lng of LANGUAGE_ORDER) {
      const bundle = i18n.getResourceBundle(lng, 'translation');
      for (const key of REQUIRED_KEYS) {
        const value = key.split('.').reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          bundle
        );
        expect(typeof value === 'string' && value.trim().length > 0, `${lng}:${key}`).toBe(true);
      }
    }
  });

  test('product-name strings resolve to the single brand constant', () => {
    for (const lng of LANGUAGE_ORDER) {
      const t = i18n.getFixedT(lng);
      for (const key of BRANDED_KEYS) {
        expect(t(key)).toBe(BRAND_NAME);
      }
    }
  });
});

describe('Input', () => {
  test('reserves room for a trailing element so text never runs under it', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { label: 'Key', rightElement: createElement('button', null, 'x') })
    );
    expect(html).toContain('input-has-trailing');
    expect(html).toContain('inset-inline-end:8px');
  });

  test('links an error to the field and marks it invalid', () => {
    const html = renderToStaticMarkup(
      createElement(Input, { id: 'key', label: 'Key', error: 'Enter the management key.' })
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="key-error"');
    expect(html).toContain('id="key-error"');
  });
});
