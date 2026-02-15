import { AIService } from '../ai-service';
import * as os from 'os';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readJson: jest.fn(),
}));
jest.mock('os');
jest.mock('../cache/cache-manager');

import { pathExists, readJson } from 'fs-extra';
// import { CacheManager } from '../cache/cache-manager';
import { CacheManager } from '../../cache/cache-manager';
const mockedOs = os as jest.Mocked<typeof os>;
const mockedCacheManager = CacheManager as jest.MockedClass<typeof CacheManager>;
const mockedPathExists = pathExists as jest.MockedFunction<any>;
const mockedReadJson = readJson as jest.MockedFunction<any>;

describe('AIService', () => {
  let aiService: AIService;
  let mockCache: any;

  beforeEach(() => {
    mockedOs.homedir.mockReturnValue('home');
    (global as any).fetch = jest.fn();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };
    mockedCacheManager.prototype.get = mockCache.get;
    mockedCacheManager.prototype.set = mockCache.set;
    aiService = new AIService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize correctly', () => {
    expect(aiService).toBeDefined();
  });

  it('should return null if no provider available', async () => {
    mockedPathExists
    (pathExists as jest.MockedFunction<typeof pathExists>).mockResolvedValue(false);

    const result = await aiService.generateCommand('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toBeNull();
  });

  it('should use cached response if available', async () => {
    mockCache.get.mockResolvedValue('cached');

    const result = await aiService.generateCommand('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(mockCache.get).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should call AI if no cache', async () => {
    process.env.GEMINI_API_KEY = 'key';
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'ls' }] } }],
      }),
    });

    const result = await aiService.generateCommand('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toBeDefined();
    expect(mockCache.set).toHaveBeenCalled();
  });

  it('should handle AI call failure', async () => {
    process.env.GEMINI_API_KEY = 'key';
    mockCache.get.mockResolvedValue(null);
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('fetch error'));

    const result = await aiService.generateCommand('input', { platform: 'linux', arch: 'x64', shell: 'bash' });

    expect(result).toBeNull();
  });

  it('should parse AI response correctly', () => {
    const response = 'ls';
    const result = (aiService as any).parseAIResponse(response, false);

    expect(result).toEqual({
      commands: ['ls'],
      explanation: 'Command suggested by AI',
      tags: ['ai'],
      confidence: 0.7,
      source: 'ai',
    });
  });

  it('should return null for invalid response', () => {
    const response = '';
    const result = (aiService as any).parseAIResponse(response, false);

    expect(result).toBeNull();
  });

  it('should detect multiple commands', () => {
    const response = 'ls && pwd';
    const result = (aiService as any).parseAIResponse(response, true);

    expect(result?.commands).toEqual(['ls', 'pwd']);
  });

  it('should extract variables', () => {
    const response = 'mkdir {name}';
    const result = (aiService as any).parseAIResponse(response, false);

    expect(result?.variables).toEqual({ name: '' });
  });

  it('should handle learning mode', () => {
    const response = 'ls_JSON_{"concepts":[]}';
    const result = (aiService as any).parseAIResponse(response, false, true);

    expect(result?.learning).toEqual({ concepts: [] });
  });

  it('should check if configured', () => {
    process.env.GEMINI_API_KEY = 'key';
    expect(aiService.isConfigured()).toBe(true);

    delete process.env.GEMINI_API_KEY;
    mockedPathExists.mockReturnValue(true);
    expect(aiService.isConfigured()).toBe(true);
  });
});