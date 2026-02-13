import { ResolvedCommand, OS } from '../types';
import { AIService } from '../core/ai-service';
import { StorageManager } from '../storage/storage-manager';

export class CommandResolver {
  private aiService: AIService;
  private storage: StorageManager;

  constructor(aiService: AIService) {
  this.aiService = aiService;
  this.storage = new StorageManager();
}


  async resolve(input: string, os: OS): Promise<ResolvedCommand | null> {
    const normalizedInput = input.toLowerCase().trim();
    const wantsMultiple = /\bthen\b|\band\b|\bafter that\b|\bfollowed by\b/i.test(input);

    // Priority 1: Check command vault first
    const vaultResult = await this.searchVault(normalizedInput);
    if (vaultResult) {
      return { ...vaultResult, source: 'vault' };
    }

    if (wantsMultiple) {
      // Priority 2: Use AI for multi-step requests
      const aiResult = await this.aiService.generateCommand(input, os);
      if (aiResult) {
        return { ...aiResult, source: 'ai' };
      }
    } else {
      // Priority 2: Apply rule-based mappings for single commands
      const ruleResult = this.applyRules(normalizedInput, os);
      if (ruleResult) {
        return { ...ruleResult, source: 'rule' };
      }
    }

    // Priority 3: Use AI fallback
    const aiResult = await this.aiService.generateCommand(input, os);
    if (aiResult) {
      return { ...aiResult, source: 'ai' };
    }

    return null;
  }

  private async searchVault(input: string): Promise<ResolvedCommand | null> {
    try {
      const commands = await this.storage.searchCommands(input);
      if (commands.length > 0) {
        const bestMatch = commands[0]; // Assumes storage sorts by relevance
        return {
          commands: [bestMatch.command],
          explanation: bestMatch.description,
          tags: bestMatch.tags,
          confidence: bestMatch.confidence,
          source: 'vault'
        };
      }
    } catch (error) {
      // Continue to next resolution method
    }
    return null;
  }

  private applyRules(input: string, os: OS): ResolvedCommand | null {
    // File system operations
    if (input.includes('list files') || input.includes('show files') || input.includes('ls')) {
      const command = os.platform === 'windows' ? 'dir' : 'ls -la';
      return {
        commands: [command],
        explanation: `List all files and directories with details`,
        tags: ['filesystem', 'list'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('create folder') || input.includes('make directory') || input.includes('mkdir')) {
      const command = os.platform === 'windows' ? 'mkdir' : 'mkdir -p';
      return {
        commands: [command],
        explanation: `Create a new directory (parent directories created as needed)`,
        tags: ['filesystem', 'create'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('remove file') || input.includes('delete file') || input.includes('rm file')) {
      const command = os.platform === 'windows' ? 'del' : 'rm';
      return {
        commands: [command],
        explanation: `Remove a file`,
        tags: ['filesystem', 'delete'],
        confidence: 0.8,
        source: 'rule'
      };
    }

    if (input.includes('remove folder') || input.includes('delete directory') || input.includes('rmdir')) {
      const command = os.platform === 'windows' ? 'rmdir /s' : 'rm -rf';
      return {
        commands: [command],
        explanation: `Remove a directory and all its contents recursively`,
        tags: ['filesystem', 'delete'],
        confidence: 0.8,
        source: 'rule'
      };
    }

    // Process management
    if (input.includes('show processes') || input.includes('list processes') || input.includes('ps')) {
      const command = os.platform === 'windows' ? 'tasklist' : 'ps aux';
      return {
        commands: [command],
        explanation: `Show all running processes`,
        tags: ['process', 'list'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('kill process') || input.includes('stop process')) {
      const command = os.platform === 'windows' ? 'taskkill /PID' : 'kill -9';
      return {
        commands: [command],
        explanation: `Terminate a process by PID`,
        tags: ['process', 'kill'],
        confidence: 0.8,
        source: 'rule'
      };
    }

    // Network operations
    if (input.includes('check connection') || input.includes('ping')) {
      const command = 'ping -c 4 8.8.8.8';
      return {
        commands: [command],
        explanation: `Test internet connectivity to Google DNS`,
        tags: ['network', 'test'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('show ip') || input.includes('get ip')) {
      if (os.platform === 'windows') {
        return {
          commands: ['ipconfig'],
          explanation: `Display IP configuration`,
          tags: ['network', 'info'],
          confidence: 0.9,
          source: 'rule'
        };
      } else {
        return {
          commands: ['ip addr show'],
          explanation: `Display IP address information`,
          tags: ['network', 'info'],
          confidence: 0.9,
          source: 'rule'
        };
      }
    }

    // Git operations
    if (input.includes('git status') || input.includes('check git')) {
      return {
        commands: ['git status'],
        explanation: `Show working tree status`,
        tags: ['git', 'status'],
        confidence: 0.95,
        source: 'rule'
      };
    }

    if (input.includes('git add') || input.includes('stage changes')) {
      return {
        commands: ['git add .'],
        explanation: `Stage all changes for commit`,
        tags: ['git', 'stage'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('git commit') || input.includes('commit changes')) {
      return {
        commands: ['git commit -m "{message}"'],
        explanation: `Commit staged changes with a message`,
        tags: ['git', 'commit'],
        confidence: 0.9,
        source: 'rule',
        variables: { message: '' }
      };
    }

    if (input.includes('git push') || input.includes('upload changes')) {
      return {
        commands: ['git push'],
        explanation: `Push commits to remote repository`,
        tags: ['git', 'push'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('git pull') || input.includes('download changes')) {
      return {
        commands: ['git pull'],
        explanation: `Pull latest changes from remote repository`,
        tags: ['git', 'pull'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    // Node.js operations
    if (input.includes('install npm packages') || input.includes('npm install')) {
      return {
        commands: ['npm install'],
        explanation: `Install dependencies from package.json`,
        tags: ['node', 'npm'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('run npm script') || input.includes('npm start')) {
      return {
        commands: ['npm start'],
        explanation: `Run the start script defined in package.json`,
        tags: ['node', 'npm'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    // Docker operations
    if (input.includes('show containers') || input.includes('docker ps')) {
      return {
        commands: ['docker ps -a'],
        explanation: `List all Docker containers`,
        tags: ['docker', 'list'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    if (input.includes('show images') || input.includes('docker images')) {
      return {
        commands: ['docker images'],
        explanation: `List all Docker images`,
        tags: ['docker', 'list'],
        confidence: 0.9,
        source: 'rule'
      };
    }

    // System information
    if (input.includes('show disk usage') || input.includes('disk space')) {
      if (os.platform === 'windows') {
        return {
          commands: ['wmic logicaldisk get size,freespace,caption'],
          explanation: `Display disk space information`,
          tags: ['system', 'disk'],
          confidence: 0.9,
          source: 'rule'
        };
      } else {
        return {
          commands: ['df -h'],
          explanation: `Display disk usage in human-readable format`,
          tags: ['system', 'disk'],
          confidence: 0.9,
          source: 'rule'
        };
      }
    }

    if (input.includes('show memory') || input.includes('ram usage')) {
      if (os.platform === 'windows') {
        return {
          commands: ['wmic OS get TotalVisibleMemorySize,FreePhysicalMemory'],
          explanation: `Display memory usage information`,
          tags: ['system', 'memory'],
          confidence: 0.9,
          source: 'rule'
        };
      } else {
        return {
          commands: ['free -h'],
          explanation: `Display memory usage in human-readable format`,
          tags: ['system', 'memory'],
          confidence: 0.9,
          source: 'rule'
        };
      }
    }

    return null;
  }
}