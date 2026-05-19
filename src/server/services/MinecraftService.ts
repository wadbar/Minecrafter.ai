import mineflayer from 'mineflayer';
import { logger } from '../infrastructure/Logger';

export interface MinecraftCredentials {
  host: string;
  port: number;
  username: string;
  password?: string;
  auth?: 'mojang' | 'microsoft' | 'offline';
}

/**
 * Minecraft_Integration_Service (The Bridge)
 * Orchestrates connection and command execution sequences within a remote 
 * Minecraft ecosystem via automated headless agents (Mineflayer).
 */
export class MinecraftService {
  async executeCommands(credentials: MinecraftCredentials, commands: string[]): Promise<{ success: boolean; logs: string[] }> {
    return new Promise((resolve) => {
      logger.info(`Initiating deployment link to ${credentials.host}:${credentials.port} for user ${credentials.username}`);
      
      const bot = mineflayer.createBot({
        host: credentials.host,
        port: credentials.port,
        username: credentials.username,
        password: credentials.password,
        auth: credentials.auth || 'offline',
        // Support modern versions
        version: undefined, // Auto-detect
      });

      const logs: string[] = [];
      let isFinalized = false;

      const finalize = (success: boolean, message?: string) => {
        if (isFinalized) return;
        isFinalized = true;
        if (message) logs.push(message);
        bot.quit();
        resolve({ success, logs });
      };

      bot.once('spawn', async () => {
        logs.push(`Successfully established handshake with ${credentials.host}:${credentials.port}`);
        
        try {
          for (const cmd of commands) {
            const cleanCmd = cmd.trim();
            if (cleanCmd) {
              // Ensure command has leading slash for Bukkit/Vanilla consistency
              const finalCmd = cleanCmd.startsWith('/') ? cleanCmd : `/${cleanCmd}`;
              bot.chat(finalCmd);
              logs.push(`[EXEC_LOG]: ${finalCmd}`);
              // Propagation delay to avoid buffer overflow on paper/spigot
              await new Promise(r => setTimeout(r, 250));
            }
          }
          finalize(true, "Deployment sequence completed successfully.");
        } catch (e: any) {
          logger.error("COMMAND_SEQUENCE_ABORTED", e);
          finalize(false, `Execution failure: ${e.message}`);
        }
      });

      bot.on('error', (err: any) => {
        logger.error('MINECRAFT_BOT_CRITICAL', err);
        finalize(false, `Connection failure: ${err.code || err.message}`);
      });

      bot.on('kicked', (reason: string) => {
        const kickReason = typeof reason === 'string' ? reason : JSON.stringify(reason);
        logger.warn('MINECRAFT_BOT_KICKED', { reason: kickReason });
        finalize(false, `Connection dropped (Kick): ${kickReason}`);
      });

      // Watchdog Timer (30s)
      setTimeout(() => {
        if (!isFinalized) {
          logger.warn("DEPLOYMENT_WATCHDOG_TIMEOUT", { host: credentials.host });
          finalize(false, "System timeout: The handshake took too long to synchronize.");
        }
      }, 30000);
    });
  }
}

export const minecraftService = new MinecraftService();
