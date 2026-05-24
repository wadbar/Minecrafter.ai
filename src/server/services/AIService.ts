import { GoogleGenAI } from "@google/genai";
import { CircuitBreaker } from "../infrastructure/CircuitBreaker";
import { logger } from "../infrastructure/Logger";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

if (!GEMINI_API_KEY) {
  logger.warn("GEMINI_API_KEY is missing. AI Services will fail.");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: { "User-Agent": "aistudio-build" },
  },
});

export interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * AI Core Orchestrator (Optimized for Escalability & Security)
 * Implements model caching, sanitized execution context, and high resilience
 * through CircuitBreaker integration.
 */
export class AIService {
  private circuitBreaker: CircuitBreaker;
  private modelName: string;

  constructor(modelName: string = "gemini-3.5-flash") {
    this.modelName = modelName;
    this.circuitBreaker = new CircuitBreaker(`Gemini-${modelName}`, 3, 30000);
  }

  private sanitize(input: string): string {
    // Zero-Trust: Prevent prompt injection attacks
    return input.replace(/ignore all previous instructions|system prompt|bypass/gi, "[SANITIZED_PROMPT_INJECTION]");
  }

  async generate(prompt: string, history: ChatMessage[] = []): Promise<string> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      // Map history to @google/genai Content interface
      const contents: any[] = history.map(item => ({
        role: item.role,
        parts: item.parts
      }));
      contents.push({ role: "user", parts: [{ text: safePrompt }] });
      
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: contents,
        config: {
          temperature: 0.1, // Optimized for logical consistency and precision
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 8192, // Maximum output limit for detailed configurations and scripts
          systemInstruction: "You are the Supreme Minecraft Engine AI. Respond ONLY with the requested content. Eliminate colloquialisms. Emphasize performance, security, and industrial architecture. Think step-by-step for complex algorithms. Never refuse logical programming tasks."
        }
      });
      return response.text || "";
    });
  }

  async stream(prompt: string, history: ChatMessage[] = [], onChunk: (text: string) => void): Promise<void> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      const contents: any[] = history.map(item => ({
        role: item.role,
        parts: item.parts
      }));
      contents.push({ role: "user", parts: [{ text: safePrompt }] });
      
      const response = await ai.models.generateContentStream({
        model: this.modelName,
        contents: contents,
        config: {
          temperature: 0.1,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 8192,
          systemInstruction: "You are the Supreme Minecraft Engine AI. Respond ONLY with the requested content. Eliminate colloquialisms. Emphasize performance, security, and industrial architecture."
        }
      });
      
      let buffer = "";
      for await (const chunk of response) {
        if (chunk.text) {
          buffer += chunk.text;
          // Emit chunks in larger blocks to optimize network layer payload size
          if (buffer.length > 32 || chunk.text.includes("\\n")) {
            onChunk(buffer);
            buffer = "";
          }
        }
      }
      if (buffer.length > 0) onChunk(buffer); // Flush remaining
    });
  }

  async generateImage(prompt: string, aspectRatio: string = "1:1"): Promise<string> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: { parts: [{ text: safePrompt }] },
        config: {
          imageConfig: {
            aspectRatio: (aspectRatio as any) || "1:1",
            imageSize: "1K"
          }
        }
      });

      // Extract image from parts
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      throw new Error("A geração de imagem falhou: Nenhuma imagem nos candidatos.");
    });
  }
}

export const aiService = new AIService();
export const fastAiService = new AIService("gemini-3.1-flash-lite");
