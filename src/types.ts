export interface OS {
  platform: 'windows' | 'linux' | 'macos';
  arch: string;
  shell?: string;
}

export interface ResolvedCommand {
  commands: string[]; // Support multiple steps
  explanation: string;
  tags: string[];
  confidence: number;
  source: 'rule' | 'ai' | 'vault';
  variables?: { [key: string]: string }; // For template substitution
}

export interface SafetyResult {
  blocked: boolean;
  warning?: string;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CommandEntry {
  id: string;
  name?: string; // Custom name/alias for the command
  commands: string[]; // Support multiple commands
  description: string;
  tags: string[];
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  confidence: number;
  source: 'rule' | 'ai' | 'user';
  variables?: { [key: string]: string }; // For template substitution
}

export interface AIProvider {
  name: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
}

export interface Plugin {
  name: string;
  version: string;
  getRules?: (input: string, os: OS) => ResolvedCommand | null;
  getSafetyChecks?: (command: ResolvedCommand) => SafetyResult | null;
  onCommandExecuted?: (command: ResolvedCommand, success: boolean) => void;
}