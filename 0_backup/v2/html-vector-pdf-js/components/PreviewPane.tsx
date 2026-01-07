import React, { useEffect, useRef } from 'react';
import { PdfConfig } from '../types';

interface PreviewPaneProps {
  htmlContent: string;
  config: PdfConfig;
  targetId: string;
}

const PreviewPane: React.FC<PreviewPaneProps> = ({ htmlContent, config, targetId }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Inject the HTML content
      containerRef.current.innerHTML = htmlContent;
    }
  }, [htmlContent]);

  // Calculate approximate styling for the visual preview based on config
  // Note: This purely visualizes the margins in the UI, doesn't affect the HTML structure itself
  // because the PDF generator handles margins mathematically.
  const previewStyle: React.CSSProperties = {
    paddingTop: `${config.margins.top}mm`,
    paddingRight: `${config.margins.right}mm`,
    paddingBottom: `${config.margins.bottom}mm`,
    paddingLeft: `${config.margins.left}mm`,
  };

  return (
    <div className="flex-1 bg-slate-100 overflow-auto relative p-8 flex justify-center">
      <div className="relative">
        
        {/* Paper Simulation */}
        <div 
          id="preview-paper"
          className="print-preview bg-white text-black relative transition-all duration-300 ease-in-out"
          style={previewStyle}
        >
          {/* Content Target for PDF Generator */}
          <div 
            id={targetId} 
            ref={containerRef}
            className="w-full h-full"
          >
            {/* HTML injected here */}
          </div>
        </div>

        {/* Ruler/Dimensions Indicators (Visual Polish) */}
        <div className="absolute -top-6 left-0 w-full text-center text-xs text-slate-400">
            {config.pageSize.toUpperCase()} ({config.orientation})
        </div>

      </div>
    </div>
  );
};

export default PreviewPane;
