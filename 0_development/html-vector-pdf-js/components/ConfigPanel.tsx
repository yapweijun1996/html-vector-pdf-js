import React, { useState } from 'react';
import { Settings, FileText, Download, Layout, Type, Bot } from 'lucide-react';
import { PdfConfig, PageSize, Orientation } from '../types';

interface ConfigPanelProps {
  config: PdfConfig;
  onConfigChange: (newConfig: PdfConfig) => void;
  onExport: () => void;
  isExporting: boolean;
  onOpenSettings: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onConfigChange, onExport, isExporting, onOpenSettings }) => {
  
  const handleChange = (key: keyof PdfConfig, value: any) => {
    onConfigChange({ ...config, [key]: value });
  };

  const handleMarginChange = (key: keyof PdfConfig['margins'], value: number) => {
    onConfigChange({
      ...config,
      margins: { ...config.margins, [key]: value }
    });
  };

  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-10">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
        <div>
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
            <Settings className="w-5 h-5" />
            Config
            </h2>
            <p className="text-xs text-slate-500 mt-1">Output settings</p>
        </div>
        <button 
            onClick={onOpenSettings}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
            title="Agent Settings"
        >
            <Bot className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Document Settings */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <FileText className="w-3 h-3" /> Document
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Filename</label>
              <input 
                type="text" 
                value={config.filename}
                onChange={(e) => handleChange('filename', e.target.value)}
                className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
              />
            </div>
          </div>
        </section>

        {/* Layout Settings */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Layout className="w-3 h-3" /> Layout
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Page Size</label>
              <select 
                value={config.pageSize}
                onChange={(e) => handleChange('pageSize', e.target.value as PageSize)}
                className="w-full text-sm border-slate-300 rounded-md shadow-sm border p-2"
              >
                <option value="a4">A4 (210 x 297 mm)</option>
                <option value="letter">Letter (216 x 279 mm)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Orientation</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleChange('orientation', 'portrait')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    config.orientation === 'portrait' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Portrait
                </button>
                <button
                  onClick={() => handleChange('orientation', 'landscape')}
                  className={`px-3 py-2 text-sm rounded-md border ${
                    config.orientation === 'landscape' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'bg-white border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  Landscape
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Margins */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Type className="w-3 h-3" /> Margins (mm)
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Top</label>
              <input 
                type="number" 
                value={config.margins.top}
                onChange={(e) => handleMarginChange('top', Number(e.target.value))}
                className="w-full text-sm border-slate-300 rounded-md border p-1"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Bottom</label>
              <input 
                type="number" 
                value={config.margins.bottom}
                onChange={(e) => handleMarginChange('bottom', Number(e.target.value))}
                className="w-full text-sm border-slate-300 rounded-md border p-1"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Left</label>
              <input 
                type="number" 
                value={config.margins.left}
                onChange={(e) => handleMarginChange('left', Number(e.target.value))}
                className="w-full text-sm border-slate-300 rounded-md border p-1"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Right</label>
              <input 
                type="number" 
                value={config.margins.right}
                onChange={(e) => handleMarginChange('right', Number(e.target.value))}
                className="w-full text-sm border-slate-300 rounded-md border p-1"
              />
            </div>
          </div>
        </section>

      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <button
          onClick={onExport}
          disabled={isExporting}
          className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <span className="animate-pulse">Generating...</span>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;