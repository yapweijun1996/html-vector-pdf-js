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
    for (const sel of selectors) {
      try {
        if (el.matches(sel)) return true;
      } catch {
        // ignore invalid selector
      }
    }
    return false;
  };
};

