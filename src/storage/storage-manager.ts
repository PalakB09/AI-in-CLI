import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CommandEntry } from '../types';
import { randomUUID } from 'crypto';

export class StorageManager {
  private readonly dataDir: string;
  private readonly vaultPath: string;
  private readonly metadataPath: string;
  private initialized = false;

  constructor() {
    this.dataDir = path.join(os.homedir(), '.ai-cli');
    this.vaultPath = path.join(this.dataDir, 'vault.json');
    this.metadataPath = path.join(this.dataDir, 'metadata.json');
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await fs.ensureDir(this.dataDir);

    if (!(await fs.pathExists(this.vaultPath))) {
      await fs.writeJson(this.vaultPath, [], { spaces: 2 });
    }

    if (!(await fs.pathExists(this.metadataPath))) {
      await fs.writeJson(
        this.metadataPath,
        {
          version: '1.0.0',
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          totalCommands: 0,
        },
        { spaces: 2 }
      );
    }
  }

  /* -------------------- CORE -------------------- */

  async getAllCommands(): Promise<CommandEntry[]> {
    await this.init();
    const data = await fs.readJson(this.vaultPath);
    return data.map((cmd: CommandEntry) => this.reviveDates(cmd));
  }

  async addCommand(
    commands: string | string[],
    description?: string,
    tags: string[] = [],
    source: 'rule' | 'ai' | 'user' = 'user',
    confidence: number = 0.7,
    variables?: { [key: string]: string },
    name?: string
  ): Promise<void> {
    await this.init();

    const list = await this.getAllCommands();
    const cmdArray = Array.isArray(commands) ? commands : [commands];

    const newEntry: CommandEntry = {
      id: randomUUID(),
      name,
      commands: cmdArray.map(c => c.trim()),
      description: description || `Command: ${cmdArray.join('; ')}`,
      tags,
      usageCount: 0,
      lastUsed: new Date(),
      createdAt: new Date(),
      confidence,
      source,
      variables,
    };

    const existing = list.find(
      c =>
        c.commands.join(';').toLowerCase() ===
        newEntry.commands.join(';').toLowerCase()
    );

    if (existing) {
      existing.usageCount++;
      existing.lastUsed = new Date();
      if (description) existing.description = description;
      if (name) existing.name = name;
      if (variables) existing.variables = variables;
    } else {
      list.push(newEntry);
    }

    await this.saveCommands(list);
    await this.updateMetadata(list.length);
  }

  /* -------------------- SEARCH -------------------- */

  async searchCommands(query: string, limit = 10): Promise<CommandEntry[]> {
    const commands = await this.getAllCommands();
    const q = query.toLowerCase().trim();

    const scored = commands
      .map(cmd => ({
        ...cmd,
        score: this.calculateRelevanceScore(cmd, q),
      }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored;
  }

  private calculateRelevanceScore(
    command: CommandEntry,
    query: string
  ): number {
    let score = 0;

    if (command.commands.join(' ').toLowerCase().includes(query)) {
      score += 100;
    }

    if (command.description.toLowerCase().includes(query)) {
      score += 50;
    }

    command.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) score += 25;
    });

    score += Math.min(command.usageCount * 5, 50);

    const days =
      (Date.now() - command.lastUsed.getTime()) /
      (1000 * 60 * 60 * 24);

    if (days < 7) score += 10;
    else if (days < 30) score += 5;

    score += command.confidence * 10;

    return score;
  }

  /* -------------------- UTIL -------------------- */

  async incrementUsage(id: string): Promise<void> {
    const commands = await this.getAllCommands();
    const cmd = commands.find(c => c.id === id);
    if (!cmd) return;

    cmd.usageCount++;
    cmd.lastUsed = new Date();
    await this.saveCommands(commands);
  }

  async deleteCommand(id: string): Promise<void> {
    const cmds = (await this.getAllCommands()).filter(c => c.id !== id);
    await this.saveCommands(cmds);
    await this.updateMetadata(cmds.length);
  }

  async clearVault(): Promise<void> {
    await this.init();
    await fs.writeJson(this.vaultPath, [], { spaces: 2 });
    await this.updateMetadata(0);
  }

  /* -------------------- INTERNAL -------------------- */

  private reviveDates(cmd: CommandEntry): CommandEntry {
    return {
      ...cmd,
      lastUsed: new Date(cmd.lastUsed),
      createdAt: new Date(cmd.createdAt),
    };
  }

  private async saveCommands(commands: CommandEntry[]): Promise<void> {
    await fs.writeJson(this.vaultPath, commands, { spaces: 2 });
  }

  private async updateMetadata(totalCommands: number): Promise<void> {
    const meta = await fs.readJson(this.metadataPath);
    meta.lastUpdated = new Date().toISOString();
    meta.totalCommands = totalCommands;
    await fs.writeJson(this.metadataPath, meta, { spaces: 2 });
  }
}
