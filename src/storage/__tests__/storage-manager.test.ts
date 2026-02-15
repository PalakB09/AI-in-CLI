import { StorageManager } from '../storage-manager';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  writeJson: jest.fn(),
  readJson: jest.fn(),
}));
jest.mock('os');

import { ensureDir, pathExists, writeJson, readJson } from 'fs-extra';

const mockedOs = os as jest.Mocked<typeof os>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<any>;
const mockedPathExists = pathExists as jest.MockedFunction<any>;
const mockedWriteJson = writeJson as jest.MockedFunction<any>;
const mockedReadJson = readJson as jest.MockedFunction<any>;

describe('StorageManager', () => {
  let storage: StorageManager;
  const dataDir = path.join('home', '.ai-cli');
  const vaultPath = path.join(dataDir, 'vault.json');
  const metadataPath = path.join(dataDir, 'metadata.json');

  beforeEach(() => {
    mockedOs.homedir.mockReturnValue('home');
    storage = new StorageManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize correctly', async () => {
    (ensureDir as jest.MockedFunction<typeof ensureDir>).mockResolvedValue(undefined);
    (pathExists as jest.MockedFunction<typeof pathExists>).mockResolvedValue(false);
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await (storage as any).init();

    expect(ensureDir).toHaveBeenCalledWith(dataDir);
    expect(writeJson).toHaveBeenCalledWith(vaultPath, [], { spaces: 2 });
  });

  it('should get all commands', async () => {
    const commands = [{ id: '1', commands: ['ls'], description: '', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.9, source: 'rule' }];
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(commands);

    const result = await storage.getAllCommands();

    expect(result).toEqual(commands);
  });

  it('should add new command', async () => {
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue([]);
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await storage.addCommand('ls', 'list files');

    expect(writeJson).toHaveBeenCalledWith(vaultPath, expect.any(Array), { spaces: 2 });
  });

  it('should update existing command', async () => {
    const existing = [{ id: '1', commands: ['ls'], description: 'old', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.9, source: 'rule' }];
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(existing);
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await storage.addCommand('ls', 'new description');

    expect(writeJson).toHaveBeenCalledWith(vaultPath, expect.any(Array), { spaces: 2 });
  });

  it('should search commands', async () => {
    const commands = [
      { id: '1', commands: ['ls'], description: 'list files', tags: ['fs'], usageCount: 1, lastUsed: new Date(), createdAt: new Date(), confidence: 0.9, source: 'rule' },
      { id: '2', commands: ['pwd'], description: 'print working directory', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.8, source: 'rule' },
    ];
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(commands);

    const result = await storage.searchCommands('list');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('should increment usage', async () => {
    const commands = [{ id: '1', commands: ['ls'], description: '', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.9, source: 'rule' }];
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(commands);
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await storage.incrementUsage('1');

    expect(commands[0].usageCount).toBe(1);
  });

  it('should delete command', async () => {
    const commands = [
      { id: '1', commands: ['ls'], description: '', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.9, source: 'rule' },
      { id: '2', commands: ['pwd'], description: '', tags: [], usageCount: 0, lastUsed: new Date(), createdAt: new Date(), confidence: 0.8, source: 'rule' },
    ];
    (readJson as jest.MockedFunction<typeof readJson>).mockResolvedValue(commands);
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await storage.deleteCommand('1');

    expect(writeJson).toHaveBeenCalledWith(vaultPath, [commands[1]], { spaces: 2 });
  });

  it('should clear vault', async () => {
    (writeJson as jest.MockedFunction<typeof writeJson>).mockResolvedValue(undefined);

    await storage.clearVault();

    expect(writeJson).toHaveBeenCalledWith(vaultPath, [], { spaces: 2 });
  });

  it('should handle errors gracefully', async () => {
    (readJson as jest.MockedFunction<typeof readJson>).mockRejectedValue(new Error('fs error'));

    await expect(storage.getAllCommands()).rejects.toThrow('fs error');
  });

  it('should revive dates correctly', () => {
    const cmd = {
      id: '1',
      commands: ['ls'],
      description: '',
      tags: [],
      usageCount: 0,
      lastUsed: '2023-01-01T00:00:00.000Z',
      createdAt: '2023-01-01T00:00:00.000Z',
      confidence: 0.9,
      source: 'rule' as const,
    };

    const result = (storage as any).reviveDates(cmd);

    expect(result.lastUsed).toBeInstanceOf(Date);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});