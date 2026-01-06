import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { PdfConfig } from '../types';

interface AgentMessage {
  role: 'user' | 'model';
  content: string;
}

// Tool Definitions
const tools: FunctionDeclaration[] = [
  {
    name: "updatePdfConfig",
    description: "Updates the PDF configuration (margins, orientation, etc) based on user request.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        orientation: { type: Type.STRING, enum: ["portrait", "landscape"] },
        pageSize: { type: Type.STRING, enum: ["a4", "letter"] },
        marginTop: { type: Type.NUMBER },
        marginBottom: { type: Type.NUMBER },
      },
    },
  },
];

export class ChatAgent {
  private ai: GoogleGenAI;
  private history: AgentMessage[] = [];
  private modelName: string;

  constructor(modelName: string) {
    // API Key must be from process.env.API_KEY
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    this.modelName = modelName;
    this.history = [
      { role: 'user', content: `You are a Globe3 PDF Expert and Layout Engineer. 
      
      Capabilities:
      1. You analyze requests to change PDF settings (Margins, Orientation, Page Size).
      2. You understand the "Vector PDF Engine" being used. It parses DOM Rects, supports individual borders (top/bottom/left/right), handles background colors, and renders text vectors.
      3. If a user complains about layout (e.g., "borders missing"), explain that the engine calculates borders individually now.
      
      Goal: Help users format their HTML tables to PDF perfectly.` }
    ];
  }

  updateModel(modelName: string) {
    this.modelName = modelName;
  }

  async sendMessage(
    message: string, 
    currentConfig: PdfConfig, 
    onConfigUpdate: (updates: Partial<PdfConfig>) => void
  ): Promise<string> {
    this.history.push({ role: 'user', content: message });

    try {
      // Prepare context with current config
      const systemContext = `Current Config: ${JSON.stringify(currentConfig)}.`;
      
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: [
            ...this.history.map(h => ({ role: h.role, parts: [{ text: h.content }] })),
            { role: 'user', parts: [{ text: systemContext }]} 
        ],
        config: { tools: [{ functionDeclarations: tools }] }
      });

      // Handle Function Calls
      if (response.functionCalls && response.functionCalls.length > 0) {
        const fc = response.functionCalls[0];
        if (fc.name === 'updatePdfConfig') {
          const args = fc.args as any;
          const updates: Partial<PdfConfig> = {};
          if (args.orientation) updates.orientation = args.orientation;
          if (args.pageSize) updates.pageSize = args.pageSize;
          if (args.marginTop !== undefined) updates.margins = { ...currentConfig.margins, top: args.marginTop };
          if (args.marginBottom !== undefined) updates.margins = { ...currentConfig.margins, bottom: args.marginBottom };
          
          onConfigUpdate(updates);
          const toolResult = "Configuration updated successfully.";
          this.history.push({ role: 'model', content: toolResult });
          return `${toolResult} I've adjusted the settings. How does the preview look now?`;
        }
      }

      const text = response.text || "I processed that.";
      this.history.push({ role: 'model', content: text });
      return text;

    } catch (error) {
      console.error(error);
      return "Error connecting to Agent brain. Please check your connection.";
    }
  }

  getHistory() { return this.history; }
}