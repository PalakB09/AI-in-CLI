import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CommandEntry } from '../types';

export class StorageManager {
  private readonly dataDir: string;
  private readonly vaultPath: string;
  private readonly metadataPath: string;

  constructor() {
    this.dataDir = path.join(os.homedir(), '.ai-cli');
    this.vaultPath = path.join(this.dataDir, 'vault.json');
    this.metadataPath = path.join(this.dataDir, 'metadata.json');
    
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    await fs.ensureDir(this.dataDir);
    
    // Initialize vault file if it doesn't exist
    if (!await fs.pathExists(this.vaultPath)) {
      await fs.writeJson(this.vaultPath, [], { spaces: 2 });
    }

    // Initialize metadata file if it doesn't exist
    if (!await fs.pathExists(this.metadataPath)) {
      await fs.writeJson(this.metadataPath, {
        version: '1.0.0',
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totalCommands: 0
      }, { spaces: 2 });
    }
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
    const commandList = await this.getAllCommands();
    
    const cmdArray = Array.isArray(commands) ? commands : [commands];
    
    const newEntry: CommandEntry = {
      id: this.generateId(),
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

    // Check for duplicates
    const existingIndex = commandList.findIndex((cmd: CommandEntry) => 
      cmd.commands.join(';').toLowerCase() === newEntry.commands.join(';').toLowerCase()
    );

    if (existingIndex >= 0) {
      // Update existing entry
      commandList[existingIndex].usageCount++;
      commandList[existingIndex].lastUsed = new Date();
      commandList[existingIndex].description = description || commandList[existingIndex].description;
      if (name) commandList[existingIndex].name = name;
      if (variables) commandList[existingIndex].variables = variables;
    } else {
      // Add new entry
      commandList.push(newEntry);
    }

    await this.saveCommands(commandList);
    await this.updateMetadata(commands.length);
  }
  private reviveDates(cmd: CommandEntry): CommandEntry {
  return {
    ...cmd,
    lastUsed: new Date(cmd.lastUsed),
    createdAt: new Date(cmd.createdAt)
  };
}


  async getAllCommands(): Promise<CommandEntry[]> {
  const data = await fs.readJson(this.vaultPath);
  return data.map((cmd: CommandEntry) => this.reviveDates(cmd));
  }


  async searchCommands(query: string, limit: number = 10): Promise<CommandEntry[]> {
    const commands = await this.getAllCommands();
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      // Return most frequently used commands
      return commands
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
    }

    const results = commands
      .map(cmd => ({
        ...cmd,
        score: this.calculateRelevanceScore(cmd, normalizedQuery)
      }))
      .filter(cmd => cmd.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  private calculateRelevanceScore(command: CommandEntry, query: string): number {
    let score = 0;
    
    // Exact command match
    if (command.commands.join(' ').toLowerCase().includes(query)) {
      score += 100;
    }

    // Description match
    if (command.description.toLowerCase().includes(query)) {
      score += 50;
    }

    // Tag matches
    command.tags.forEach(tag => {
      if (tag.toLowerCase().includes(query)) {
        score += 25;
      }
    });

    // Usage frequency boost
    score += command.usageCount * 5;

    // Recency boost (commands used recently get a boost)
    const daysSinceLastUsed = (Date.now() - command.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastUsed < 7) {
      score += 10;
    } else if (daysSinceLastUsed < 30) {
      score += 5;
    }

    // Confidence boost
    score += command.confidence * 10;

    return score;
  }

  async getCommandsByTag(tag: string): Promise<CommandEntry[]> {
    const commands = await this.getAllCommands();
    return commands.filter(cmd => 
      cmd.tags.some(t => t.toLowerCase() === tag.toLowerCase())
    );
  }

  async getCommandsBySource(source: 'rule' | 'ai' | 'user'): Promise<CommandEntry[]> {
    const commands = await this.getAllCommands();
    return commands.filter(cmd => cmd.source === source);
  }

  async getCommandByName(name: string): Promise<CommandEntry | null> {
    const commands = await this.getAllCommands();
    return commands.find(cmd => cmd.name === name) || null;
  }

  async updateCommandUsage(commandId: string): Promise<void> {
    const commands = await this.getAllCommands();
    const command = commands.find(cmd => cmd.id === commandId);
    
    if (command) {
      command.usageCount++;
      command.lastUsed = new Date();
      await this.saveCommands(commands);
    }
  }

  async deleteCommand(commandId: string): Promise<void> {
    const commands = await this.getAllCommands();
    const filteredCommands = commands.filter(cmd => cmd.id !== commandId);
    await this.saveCommands(filteredCommands);
    await this.updateMetadata(filteredCommands.length);
  }

  async clearVault(): Promise<void> {
    await fs.writeJson(this.vaultPath, [], { spaces: 2 });
    await this.updateMetadata(0);
  }

  async exportVault(filePath: string): Promise<void> {
    const commands = await this.getAllCommands();
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      commands
    };

    await fs.writeJson(filePath, exportData, { spaces: 2 });
  }

  async importVault(filePath: string): Promise<void> {
    if (!await fs.pathExists(filePath)) {
      throw new Error('Import file does not exist');
    }

    const importData = await fs.readJson(filePath);
    
    if (!importData.commands || !Array.isArray(importData.commands)) {
      throw new Error('Invalid import file format');
    }

    const existingCommands = await this.getAllCommands();
    const mergedCommands = [...existingCommands];

    for (const importedCmd of importData.commands) {
      // Check for duplicates by command string
      const existingIndex = mergedCommands.findIndex((cmd: CommandEntry) => 
        cmd.commands.join(';').toLowerCase() === (importedCmd.commands || [importedCmd.command]).join(';').toLowerCase()
      );

      if (existingIndex >= 0) {
        // Merge usage statistics
        mergedCommands[existingIndex].usageCount += importedCmd.usageCount || 0;
        mergedCommands[existingIndex].tags = [...new Set([
          ...mergedCommands[existingIndex].tags,
          ...(importedCmd.tags || [])
        ])];
      } else {
        // Add as new command with generated ID
        const cmdArray = importedCmd.commands || (importedCmd.command ? [importedCmd.command] : []);
        mergedCommands.push({
          id: this.generateId(),
          commands: cmdArray,
          description: importedCmd.description || `Command: ${cmdArray.join('; ')}`,
          tags: importedCmd.tags || [],
          usageCount: importedCmd.usageCount || 0,
          lastUsed: new Date(importedCmd.lastUsed) || new Date(),
          createdAt: new Date(importedCmd.createdAt) || new Date(),
          confidence: importedCmd.confidence || 0.7,
          source: importedCmd.source || 'user',
          variables: importedCmd.variables
        });
      }
    }

    await this.saveCommands(mergedCommands);
    await this.updateMetadata(mergedCommands.length);
  }

  private async saveCommands(commands: CommandEntry[]): Promise<void> {
    await fs.writeJson(this.vaultPath, commands, { spaces: 2 });
  }

  private async updateMetadata(totalCommands: number): Promise<void> {
    const metadata = await fs.readJson(this.metadataPath);
    metadata.lastUpdated = new Date().toISOString();
    metadata.totalCommands = totalCommands;
    await fs.writeJson(this.metadataPath, metadata, { spaces: 2 });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getStatistics(): Promise<{
    totalCommands: number;
    totalUsage: number;
    topCommands: CommandEntry[];
    tagDistribution: Record<string, number>;
    sourceDistribution: Record<string, number>;
  }> {
    const commands = await this.getAllCommands();
    
    const totalCommands = commands.length;
    const totalUsage = commands.reduce((sum, cmd) => sum + cmd.usageCount, 0);
    
    const topCommands = commands
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    const tagDistribution: Record<string, number> = {};
    commands.forEach(cmd => {
      cmd.tags.forEach(tag => {
        tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
      });
    });

    const sourceDistribution: Record<string, number> = {};
    commands.forEach(cmd => {
      sourceDistribution[cmd.source] = (sourceDistribution[cmd.source] || 0) + 1;
    });

    return {
      totalCommands,
      totalUsage,
      topCommands,
      tagDistribution,
      sourceDistribution
    };
  }

  async incrementUsage(id: string): Promise<void> {
    const commands = await this.getAllCommands();
    const index = commands.findIndex(cmd => cmd.id === id);
    if (index >= 0) {
      commands[index].usageCount++;
      commands[index].lastUsed = new Date();
      await this.saveCommands(commands);
    }
  }
}