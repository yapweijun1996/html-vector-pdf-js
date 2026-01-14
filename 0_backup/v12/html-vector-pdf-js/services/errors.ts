export const HTML_TO_VECTOR_PDF_ERROR_CODES = [
  'ELEMENT_NOT_FOUND',
  'ELEMENT_ZERO_SIZE',
  'DEPENDENCY_LOAD_FAILED',
  'ASSET_LOAD_FAILED',
  'GENERATION_FAILED'
] as const;

export type HtmlToVectorPdfErrorCode = (typeof HTML_TO_VECTOR_PDF_ERROR_CODES)[number];

export type HtmlToVectorPdfErrorMeta = Record<string, unknown>;

export class HtmlToVectorPdfError extends Error {
  public readonly code: HtmlToVectorPdfErrorCode;
  public readonly meta?: HtmlToVectorPdfErrorMeta;
  public readonly cause?: unknown;

  constructor(code: HtmlToVectorPdfErrorCode, message: string, meta?: HtmlToVectorPdfErrorMeta, cause?: unknown) {
    super(message);
    this.name = 'HtmlToVectorPdfError';
    this.code = code;
    this.meta = meta;
    this.cause = cause;
  }
}

export const asHtmlToVectorPdfError = (
  err: unknown,
  fallback: { code: HtmlToVectorPdfErrorCode; message: string; meta?: HtmlToVectorPdfErrorMeta }
): HtmlToVectorPdfError => {
  if (err instanceof HtmlToVectorPdfError) return err;
  if (err instanceof Error) return new HtmlToVectorPdfError(fallback.code, fallback.message, fallback.meta, err);
  return new HtmlToVectorPdfError(fallback.code, fallback.message, fallback.meta, err);
};

