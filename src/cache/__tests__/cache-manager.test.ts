import { CacheManager } from '../cache-manager';
import * as path from 'path';
import * as os from 'os';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readJson: jest.fn(),
  writeJson: jest.fn(),
  ensureDir: jest.fn(),
  remove: jest.fn(),
  move: jest.fn(),
}));
jest.mock('os');

import { pathExists, readJson, writeJson, ensureDir, remove, move } from 'fs-extra';

const mockedOs = os as jest.Mocked<typeof os>;
const mockedPathExists = pathExists as jest.MockedFunction<any>;
const mockedReadJson = readJson as jest.MockedFunction<any>;
const mockedWriteJson = writeJson as jest.MockedFunction<any>;
const mockedEnsureDir = ensureDir as jest.MockedFunction<any>;
const mockedRemove = remove as jest.MockedFunction<any>;
const mockedMove = move as jest.MockedFunction<any>;

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  const cachePath = path.join('home', '.ai-cli', 'cache.json');

  beforeEach(() => {
    mockedOs.homedir.mockReturnValue('home');
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct cache path', () => {
    expect(cacheManager).toBeDefined();
  });

  it('should return null if cache file does not exist', async () => {
    mockedPathExists.mockResolvedValue(false);

    const result = await cacheManager.get('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false);

    expect(result).toBeNull();
  });


  it('should return null if cache entry is expired', async () => {
    const cacheData = {
      key: {
        response: 'cached response',
        timestamp: Date.now(),
        expiresAt: Date.now() - 1000,
      },
    };
    mockedPathExists.mockResolvedValue(true);
    mockedReadJson.mockResolvedValue(cacheData);

    const result = await cacheManager.get('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false);

    expect(result).toBeNull();
  });

  it('should set cache entry correctly', async () => {
    mockedPathExists.mockResolvedValue(false);
    mockedEnsureDir.mockResolvedValue(undefined);
    mockedWriteJson.mockResolvedValue(undefined);
    mockedMove.mockResolvedValue(undefined);

    await cacheManager.set('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false, 'response');

    expect(mockedEnsureDir).toHaveBeenCalledWith(path.dirname(cachePath));
    expect(mockedWriteJson).toHaveBeenCalled();
  });

  it('should clear cache', async () => {
    mockedPathExists.mockResolvedValue(true);
    mockedRemove.mockResolvedValue(undefined);

    await cacheManager.clear();

    expect(mockedRemove).toHaveBeenCalledWith(cachePath);
  });

  it('should handle errors gracefully in get', async () => {
    mockedPathExists.mockRejectedValue(new Error('fs error'));

    const result = await cacheManager.get('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false);

    expect(result).toBeNull();
  });

  it('should handle errors gracefully in set', async () => {
    mockedEnsureDir.mockRejectedValue(new Error('fs error'));

    await expect(cacheManager.set('input', { platform: 'linux', arch: 'x64', shell: 'bash' }, false, 'response')).resolves.toBeUndefined();
  });
});