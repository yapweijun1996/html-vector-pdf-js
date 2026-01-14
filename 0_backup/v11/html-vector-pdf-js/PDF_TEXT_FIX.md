# PDF Text Rendering Fix - Mixed Styles Issue

## Problem Summary

**Issue:** In the PDF output, text with mixed styles (bold and normal) in the same table cell was rendering incorrectly. Specifically, the line:

```html
<td width="50%" align="right"><b>INV NO:</b> INV-2026-0002 | <b>DATE:</b> 15 JAN 2026</td>
```

Was displaying as:
- **HTML Preview:** `INV NO: INV-2026-0002 | DATE: 15 JAN 2026` ✓ (correct)
- **PDF Output:** `INV NO: INV-2026-DATE: 15 JAN 2026` ✗ (incorrect - text overlapping/missing)

## Root Cause

The issue was in the **text aggregation logic** in `services/pdfGenerator.ts` (lines 592-644).

### How Text Aggregation Works

The PDF generator has an optimization that aggregates text fragments in table cells:
1. It groups text by: Layout ID (TD cell) + Style + Y position + Alignment
2. Text fragments with the **same style** are concatenated into a single string
3. This concatenated text is then rendered at the cell-aligned position (left/center/right)

### The Bug

When a cell contains **mixed styles** (e.g., `<b>bold</b>` and normal text):
- Each text fragment has a different style key
- The aggregation logic would try to concatenate them
- But they would be rendered at the **same X position** (cell-aligned)
- This caused text to overlap or render incorrectly

Example breakdown of the problematic cell:
1. `"INV NO:"` (bold) → Style Key A
2. `" INV-2026-0002 | "` (normal) → Style Key B  
3. `"DATE:"` (bold) → Style Key A
4. `" 15 JAN 2026"` (normal) → Style Key B

The aggregation would group #1 and #3 together (same style), and #2 and #4 together, but render them at overlapping positions.

## The Fix

Modified the aggregation logic to detect cells with mixed styles and disable aggregation for those cells:

```typescript
// Check if this cell has mixed styles by looking for child elements with different styles
const hasMixedStyles = inTableCell && layoutEl.querySelectorAll('b, strong, i, em, span').length > 0;

// Only aggregate if:
// 1. We're in a table cell
// 2. The text style matches the cell's style (no inline formatting)
// 3. There are no mixed styles in the cell (no <b>, <strong>, etc.)
const canAggregate = inTableCell && 
                     !hasMixedStyles &&
                     buildTextStyleKey(fontStyle) === buildTextStyleKey(window.getComputedStyle(layoutEl));
```

### How the Fix Works

1. **Detection:** Check if the table cell contains any inline formatting elements (`<b>`, `<strong>`, `<i>`, `<em>`, `<span>`)
2. **Disable Aggregation:** If mixed styles are detected, set `canAggregate = false`
3. **Use Actual Positions:** When aggregation is disabled, each text fragment is rendered at its **actual browser-calculated position** (`xMmActual`) instead of the cell-aligned position
4. **Preserve Layout:** This ensures the text appears exactly as it does in the HTML preview

## Testing

After the fix:
- ✅ Build completed successfully
- ✅ The `dist/html_to_vector_pdf.js` file was regenerated (single-file output)
- ✅ Text with mixed styles should now render correctly in PDF output

## Files Modified

- `services/pdfGenerator.ts` (lines 592-644)
  - Added `hasMixedStyles` detection
  - Updated `canAggregate` condition to check for mixed styles
  - Text in cells with mixed styles now uses actual positions instead of aggregation

## Next Steps

1. Test the PDF generation with `index_multi.html`
2. Verify that "INV NO: INV-2026-0002 | DATE: 15 JAN 2026" renders correctly
3. Check other invoices with mixed formatting to ensure no regressions

## Technical Notes

- The fix is conservative: it disables aggregation for **any** cell with inline formatting elements
- This may slightly increase the number of text render operations, but ensures correctness
- The performance impact should be negligible for typical invoice documents
- The fix preserves the optimization for cells with uniform styling (most table cells)

## Alignment Fix Note (Addendum)

**Issue:** When aggregation is disabled (due to mixed styles), the code uses the **actual X position** (`xMmActual`) of the text node (Left edge). However, it was previously passing the cell's `textAlign` (e.g., 'right' or 'center').

**Result:** `jsPDF` would take the 'Left Edge' coordinate but align the text 'Right' or 'Center' relative to it, causing the text to shift significantly to the left (by 50% or 100% of its width).

**Fix:** When using `xMmActual` (which is explicitly the left start of the text), we must **always force** `textAlign: 'left'`. This ensures the text is drawn exactly where the browser positioned it.
