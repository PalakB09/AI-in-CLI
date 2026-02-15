import { ResolvedCommand, OS } from '../types';
import { AIService } from '../core/ai-service';
import { StorageManager } from '../storage/storage-manager';
import { PluginManager } from '../plugins/plugin-manager';

export class CommandResolver {
  private aiService: AIService;
  private storage: StorageManager;
  private pluginManager: PluginManager;
  private initialized = false;

  constructor(aiService: AIService, pluginManager: PluginManager) {
    this.aiService = aiService;
    this.storage = new StorageManager();
    this.pluginManager = pluginManager;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.pluginManager.init();
  }

  async resolve(
    input: string,
    os: OS,
    learningMode: boolean = false,
    suggestMode: boolean = false
  ): Promise<ResolvedCommand | null> {
    await this.init();

    const rawInput = input.trim();
    const matchInput = rawInput.toLowerCase();
    const wantsMultiple =
      /\bthen\b|\band\b|\bafter that\b|\bfollowed by\b/i.test(matchInput);

    // Priority 1: Plugin rules
    const pluginResult = this.pluginManager.getRules(matchInput, os);
    if (pluginResult) {
      return { ...pluginResult, source: 'rule' };
    }

    // Priority 2: Vault lookup (skip in suggest mode)
    if (!suggestMode) {
      const vaultResult = await this.searchVault(matchInput);
      if (vaultResult) {
        return { ...vaultResult, source: 'vault' };
      }
    }

    // Priority 3: Rules for single-step commands
    if (!wantsMultiple) {
      const ruleResult = this.applyRules(matchInput, os);
      if (ruleResult) {
        return { ...ruleResult, source: 'rule' };
      }
    }

    // Priority 4: AI (single call only)
    return await this.aiService.generateCommand(
      rawInput,
      os,
      learningMode
    );
  }

  private async searchVault(input: string): Promise<ResolvedCommand | null> {
    try {
      const results = await this.storage.searchCommands(input);
      if (!results.length) return null;

      const best = results[0];
      if (best.confidence < 0.6) return null;

      return {
        commands: best.commands,
        explanation: best.description,
        tags: best.tags,
        confidence: best.confidence,
        source: 'vault',
        variables: best.variables,
      };
    } catch {
      return null;
    }
  }

  private applyRules(input: string, os: OS): ResolvedCommand | null {
    // File listing
    if (input.includes('list files') || input.includes('show files') || input === 'ls') {
      return {
        commands: [os.platform === 'windows' ? 'dir' : 'ls -la'],
        explanation: 'List files and directories',
        tags: ['filesystem'],
        confidence: 0.9,
        source: 'rule',
      };
    }

    // Create directory
    if (input.includes('create folder') || input.includes('make directory')) {
      return {
        commands: [os.platform === 'windows' ? 'mkdir' : 'mkdir -p'],
        explanation: 'Create a directory',
        tags: ['filesystem'],
        confidence: 0.9,
        source: 'rule',
      };
    }

    // Show processes
    if (input.includes('list processes') || input === 'ps') {
      return {
        commands: [os.platform === 'windows' ? 'tasklist' : 'ps aux'],
        explanation: 'List running processes',
        tags: ['process'],
        confidence: 0.9,
        source: 'rule',
      };
    }

    // Git status
    if (input.includes('git status') || input.includes('check git')) {
      return {
        commands: ['git status'],
        explanation: 'Show git working tree status',
        tags: ['git'],
        confidence: 0.95,
        source: 'rule',
      };
    }

    return null;
  }
}
