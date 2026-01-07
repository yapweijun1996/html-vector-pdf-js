import React, { useState, useCallback } from 'react';
import { Printer } from 'lucide-react';
import ConfigPanel from './components/ConfigPanel';
import PreviewPane from './components/PreviewPane';
import { DEFAULT_CONFIG, SAMPLE_HTML } from './constants';
import { PdfConfig } from './types';
import { generatePdf } from './services/pdfGenerator';

const TARGET_ELEMENT_ID = 'print-content-target';

const App: React.FC = () => {
  const [config, setConfig] = useState<PdfConfig>(DEFAULT_CONFIG);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      await generatePdf(TARGET_ELEMENT_ID, config);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to generate PDF. check console for details.');
    } finally {
      setIsExporting(false);
    }
  }, [config]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white shadow-md">
              <Printer size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Globe3 PDF Converter</h1>
              <p className="text-xs text-slate-500 font-medium">Vector Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs font-mono text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">v2.1.0</span>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          <PreviewPane 
            htmlContent={SAMPLE_HTML}
            config={config}
            targetId={TARGET_ELEMENT_ID}
          />
          <ConfigPanel 
            config={config} 
            onConfigChange={setConfig}
            onExport={handleExport}
            isExporting={isExporting}
          />
        </div>
      </div>
    </div>
  );
};

export default App;