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
  private readonly cachePath: string;
  private readonly cacheDuration: number;
  private readonly maxEntries = 500;

  constructor(cacheDurationMs: number = 60 * 60 * 1000) {
    this.cachePath = path.join(
      require("os").homedir(),
      ".ai-cli",
      "cache.json"
    );
    this.cacheDuration = cacheDurationMs;
  }

  private async ensureCacheDir(): Promise<void> {
    await fs.ensureDir(path.dirname(this.cachePath));
  }

  private getCacheKey(
    input: string,
    os: OS,
    learningMode: boolean,
    model: string = "gemini-2.5-flash",
    promptVersion: string = "v1"
  ): string {
    const data = [
      input,
      os.platform,
      os.arch,
      os.shell ?? "",
      learningMode ? "learning" : "normal",
      model,
      promptVersion,
    ].join("|");

    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async get(
    input: string,
    os: OS,
    learningMode: boolean
  ): Promise<string | null> {
    try {
      if (!(await fs.pathExists(this.cachePath))) return null;

      const cache = await fs.readJson(this.cachePath);
      const key = this.getCacheKey(input, os, learningMode);
      const entry: CacheEntry | undefined = cache[key];

      if (!entry) return null;

      if (Date.now() > entry.expiresAt) {
        delete cache[key];
        await this.writeCache(cache);
        return null;
      }

      return entry.response;
    } catch {
      return null;
    }
  }

  async set(
    input: string,
    os: OS,
    learningMode: boolean,
    response: string
  ): Promise<void> {
    try {
      await this.ensureCacheDir();

      const cache = (await fs.pathExists(this.cachePath))
        ? await fs.readJson(this.cachePath)
        : {};

      const key = this.getCacheKey(input, os, learningMode);

      cache[key] = {
        response,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.cacheDuration,
      };

      this.evictOldEntries(cache);
      await this.writeCache(cache);
    } catch {
      // Silent fail — cache must never break CLI
    }
  }

  async clear(): Promise<void> {
    try {
      if (await fs.pathExists(this.cachePath)) {
        await fs.remove(this.cachePath);
      }
    } catch {
      // Ignore
    }
  }

  private evictOldEntries(cache: Record<string, CacheEntry>): void {
    const keys = Object.keys(cache);
    if (keys.length <= this.maxEntries) return;

    keys
      .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
      .slice(0, keys.length - this.maxEntries)
      .forEach(k => delete cache[k]);
  }

  private async writeCache(cache: Record<string, CacheEntry>): Promise<void> {
    const tmpPath = this.cachePath + ".tmp";
    await fs.writeJson(tmpPath, cache);
    await fs.move(tmpPath, this.cachePath, { overwrite: true });
  }
}
