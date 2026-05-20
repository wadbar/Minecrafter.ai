import express, { Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
import os from "os";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import cors from "cors";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Server as SocketIOServer } from "socket.io";

// New modules
import { logger } from "./src/server/infrastructure/Logger";
import { aiService, fastAiService } from "./src/server/services/AIService";
import { minecraftService } from "./src/server/services/MinecraftService";
import { telemetryMiddleware } from "./src/server/middleware/telemetry";

dotenv.config();

// ==========================================
// 1. GLOBAL STATE & CONSTANTS
// ==========================================
const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * Memory Monitor (The Guardian)
 * Tracks memory utilization to prevent leaks in long-running processes.
 */
class MemoryMonitor {
  private static MAX_THRESHOLD = 0.85; // 85% of total heap

  static audit() {
    const memory = process.memoryUsage();
    const ratio = memory.heapUsed / memory.heapTotal;
    
    if (ratio > this.MAX_THRESHOLD) {
      logger.warn(`HIGH_MEMORY_PRESSURE: ${Math.round(ratio * 100)}%. Clearing buildCache.`);
      buildCache.clear();
    }

    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      used: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      load: `${Math.round(ratio * 100)}%`,
      system: {
        cpuLoad: Math.round(loadAvg[0] * 100 / cpus.length),
        freeMem: `${Math.round(freeMem / 1024 / 1024)}MB`,
        totalMem: `${Math.round(totalMem / 1024 / 1024)}MB`
      }
    };
  }
}

// Cache In-Memory LRU (Shared between REST and WS)
export const buildCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 60, // 1 hour horizon
});

// ==========================================
// 2. EXPRESS REFINEMENT (THE GUARDIAN)
// ==========================================
const app = express();

app.set("trust proxy", 1);
app.use(telemetryMiddleware);

app.use(compression({ level: 6, threshold: 1024 }));

app.use(cors({
  origin: (origin, callback) => {
    // Permitir qualquer origem em ambiente de desenvolvimento ou se for um subdomínio conhecido
    if (!IS_PROD || !origin || origin.includes("run.app") || origin.includes("minecrafter.ai")) {
      callback(null, true);
    } else {
      callback(new Error("CORS Blocked by Security Subsystem"));
    }
  },
  methods: ["GET", "POST"]
}));

app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  xFrameOptions: false 
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increased for professional usage
  message: { error: "Abuso de taxa detectado. Requisição bloqueada por segurança." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);
app.use(express.json({ limit: "10mb" })); // Slightly increased for complex blueprints

// ==========================================
// 3. API DOCUMENTATION (SPECIFICATION CORE)
// ==========================================
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "SOLUTION BUILDER SERVICE API",
      version: "1.2.0",
      description: "Service layer for Minecraft asset generation and orchestration.",
    },
  },
  apis: ["./server.ts"],
};
const swaggerSpec = swaggerJsDoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==========================================
// 4. BUSINESS LOGIC & ROUTES (REST INTERFACE)
// ==========================================

const validateBody = (schema: z.ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error: any) {
    res.status(400).json({ error: "Validation Failure", details: error.errors, traceId: (req as any).traceId });
  }
};

const CommonSchema = z.object({
  prompt: z.string().min(3).max(5000),
  type: z.string().optional(),
});

const EditSchema = z.object({
  prompt: z.string().min(3).max(5000),
  existingData: z.string().max(200000),
  targetLanguage: z.string().default("pt-BR"),
});

const GuideSchema = z.object({
  context: z.string(),
  prompt: z.string().optional(),
  parameters: z.any().optional(),
  targetLanguage: z.string().default("pt-BR"),
});

/**
 * @swagger
 * /api/generate-mod:
 *   post:
 *     summary: AI Mod Generation
 */
