import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles } from 'lucide-react';
import { ChatAgent } from '../services/agent';
import { PdfConfig } from '../types';

interface AgentChatProps {
  model: string;
  config: PdfConfig;
  onConfigChange: (newConfig: PdfConfig) => void;
}

const AgentChat: React.FC<AgentChatProps> = ({ model, config, onConfigChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: string, text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const agentRef = useRef<ChatAgent | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    agentRef.current = new ChatAgent(model);
    setMessages([{ role: 'model', text: 'Hi! I can help you layout this PDF. Ask me to "Change margins to 20mm" or "Switch to landscape".' }]);
  }, [model]);

  const handleSend = async () => {
    if (!input.trim() || !agentRef.current) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const response = await agentRef.current.sendMessage(userMsg, config, (updates) => {
        onConfigChange({ ...config, ...updates });
    });

    setMessages(prev => [...prev, { role: 'model', text: response }]);
    setIsLoading(false);
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-all z-50 flex items-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        <span className="font-semibold">AI Assistant</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 z-50 flex flex-col font-sans">
      <div className="p-4 bg-slate-800 text-white rounded-t-xl flex justify-between items-center">
        <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-300" />
            <span className="font-bold">Globe3 Agent</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:text-slate-300"><X size={18} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-lg text-sm ${
                    m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                }`}>
                    {m.text}
                </div>
            </div>
        ))}
        {isLoading && <div className="text-xs text-slate-400 text-center animate-pulse">Thinking...</div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t bg-white rounded-b-xl flex gap-2">
        <input 
            className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            placeholder="Type a command..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button 
            onClick={handleSend}
            disabled={isLoading}
            className="bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
            <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default AgentChat;