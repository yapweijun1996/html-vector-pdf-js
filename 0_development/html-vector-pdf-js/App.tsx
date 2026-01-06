import React, { useState, useCallback } from 'react';
import { Printer, X, FileCog } from 'lucide-react';
import ConfigPanel from './components/ConfigPanel';
import PreviewPane from './components/PreviewPane';
import AgentChat from './components/AgentChat';
import { DEFAULT_CONFIG, SAMPLE_HTML } from './constants';
import { PdfConfig } from './types';
import { generatePdf } from './services/pdfGenerator';

const TARGET_ELEMENT_ID = 'print-content-target';

const App: React.FC = () => {
  const [config, setConfig] = useState<PdfConfig>(DEFAULT_CONFIG);
  const [isExporting, setIsExporting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Default to gemini-3-flash-preview as per guidelines for basic text tasks
  const [model, setModel] = useState('gemini-3-flash-preview');

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
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 font-sans relative">
      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-96 max-w-full m-4 overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center p-4 border-b bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileCog size={18} /> Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
             </div>
             <div className="p-5 space-y-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Model</label>
                    <div className="relative">
                        <input 
                            list="models" 
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <datalist id="models">
                            <option value="gemini-3-flash-preview" />
                            <option value="gemini-3-pro-preview" />
                            <option value="gemini-2.5-flash-latest" />
                        </datalist>
                    </div>
                </div>
             </div>
             <div className="p-4 border-t bg-slate-50 flex justify-end">
                <button 
                    onClick={() => setShowSettings(false)}
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                >
                    Save Changes
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg text-white shadow-md">
              <Printer size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Globe3 PDF Converter</h1>
              <p className="text-xs text-slate-500 font-medium">Vector Engine & Agentic Tools</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <span className="text-xs font-mono text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">v2.0.0-agent</span>
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
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>
      </div>

      <AgentChat 
        model={model}
        config={config}
        onConfigChange={setConfig}
      />
    </div>
  );
};

export default App;