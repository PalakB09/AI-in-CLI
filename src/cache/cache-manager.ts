import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
import { OS } from "../types";

interface CacheEntry {
  response: string;
  timestamp: number;
  expiresAt: number;
}

export class CacheManager {
  private cachePath: string;
  private cacheDuration: number; // in milliseconds, default 1 hour

  constructor(cacheDurationMs: number = 60 * 60 * 1000) {
    this.cachePath = path.join(require('os').homedir(), ".ai-cli", "cache.json");
    this.cacheDuration = cacheDurationMs;
  }

  private getCacheKey(input: string, os: OS): string {
    const data = `${input}|${os.platform}|${os.arch}|${os.shell || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async get(input: string, os: OS): Promise<string | null> {
    try {
      if (!await fs.pathExists(this.cachePath)) return null;

      const cache = await fs.readJson(this.cachePath);
      const key = this.getCacheKey(input, os);
      const entry: CacheEntry = cache[key];

      if (!entry) return null;

      if (Date.now() > entry.expiresAt) {
        delete cache[key];
        await fs.writeJson(this.cachePath, cache);
        return null;
      }

      return entry.response;
    } catch (error) {
      console.warn("Cache read error:", error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  async set(input: string, os: OS, response: string): Promise<void> {
    try {
      const cache = (await fs.pathExists(this.cachePath)) ? await fs.readJson(this.cachePath) : {};
      const key = this.getCacheKey(input, os);
      cache[key] = {
        response,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.cacheDuration,
      };
      await fs.writeJson(this.cachePath, cache);
    } catch (error) {
      console.warn("Cache write error:", error instanceof Error ? error.message : String(error));
    }
  }

  async clear(): Promise<void> {
    try {
      if (await fs.pathExists(this.cachePath)) {
        await fs.remove(this.cachePath);
      }
    } catch (error) {
      console.warn("Cache clear error:", error instanceof Error ? error.message : String(error));
    }
  }
}