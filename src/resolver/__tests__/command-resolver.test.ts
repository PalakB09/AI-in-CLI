import { CommandResolver } from '../command-resolver';

const mockAI = {
  generateCommand: jest.fn(),
  isConfigured: jest.fn(),
};

const mockPlugin = {
  init: jest.fn().mockResolvedValue(),
  getRules: jest.fn().mockReturnValue([]),
};

const mockStorage = {
  getAllCommands: jest.fn(),
  addCommand: jest.fn(),
  searchCommands: jest.fn(),
};

jest.mock('../../core/ai-service', () => ({
  AIService: jest.fn(() => mockAI)
}));
jest.mock('../../plugins/plugin-manager', () => ({
  PluginManager: jest.fn(() => mockPlugin)
}));
jest.mock('../../storage/storage-manager', () => ({
  StorageManager: jest.fn(() => mockStorage)
}));

describe('CommandResolver', () => {
  let resolver: CommandResolver;
  let mockAIService: jest.Mocked<AIService>;
  let mockPluginManager: jest.Mocked<PluginManager>;
  let mockStorage: jest.Mocked<StorageManager>;

  beforeEach(() => {
    mockAIService = new mockedAIService() as jest.Mocked<AIService>;
    mockPluginManager = new mockedPluginManager() as jest.Mocked<PluginManager>;
    mockStorage = new mockedStorageManager() as jest.Mocked<StorageManager>;

    mockPluginManager.init.mockResolvedValue();
    mockPluginManager.getRules.mockReturnValue(null);
    mockPluginManager.getSafetyChecks.mockReturnValue(null);

    resolver = new CommandResolver(mockAIService, mockPluginManager);
    (resolver as any).storage = mockStorage;
  });

  it('should initialize correctly', async () => {
    await (resolver as any).init();

    expect(mockPluginManager.init).toHaveBeenCalled();
  });

  it('should return plugin rule if available', async () => {
    const pluginResult = {
      commands: ['ls'],
      explanation: 'test',
      tags: [],
      confidence: 0.9,
    };
    mockPluginManager.getRules.mockReturnValue(pluginResult);

    const result = await resolver.resolve('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toEqual({ ...pluginResult, source: 'rule' });
  });

  it('should return vault result if available', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([{
      id: '1',
      commands: ['ls'],
      description: 'test',
      tags: [],
      usageCount: 1,
      lastUsed: new Date(),
      createdAt: new Date(),
      confidence: 0.8,
      source: 'rule',
    }]);

    const result = await resolver.resolve('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toEqual({
      commands: ['ls'],
      explanation: 'test',
      tags: [],
      confidence: 0.8,
      source: 'vault',
    });
  });

  it('should return rule result for single command', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([]);

    const result = await resolver.resolve('list files', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result?.source).toBe('rule');
    expect(result?.commands).toEqual(['ls -la']);
  });

  it('should call AI for unresolved commands', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([]);
    mockAIService.generateCommand.mockResolvedValue({
      commands: ['ls'],
      explanation: 'AI response',
      tags: ['ai'],
      confidence: 0.7,
      source: 'ai',
    });

    const result = await resolver.resolve('unknown command', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(mockAIService.generateCommand).toHaveBeenCalled();
    expect(result?.source).toBe('ai');
  });

  it('should skip vault in suggest mode', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([]);

    await resolver.resolve('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false, true);

    expect(mockStorage.searchCommands).not.toHaveBeenCalled();
  });

  it('should handle multiple commands correctly', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([]);

    const result = await resolver.resolve('then do something', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(mockAIService.generateCommand).toHaveBeenCalledWith('then do something', expect.any(Object), false);
  });

  it('should return null if no resolution', async () => {
    mockPluginManager.getRules.mockReturnValue(null);
    mockStorage.searchCommands.mockResolvedValue([]);
    mockAIService.generateCommand.mockResolvedValue(null);

    const result = await resolver.resolve('unknown', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toBeNull();
  });
});