import { ResolvedCommand, OS, AIProvider } from "../types";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { CacheManager } from "../cache/cache-manager";

export class AIService {
  private configPath: string;
  private cache: CacheManager;

  constructor() {
    this.configPath = path.join(os.homedir(), ".ai-cli", "config.json");
    this.cache = new CacheManager();
  }

  async generateCommand(
    input: string,
    osInfo: OS
  ): Promise<ResolvedCommand | null> {
    try {
      // Check cache first
      const cachedResponse = await this.cache.get(input, osInfo);
      if (cachedResponse) {
        console.log('[CACHE HIT]');
        const parsed = this.parseAIResponse(cachedResponse, /\bthen\b|\band\b|\bafter that\b|\bfollowed by\b/i.test(input));
        return parsed;
      }

      const provider = await this.getAvailableProvider();
      if (!provider) return null;

      const wantsMultiple =
        /\bthen\b|\band\b|\bafter that\b|\bfollowed by\b/i.test(input);

      const prompt = this.buildPrompt(input, osInfo, wantsMultiple);
      const response = await this.callAI(provider, prompt);

      if (!response) return null;

      // Cache the response
      await this.cache.set(input, osInfo, response);

      const parsed = this.parseAIResponse(response, wantsMultiple);
      return parsed;
    } catch (error: any) {
      console.error("AI service error:", error.message);
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Provider selection                                                   */
  /* ------------------------------------------------------------------ */

  private async getAvailableProvider(): Promise<AIProvider | null> {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey) {
      return {
        name: "gemini",
        apiKey: geminiKey,
        endpoint:
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        maxTokens: 256,
      };
    }

    if (await fs.pathExists(this.configPath)) {
      const config = await fs.readJson(this.configPath);
      if (config.ai?.apiKey && config.ai?.name === "gemini") {
        return config.ai;
      }
    }

    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Prompt                                                              */
  /* ------------------------------------------------------------------ */

  private buildPrompt(
    input: string,
    osInfo: OS,
    wantsMultiple: boolean
  ): string {
    const osContext =
      osInfo.platform === "windows"
        ? "Windows PowerShell"
        : osInfo.platform === "linux"
        ? "Linux Bash"
        : "macOS Zsh";

    const chainingRule = wantsMultiple
      ? "- You MUST combine ALL steps into ONE command using && or ;"
      : "- Return the single most appropriate command";

    return `
You are a shell command generator.

User request:
"${input}"

Target environment:
${osContext}

STRICT RULES:
- Output ONLY a valid shell command
- NO explanations
- NO greetings
- NO markdown
- NO quotes
- NO placeholders like command1
- NO sentences
- Use {variableName} for user inputs (e.g., git commit -m "{message}")
${chainingRule}
- Prefer PowerShell-safe syntax on Windows

If there are 2 or more commands to achieve the user's goal, you MUST combine them into a single line using && or ;. If you cannot determine a clear command, return only one command.
`.trim();
  }

  /* ------------------------------------------------------------------ */
  /* AI Call                                                             */
  /* ------------------------------------------------------------------ */

  private async callAI(
    provider: AIProvider,
    prompt: string
  ): Promise<string | null> {
    if (provider.name !== "gemini") return null;

    try {
      const response = await fetch(
        `${provider.endpoint}?key=${provider.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: provider.maxTokens ?? 256,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Gemini API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;
    } catch (error: any) {
      console.error("Gemini API call failed:", error.message);
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Response Parsing                                                     */
  /* ------------------------------------------------------------------ */

  private parseAIResponse(
    response: string,
    wantsMultiple: boolean
  ): ResolvedCommand | null {
    const raw = response.trim();

    // Remove code fences / markdown
    const cleaned = raw
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`/g, "")
      .split("\n")[0]
      .trim();

    /* ---------------- HARD REJECTIONS ---------------- */

    if (
      !cleaned ||
      cleaned.length > 180 ||
      cleaned.includes("command1") ||
      cleaned.includes("command2") ||
      cleaned.endsWith("?") ||
      cleaned.toLowerCase().includes("help") ||
      cleaned.toLowerCase().includes("ready")
    ) {
      return null;
    }

    // If multiple steps were requested or separators are present, enforce chaining
    let hasSeparators = /[;&|]{1,2}/.test(cleaned);
    if (wantsMultiple || hasSeparators) {
      if (!hasSeparators) {
        return null; // Wants multiple but no separators
      }
    }

    /* ---------------- SPLIT INTO STEPS ---------------- */

    let commands: string[];
    if (hasSeparators) {
      // Split on && or ; or |
      commands = cleaned.split(/\s*(&&|;|\|)\s*/).filter(cmd => cmd && !['&&', ';', '|'].includes(cmd));
    } else {
      commands = [cleaned];
    }

    /* ---------------- DETECT VARIABLES ---------------- */

    const variables: { [key: string]: string } = {};
    const varRegex = /\{(\w+)\}/g;
    commands.forEach(cmd => {
      let match;
      while ((match = varRegex.exec(cmd)) !== null) {
        variables[match[1]] = ''; // Placeholder, will be filled later
      }
    });

    /* ---------------- ACCEPT ---------------- */

    return {
      commands,
      explanation: "Command suggested by AI",
      tags: ["ai"],
      confidence: wantsMultiple ? 0.75 : 0.6,
      source: "ai",
      variables: Object.keys(variables).length > 0 ? variables : undefined,
    };
  }

  /* ------------------------------------------------------------------ */

  isConfigured(): boolean {
    return !!(process.env.GEMINI_API_KEY || fs.pathExistsSync(this.configPath));
  }
}