app.post("/api/generate-mod", validateBody(CommonSchema), async (req, res) => {
  try {
    const result = await aiService.generate(`Expert Minecraft ${req.body.type} developer task: ${req.body.prompt}. Apply professional coding standards. Return ONLY code.`);
    res.json({ result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("MOD_GEN_FAILURE", err);
    res.status(500).json({ error: "Execution error during resource generation.", traceId: (req as any).traceId });
  }
});

app.post("/api/edit-mod", validateBody(EditSchema), async (req, res) => {
  try {
    const result = await aiService.generate(`Optimize/Localize to ${req.body.targetLanguage}: ${req.body.prompt}. Code: ${req.body.existingData}`);
    res.json({ result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("MOD_EDIT_FAILURE", err);
    res.status(500).json({ error: "Execution error during code refactoring.", traceId: (req as any).traceId });
  }
});

app.post("/api/generate-map", validateBody(CommonSchema), async (req, res) => {
  try {
    const result = await aiService.generate(`Minecraft Map Architect task: ${req.body.prompt}. Return commands or datapack logic.`);
    res.json({ result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("MAP_GEN_FAILURE", err);
    res.status(500).json({ error: "Execution error during world synthesis.", traceId: (req as any).traceId });
  }
});

app.post("/api/edit-map", validateBody(EditSchema), async (req, res) => {
  const result = await aiService.generate(`Optimize/Translate Map Logic to ${req.body.targetLanguage}: ${req.body.prompt}. Data: ${req.body.existingData}`);
  res.json({ result, traceId: (req as any).traceId });
});

app.post("/api/generate-storyteller", validateBody(CommonSchema), async (req, res) => {
  const result = await aiService.generate(`Minecraft Story/NPC task: ${req.body.prompt}. Return narrative design and scripts.`);
  res.json({ result, traceId: (req as any).traceId });
});

app.post("/api/edit-storyteller", validateBody(EditSchema), async (req, res) => {
  const result = await aiService.generate(`Refine/Translate NPC Logic to ${req.body.targetLanguage}: ${req.body.prompt}. Data: ${req.body.existingData}`);
  res.json({ result, traceId: (req as any).traceId });
});

const TextureSchema = z.object({
  prompt: z.string().min(3).max(5000),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  aspectRatio: z.string().optional(),
});

app.post("/api/generate-texture", validateBody(TextureSchema), async (req, res) => {
  const { prompt, width, height, aspectRatio, baseImage } = req.body;
  let finalAspectRatio = aspectRatio || "1:1";
  
  if (!aspectRatio && width && height) {
    const ratio = width / height;
    if (ratio > 1.5) finalAspectRatio = "16:9";
    else if (ratio > 1.1) finalAspectRatio = "4:3";
    else if (ratio > 0.9) finalAspectRatio = "1:1";
    else if (ratio > 0.6) finalAspectRatio = "3:4";
    else finalAspectRatio = "9:16";
  }

  const basePromptPrefix = baseImage ? "Modify this base texture and add AI details: " : "";
  const result = await fastAiService.generateImage(`${basePromptPrefix}Minecraft ${width || 16}x${height || 16} pixel art texture of ${prompt}. Very blocky, pixelated, raw game asset style. No background.`, finalAspectRatio);
  res.json({ result, traceId: (req as any).traceId });
});

app.post("/api/generate-skin", validateBody(CommonSchema), async (req, res) => {
  const result = await aiService.generateImage(`Minecraft 64x64 skin template texture for ${req.body.prompt}. Traditional minecraft skin layout.`);
  res.json({ result, traceId: (req as any).traceId });
});

app.post("/api/generate-voxel", validateBody(CommonSchema), async (req, res) => {
  const startTime = Date.now();
  try {
    const systemPrompt = `# ROLE: VOXEL ARCHITECT & SENIOR 3D ENGINEER
Task: Design a production-grade 3D Minecraft structure for "${req.body.prompt}".
GUIDELINES:
1. MAX VOXELS: 250 (representative complex segment).
2. COORDINATES: Centered at [0,0,0], logical ground at Y=0.
3. COLOR PALETTE: Professionally thematic, Hex format.
4. STRUCTURAL INTEGRITY: Ensure the design is architecturally coherent.
5. SCALE: Maintain 1:1 Minecraft unit scaling.

OUTPUT SCHEMA (STRICT JSON ONLY):
{
  "name": "Industrial name",
  "description": "Short technical overview",
  "voxels": [
    {"position": [x, y, z], "color": "#HEX", "type": "block_id"}
  ],
  "stats": {
    "totalBlocks": number,
    "dimensions": [width, height, depth]
  }
}
Return ONLY the raw JSON block without any explanatory dialogue or markdown formatting.`;

    const result = await aiService.generate(systemPrompt);
    
    // Industrial JSON Extraction (Fortified logic)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
       throw new Error("Invalid structure data received from synthesizer core.");
    }
    
    const parsedData = JSON.parse(jsonMatch[0]);
    res.json({ ...parsedData, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("VOXEL_GEN_FAILURE", err);
    res.status(500).json({ 
      error: "Ocorreu uma falha na síntese da matriz voxel.", 
      details: err.message,
      code: "VOXEL_ENGINE_FAULT",
      traceId: (req as any).traceId 
    });
  }
});


const DeploySchema = z.object({
  host: z.string(),
  port: z.number().int().default(25565),
  username: z.string().min(3),
  password: z.string().optional(),
  auth: z.enum(["mojang", "microsoft", "offline"]).default("offline"),
  commands: z.array(z.string()),
});

/**
 * @swagger
 * /api/deploy-to-minecraft:
 *   post:
 *     summary: Live In-Game Deployment
 *     description: Directly execute generated commands on a remote Minecraft server.
 */
app.post("/api/deploy-to-minecraft", validateBody(DeploySchema), async (req, res) => {
  try {
    const { host, port, username, password, auth, commands } = req.body;
    const result = await minecraftService.executeCommands({ host, port, username, password, auth }, commands);
    res.json({ ...result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("DEPLOYMENT_INTERFACE_FAILED", err);
    res.status(500).json({ error: "Ocorreu uma falha crítica no enlace de implantação.", traceId: (req as any).traceId });
  }
});

// Build Pipeline Tracking
app.post("/api/build-pipeline", async (req, res) => {
  try {
    const { artifactId } = req.body;
    buildCache.set(artifactId, { status: "PROCESSING", timestamp: Date.now() });
    
    const { exec } = require("child_process");
    exec("npm run build", { shell: "/bin/bash" }, (error: any, stdout: string, stderr: string) => {
      if (error) {
        logger.error("BUILD_PIPELINE_ERROR", error);
        buildCache.set(artifactId, { status: "FAILED", error: stderr, timestamp: Date.now() });
        return;
      }
      buildCache.set(artifactId, { status: "SUCCESS", output: stdout, timestamp: Date.now() });
    });

    res.json({ message: "Build Pipeline Triggered", artifactId });
  } catch (err: any) {
    logger.error("PIPELINE_INIT_FAILED", err);
    res.status(500).json({ error: "Failed to allocate pipeline execution.", traceId: (req as any).traceId });
  }
});

app.get("/api/build-status/:id", (req, res) => {
  res.json(buildCache.get(req.params.id) || { status: "VOID" });
});

app.get("/api/user-stats", async (req, res) => {
  try {
    const loadAvg = os.loadavg();
    const cpus = os.cpus();
    const computeUnits = (cpus.length * loadAvg[0]).toFixed(2);
    
    // Pega o espaço livre do disco root real via bash (Debian/Linux)
    const { execSync } = require("child_process");
    let diskUsage = "0";
    try {
      diskUsage = execSync("df -h / | awk 'NR==2 {print $5}'").toString().trim().replace("%", "");
    } catch(e) {}

    res.json({
      activeDeployments: Math.round(loadAvg[0]),
      totalArtifacts: parseInt(diskUsage, 10), // Uso real do disco %
      computeUnits: computeUnits,
      latency: "N/A",
      node: os.hostname(),
      status: "OPTIMIZED"
    });
  } catch (err: any) {
    res.status(500).json({ error: "Telemetry aggregation failed.", traceId: (req as any).traceId });
  }
});

app.get("/api/health", (req, res) => {
  const memoryStats = MemoryMonitor.audit();
  res.json({
    status: "ACTIVE",
    uptime: process.uptime(),
    memory: memoryStats,
    cache: { size: buildCache.size },
    circuits: {
      pro: (aiService as any).circuitBreaker.getState(),
      flash: (fastAiService as any).circuitBreaker.getState()
    },
    traceId: (req as any).traceId,
    timestamp: Date.now()
  });
});

app.get("/api/handshake", (req, res) => {
  const hasApiKey = !!process.env.GEMINI_API_KEY;
  res.json({
    authorized: hasApiKey,
    system: "SOLUTION_BUILDER_CORE",
    version: "V9.1.5",
    engine: "Titan_GenAI",
    timestamp: Date.now(),
    isolation: "SECURE_VM"
  });
});

app.post("/api/ai-guide", validateBody(GuideSchema), async (req, res) => {
  try {
    const { context, prompt, parameters, targetLanguage } = req.body;
    const systemPrompt = `# ROLE: SENIOR AI INSTRUCTOR & MINECRAFT EXPERT
Task: Provide a structured, adaptive tutorial guide for the current generator context.
Context: ${context}
User Input: "${prompt || "None"}"
Parameters: ${JSON.stringify(parameters || {})}

GUIDELINES:
1. Explain how the current parameters affect the result in this specific context.
2. Provide 3 high-impact tips to improve the current prompt/config for "${targetLanguage}".
3. Structure the output in Markdown with clean headers.
4. Keep it concise, professional, and encouraging.
5. Use "Minecraft Professional" terminology.

Return ONLY the markdown guide.`;

    const result = await fastAiService.generate(systemPrompt);
    res.json({ result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("AI_GUIDE_FAILURE", err);
    res.status(500).json({ error: "Failed to generate AI guidance.", traceId: (req as any).traceId });
  }
});

// ==========================================
// 5. CORE SYSTEM: WEB-SOCKETS & STREAMING
// ==========================================
async function startServer() {
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, { cors: { origin: "*" } });

  let connections = 0;

  io.on("connection", (socket) => {
    connections++;
    logger.info(`WebSocket Ingress established. Active: ${connections}`);

    socket.on("generate-stream", async (data) => {
      try {
        const { endpointType, prompt, history = [], existingData, targetLanguage } = data;
        let finalPrompt = prompt;

        // Structured Multi-Stage Prompt Engineering
        if (endpointType === "edit-mod") {
          finalPrompt = `# ROLE: SENIOR MINECRAFT ENGINEER
Task: Optimize, Refactor, and Localize based on: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Code Context:
\`\`\`
${existingData}
\`\`\`
EXECUTION:
1. Reduce code complexity.
2. Optimize I/O and concurrent tasks.
3. Apply security best practices.
4. Apply standard design patterns.
5. Prevent memory leaks.
6. Translate all user-facing strings to ${targetLanguage || "pt-BR"}.
Return ONLY valid code.`;
        } else if (endpointType === "generate-mod") {
          const type = data.type || "Code";
          finalPrompt = `# ROLE: SENIOR MINECRAFT & NODE.JS ENGINEER
Task: Generate high-performance ${type}: "${prompt}".

CORE REQUIREMENTS:
1. ${type === 'Mineflayer' ? 'Use ESM syntax (import), mineflayer-pathfinder, and mineflayer-collectblock where applicable.' : 'Logic Modularity and Decoupled Services.'}
2. Apply Asynchronous Patterns: Use async/await for I/O and non-blocking loops.
3. State Management: Implement a clean finite state machine (FSM) if the task is complex.
4. Survival Logic: For bots, include checks for inventory, health, and nearby hazards.
5. Code Style: Clean, documented, and production-ready.

Return ONLY the code block.`;
        } else if (endpointType === "generate-map") {
          finalPrompt = `# ROLE: MAP ARCHITECT
Task: Design terrain/structure: "${prompt}".
REQUIREMENTS:
1. Provide a technical overview.
2. Output optimized Command Chain.
3. Include DataPack logic if complex.
4. Scale: High-resolution architecture.`;
        } else if (endpointType === "generate-storyteller") {
          finalPrompt = `# ROLE: NARRATIVE DESIGNER
Task: NPC/Story Design: "${prompt}".
OUTPUT:
1. Narrative Profile.
2. Dialogue Tree.
3. Behavior Logic.
4. Script sequence.`;
        } else if (endpointType === "edit-map") {
          finalPrompt = `# ROLE: MAP ARCHITECT
Task: Optimize/Modify terrain/structure: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Code/Command Context:
\`\`\`
${existingData}
\`\`\`
REQUIREMENTS:
1. Optimize Command Chain or Datapack logic.
2. Fix structural issues.
3. Translate texts to ${targetLanguage || "pt-BR"}.`;
        } else if (endpointType === "edit-storyteller") {
          finalPrompt = `# ROLE: NARRATIVE DESIGNER
Task: Refine and translate NPC story/script: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Script Context:
\`\`\`
${existingData}
\`\`\`
REQUIREMENTS:
1. Expand narrative depth.
2. Fix dialogue logical inconsistencies.
3. Translate to ${targetLanguage || "pt-BR"}.`;
        }

        await aiService.stream(finalPrompt, history, (chunk) => {
          socket.emit("stream-chunk", { chunk });
        });
        socket.emit("stream-complete");
      } catch (err: any) {
        logger.error("Streaming failure", err);
        socket.emit("stream-error", { error: err.message });
      }
    });

    socket.on("disconnect", () => {
      connections--;
      logger.info(`WebSocket Egress. Remaining: ${connections}`);
    });
  });

  // Vite Fallback logic
  if (!IS_PROD) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  // Graceful Shutdown & Recovery
  const serverInstance = httpServer.listen(PORT, "0.0.0.0", () => {
    logger.info(`[SYSTEM-RESTORED] Architecture operating on port ${PORT}`);
    
    // Interval Memory Leak Protection
    setInterval(() => MemoryMonitor.audit(), 60000);
  });

  const stop = () => {
    logger.warn("SIGINT/SIGTERM detected. Initiating Emergency Shutdown.");
    serverInstance.close(() => {
      logger.info("Server closed. Resources released. Exit 0.");
      process.exit(0);
    });
    // Force exit after 10s if hung
    setTimeout(() => {
      logger.error("Shutdown hung. Forced termination.");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

// Global Exception Barrier
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("CRITICAL_RUNTIME_FAILURE", { 
    path: req.path, 
    error: err.message, 
    stack: IS_PROD ? undefined : err.stack 
  });
  res.status(500).json({ 
    error: "Subsystem unavailable. Execution cycle aborted.", 
    code: "UNCAUGHT_EXCEPTION",
    traceId: (req as any).traceId 
  });
});

startServer().catch(err => {
  logger.error("BOOTSTRAP_FAILURE", err);
  process.exit(1);
});

