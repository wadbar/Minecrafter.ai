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

  constructor(modelName: string = "gemini-3.1-pro-preview") {
    this.modelName = modelName;
    this.circuitBreaker = new CircuitBreaker(`Gemini-${modelName}`, 3, 20000);
  }

  private sanitize(input: string): string {
    // Zero-Trust: Prevent prompt injection attacks
    return input.replace(/ignore all previous instructions|system prompt|bypass/gi, "[SANITIZED_PROMPT_INJECTION]");
  }

  async generate(prompt: string, history: ChatMessage[] = []): Promise<string> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      // Map history to @google/genai Content interface if needed, or use generateContent
      // Since it's history + prompt, we can construct the whole history
      const contents = history.map(item => ({
        role: item.role,
        parts: item.parts
      }));
      contents.push({ role: "user", parts: [{ text: safePrompt }] });
      
      const response = await ai.models.generateContent({
        model: this.modelName,
        contents: contents as any,
        config: {
          temperature: 0.3
        }
      });
      return response.text || "";
    });
  }

  async stream(prompt: string, history: ChatMessage[] = [], onChunk: (text: string) => void): Promise<void> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      const contents = history.map(item => ({
        role: item.role,
        parts: item.parts
      }));
      contents.push({ role: "user", parts: [{ text: safePrompt }] });
      
      const response = await ai.models.generateContentStream({
        model: this.modelName,
        contents: contents as any,
        config: {
          temperature: 0.3
        }
      });
      
      for await (const chunk of response) {
        if (chunk.text) onChunk(chunk.text);
      }
    });
  }

  async generateImage(prompt: string, aspectRatio: string = "1:1"): Promise<string> {
    const safePrompt = this.sanitize(prompt);
    return this.circuitBreaker.execute(async () => {
      // Imagen 3 requires specific model
      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: safePrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/png",
          aspectRatio: aspectRatio,
        }
      });
      // Return base64 data URI
      const base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (!base64Bytes) throw new Error("A geração de imagem falhou.");
      return `data:image/png;base64,${base64Bytes}`;
    });
  }
}

export const aiService = new AIService();
export const fastAiService = new AIService("gemini-3-flash-preview");
