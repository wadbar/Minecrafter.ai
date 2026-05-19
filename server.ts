import express, { Request, Response, NextFunction } from "express";
import path from "path";
import http from "http";
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
    
    return {
      used: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
      load: `${Math.round(ratio * 100)}%`
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
      title: "PAPERCREEPER SERVICE API",
      version: "9.5.0",
      description: "Advanced Logic Execution Layer for Minecraft Ecosystem.",
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

/**
 * @swagger
 * /api/generate-mod:
 *   post:
 *     summary: AI Mod Generation
 */
app.post("/api/generate-mod", validateBody(CommonSchema), async (req, res) => {
  try {
    const result = await aiService.generate(`Expert Minecraft ${req.body.type} developer task: ${req.body.prompt}. Apply SOLID and Clean Code. Return ONLY code.`);
    res.json({ result, traceId: (req as any).traceId });
  } catch (err: any) {
    logger.error("MOD_GEN_FAILURE", err);
    res.status(500).json({ error: "Execution error during mod synthesis.", traceId: (req as any).traceId });
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
  const { prompt, width, height, aspectRatio } = req.body;
  let finalAspectRatio = aspectRatio || "1:1";
  
  if (!aspectRatio && width && height) {
    const ratio = width / height;
    if (ratio > 1.5) finalAspectRatio = "16:9";
    else if (ratio > 1.1) finalAspectRatio = "4:3";
    else if (ratio > 0.9) finalAspectRatio = "1:1";
    else if (ratio > 0.6) finalAspectRatio = "3:4";
    else finalAspectRatio = "9:16";
  }

  const result = await fastAiService.generateImage(`Minecraft ${width || 16}x${height || 16} pixel art texture of ${prompt}. Very blocky, pixelated, raw game asset style. No background.`, finalAspectRatio);
  res.json({ result, traceId: (req as any).traceId });
});

app.post("/api/generate-skin", validateBody(CommonSchema), async (req, res) => {
  const result = await aiService.generateImage(`Minecraft 64x64 skin template texture for ${req.body.prompt}. Traditional minecraft skin layout.`);
  res.json({ result, traceId: (req as any).traceId });
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
app.post("/api/build-pipeline", (req, res) => {
  const { artifactId } = req.body;
  buildCache.set(artifactId, { status: "PROCESSING", timestamp: Date.now() });
  setTimeout(() => buildCache.set(artifactId, { status: "SUCCESS", url: `https://v2.cdn.minecrafter.ai/${artifactId}.jar` }), 5000);
  res.json({ message: "Build Triggered", artifactId });
});

app.get("/api/build-status/:id", (req, res) => {
  res.json(buildCache.get(req.params.id) || { status: "VOID" });
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
    traceId: (req as any).traceId
  });
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

        // Structured Multi-Stage Prompt Engineering (The Creator)
        if (endpointType === "edit-mod") {
          finalPrompt = `# ROLE: SUPREME MINECRAFT ENGINEER (CTO LEVEL)
Task: Optimize, Refactor, and Localize based on: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Code Context:
\`\`\`
${existingData}
\`\`\`
EXECUTION (APPLY 2024 OPTIMIZATION BEST PRACTICES):
1. Reduce cyclomatic complexity.
2. Eliminate redundant I/O and synchronous database calls.
3. Harden security (Input validation).
4. Apply SOLID & Clean Architecture.
5. Prevent memory leaks (avoid lingering event listeners).
6. Translate and localize all user-facing strings strictly to ${targetLanguage || "pt-BR"}.
Return ONLY valid code.`;
        } else if (endpointType === "generate-mod") {
          finalPrompt = `# ROLE: LEAD ARCHITECT (NEXUS MATRIX)
Task: Generate high-performance Minecraft ${data.type || "Code"}: "${prompt}".
SPECS (2024 OPTIMIZATION STANDARDS): 
- Framework: Forge/Fabric/Paper (Auto-detect from prompt).
- Pattern: Enterprise Logic, Modularity, and Decoupled Services.
- Optimization: O(n) reduction, memory leakage protection.
- Threading: Ensure database and I/O tasks are executed asynchronously (e.g. BukkitRunnable/Async).
- Event Handling: Never block the main Server thread.
- Documentation: Javadoc/TSDoc header included.
Return ONLY valid, compilation-ready code block.`;
        } else if (endpointType === "generate-map") {
          finalPrompt = `# ROLE: MASTER MAP ARCHITECT
Task: Design terrain/structure architecture: "${prompt}".
REQUIREMENTS:
1. Provide a structural technical overview.
2. Output optimized Command Chain (/fill, /setblock, /clone).
3. Include DataPack logic if complex.
4. Scale: Industrial / Megastructure resolution.`;
        } else if (endpointType === "generate-storyteller") {
          finalPrompt = `# ROLE: NARRATIVE DESIGNER & AI SCRIPTWRITER
Task: Advanced NPC/Story Architecture: "${prompt}".
OUTPUT:
1. Psychological Profile.
2. 5-Tier Dialogue Tree (Conditional).
3. Behavior State Machine.
4. Citizens/Denizen Script sequence.`;
        } else if (endpointType === "edit-map") {
          finalPrompt = `# ROLE: MASTER MAP ARCHITECT
Task: Optimize/Modify terrain/structure architecture based on: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Code/Command Context:
\`\`\`
${existingData}
\`\`\`
REQUIREMENTS:
1. Optimize Command Chain or Datapack logic.
2. Fix structural bugs.
3. Translate texts/signs to ${targetLanguage || "pt-BR"}.`;
        } else if (endpointType === "edit-storyteller") {
          finalPrompt = `# ROLE: NARRATIVE DESIGNER & AI SCRIPTWRITER
Task: Refine and translate NPC story/script based on: "${prompt}".
Target Language: ${targetLanguage || "pt-BR"}
Script Context:
\`\`\`
${existingData}
\`\`\`
REQUIREMENTS:
1. Expand narrative depth.
2. Fix dialogue logical inconsistencies.
3. Translate fully to ${targetLanguage || "pt-BR"}.`;
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

