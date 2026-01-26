import { describe, expect, it } from 'vitest';
import { resolveGeneratePdfTarget } from './generatePdf.targetOverride';

describe('resolveGeneratePdfTarget', () => {
  it('returns original target when no override is set', () => {
    // @ts-expect-error test-only global
    delete window.html_to_vector_pdf_target;
    expect(resolveGeneratePdfTarget('body')).toBe('body');
  });

  it('returns override when override is a non-empty string', () => {
    // @ts-expect-error test-only global
    window.html_to_vector_pdf_target = '.html_to_vector_pdf_print_area';
    expect(resolveGeneratePdfTarget('body')).toBe('.html_to_vector_pdf_print_area');
  });

  it('ignores whitespace-only override', () => {
    // @ts-expect-error test-only global
    window.html_to_vector_pdf_target = '   ';
    expect(resolveGeneratePdfTarget('body')).toBe('body');
  });
});

