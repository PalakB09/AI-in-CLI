export interface OS {
  platform: 'windows' | 'linux' | 'macos';
  arch: string;
  shell?: string;
}

export interface ResolvedCommand {
  command: string;
  explanation: string;
  tags: string[];
  confidence: number;
  source: 'rule' | 'ai' | 'vault';
}

export interface SafetyResult {
  blocked: boolean;
  warning?: string;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CommandEntry {
  id: string;
  command: string;
  description: string;
  tags: string[];
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  confidence: number;
  source: 'rule' | 'ai' | 'user';
}

export interface AIProvider {
  name: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens?: number;
}