import { ResolvedCommand, OS, AIProvider } from "../types";
import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { CacheManager } from "../cache/cache-manager";

const PROMPT_VERSION = "v1";

export class AIService {
  private configPath: string;
  private cache: CacheManager;

  constructor() {
    this.configPath = path.join(os.homedir(), ".ai-cli", "config.json");
    this.cache = new CacheManager();
  }

  async generateCommand(
    input: string,
    osInfo: OS,
    learningMode: boolean = false
  ): Promise<ResolvedCommand | null> {
    try {
      const wantsMultiple =
        /\bthen\b|\band\b|\bafter that\b|\bfollowed by\b/i.test(input);

      const cachedResponse = await this.cache.get(
        input,
        osInfo,
        learningMode
      );

      if (cachedResponse) {
        console.log("[CACHE HIT]");
        return this.parseAIResponse(
          cachedResponse,
          wantsMultiple,
          learningMode
        );
      }

      const provider = await this.getAvailableProvider();
      if (!provider) return null;

      const prompt = this.buildPrompt(
        input,
        osInfo,
        wantsMultiple,
        learningMode
      );

      const response = await this.callAI(provider, prompt);
      if (!response) return null;

      await this.cache.set(input, osInfo, learningMode, response);

      return this.parseAIResponse(response, wantsMultiple, learningMode);
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
    wantsMultiple: boolean,
    learningMode: boolean = false
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

    const learningInstructions = learningMode
      ? `
LEARNING MODE ENABLED.

After the command, output:
_JSON_
<VALID JSON>

JSON schema:
{
  "concepts": [],
  "debuggingSteps": [],
  "relatedCommands": [],
  "bestPractices": [],
  "resources": []
}
`
      : "";

    return `
You are a shell command generator.

User request:
"${input}"

Target environment:
${osContext}

STRICT RULES:
- Output ONLY a valid shell command
- NO explanations
- NO markdown
- NO quotes
- NO sentences
- NO placeholders like command1
- Use {variableName} for user inputs
${chainingRule}
${learningInstructions}

If unsure, return the safest possible command.
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

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text =
        data.candidates?.[0]?.content?.parts
          ?.map(p => p.text ?? "")
          .join("")
          .trim() ?? null;

      return text;
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
    wantsMultiple: boolean,
    learningMode: boolean = false
  ): ResolvedCommand | null {
    const raw = response.trim();

    let commandPart = raw;
    let learningPart: string | null = null;

    if (learningMode && raw.includes("_JSON_")) {
      const parts = raw.split("_JSON_");
      commandPart = parts[0].trim();
      learningPart = parts[1]?.trim() ?? null;
    }

    const cleaned = commandPart
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`/g, "")
      .split("\n")[0]
      .trim();

    if (!cleaned || cleaned.length > 180 || cleaned.endsWith("?")) {
      return null;
    }

    const hasSeparators = /\s(&&|;)\s/.test(cleaned);

    if (wantsMultiple && !hasSeparators) {
      return null;
    }

    const commands = hasSeparators
      ? cleaned.split(/\s*(?:&&|;)\s*/)
      : [cleaned];

    const variables: { [key: string]: string } = {};
    const varRegex = /\{(\w+)\}/g;

    commands.forEach(cmd => {
      let match;
      while ((match = varRegex.exec(cmd)) !== null) {
        variables[match[1]] = "";
      }
    });

    let learningContent = undefined;
    if (learningMode && learningPart) {
      try {
        learningContent = JSON.parse(learningPart);
      } catch {
        /* ignore */
      }
    }

    return {
      commands,
      explanation: "Command suggested by AI",
      tags: ["ai"],
      confidence: 0.7,
      source: "ai",
      variables: Object.keys(variables).length ? variables : undefined,
      ...learningContent,
    };
  }

  /* ------------------------------------------------------------------ */

  isConfigured(): boolean {
    return !!(
      process.env.GEMINI_API_KEY || fs.pathExistsSync(this.configPath)
    );
  }
}
