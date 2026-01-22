export const createShouldExclude = (excludeSelectors: string[]) => {
  return (el: Element | null): boolean => {
    if (!el) return false;
    for (const sel of excludeSelectors) {
      try {
        if (el.matches && el.matches(sel)) return true;
        if (el.closest && el.closest(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }
    return false;
  };
};

export const createIsPageBreakBefore = (pageBreakBeforeSelectors?: string[]) => {
  const selectors = pageBreakBeforeSelectors || [];
  return (el: Element): boolean => {
    // 1. Check predefined selectors (original logic)
    for (const sel of selectors) {
      try {
        if (el.matches(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }

    // 2. Check computed style ONLY for elements that "look like" page break markers
    // This avoids false positives on content elements like <p>, <span>, <strong>, etc.
    if (el instanceof HTMLElement && el.tagName === 'DIV') {
      try {
        const rect = el.getBoundingClientRect();
        const hasNoVisibleContent = el.innerText.trim() === '';
        const isSmallHeight = rect.height <= 5; // Page break markers are typically height: 0 or very small

        // Only check computed style if element looks like a page break marker:
        // - Is a DIV (page breaks are usually divs, not p/span/etc)
        // - Has no visible text content
        // - Has very small or zero height
        if (hasNoVisibleContent && isSmallHeight) {
          const computedStyle = window.getComputedStyle(el);
          const pageBreakBefore = computedStyle.pageBreakBefore || computedStyle.getPropertyValue('page-break-before');
          if (pageBreakBefore === 'always' || pageBreakBefore === 'left' || pageBreakBefore === 'right') {
            return true;
          }
        }
      } catch {
        // ignore style access errors
      }
    }

    return false;
  };
};

