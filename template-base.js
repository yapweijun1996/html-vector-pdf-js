/*
 * Template Base JS
 *
 * After printform.js runs:
 *   .printform → removed, replaced by .printform_formatter_processed
 *   .printform_page → individual pages (750px wide)
 *   .physical_page_wrapper → wraps each page (750px wide)
 *
 * Use .physical_page_wrapper as PDF target (one per page).
 * Use .printform_page width (750px) for pxToMm calibration.
 */
const CSS_PX_TO_MM = 25.4 / 96;

function clampMargin(mm) {
  return Math.max(0, Number.isFinite(mm) ? mm : 0);
}

function buildCenteredMargins(pageWidthMm, pageHeightMm, contentWidthMm, contentHeightMm) {
  const horizontalMargin = clampMargin((pageWidthMm - contentWidthMm) / 2);

  return {
    top: 5,
    right: horizontalMargin,
    bottom: 5,
    left: horizontalMargin
  };
}

function resolveTemplateCalibration(pageEl, pageWidthMm, pageHeightMm) {
  const rect = pageEl.getBoundingClientRect();
  const baseWidthPx = rect.width || 750;
  const baseHeightPx = rect.height || 1050;
  const widthFitPxToMm = pageWidthMm / baseWidthPx;
  const heightFitPxToMm = pageHeightMm / baseHeightPx;

  let pxToMm = CSS_PX_TO_MM;
  let fallbackMode = 'css96dpi';
  let contentWidthMm = baseWidthPx * pxToMm;
  let contentHeightMm = baseHeightPx * pxToMm;

  if (contentWidthMm > pageWidthMm || contentHeightMm > pageHeightMm) {
    pxToMm = Math.min(CSS_PX_TO_MM, widthFitPxToMm, heightFitPxToMm);
    fallbackMode = 'fit-to-page';
    contentWidthMm = baseWidthPx * pxToMm;
    contentHeightMm = baseHeightPx * pxToMm;
  }

  const margins = buildCenteredMargins(pageWidthMm, pageHeightMm, contentWidthMm, contentHeightMm);

  return {
    baseHeightPx: baseHeightPx,
    baseWidthPx: baseWidthPx,
    pxToMm: pxToMm,
    widthFitPxToMm: widthFitPxToMm,
    heightFitPxToMm: heightFitPxToMm,
    contentWidthMm: contentWidthMm,
    contentHeightMm: contentHeightMm,
    margins: margins,
    fallbackMode: fallbackMode
  };
}

async function downloadPdf(filename) {
  try {
    var pageWidthMm = 210;
    var pageHeightMm = 297;

    // Get the ACTUAL page width (750px), NOT the formatter container (viewport width)
    var pageEl = document.querySelector('.printform_page')
              || document.querySelector('.physical_page_wrapper')
              || document.querySelector('.printform')
              || document.querySelector('.html_to_vector_pdf');

    if (!pageEl) {
      alert('No printform container found. Is printform.js loaded?');
      return;
    }

    var calibration = resolveTemplateCalibration(pageEl, pageWidthMm, pageHeightMm);
    var pxToMm = calibration.pxToMm;
    var margins = calibration.margins;

    if (window.html_to_vector_pdf_debug) {
      console.log('[template-base] Calibration', {
        cssPxToMm: CSS_PX_TO_MM,
        widthFitPxToMm: calibration.widthFitPxToMm,
        heightFitPxToMm: calibration.heightFitPxToMm,
        chosenPxToMm: pxToMm,
        baseWidthPx: calibration.baseWidthPx,
        baseHeightPx: calibration.baseHeightPx,
        contentWidthMm: calibration.contentWidthMm,
        contentHeightMm: calibration.contentHeightMm,
        chosenMargins: margins,
        fallbackMode: calibration.fallbackMode
      });
    }

    // Use .physical_page_wrapper as target — each wrapper = one PDF page
    var selector;
    if (document.querySelector('.physical_page_wrapper')) {
      selector = '.physical_page_wrapper';
    } else if (document.querySelector('.printform')) {
      selector = '.printform';
    } else {
      selector = '.html_to_vector_pdf';
    }

    await html_to_vector_pdf.generatePdf(selector, {
      filename: filename || 'document.pdf',
      pageSize: 'a4',
      orientation: 'portrait',
      margins: margins,
      render: { pxToMm: pxToMm },
      text: { scale: 1 },
      excludeSelectors: ['.controls', '#pdf-download-btn', '.dummy_row_item', '.dummy_spacer']
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    alert('Error generating PDF: ' + err.message);
  }
}
