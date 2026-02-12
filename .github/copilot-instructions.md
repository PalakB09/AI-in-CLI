# AI CLI Assistant - Copilot Instructions

## Project Overview

**ai-cli-assistant** is a cross-platform CLI tool that converts natural language requests into shell commands with safety validation. It integrates with existing terminals (Bash, Zsh, PowerShell, CMD) without requiring a custom shell or terminal.

## Architecture

### Resolution Pipeline (Priority Order)
The core pattern is a **3-tier command resolution** in `CommandResolver`:
1. **Vault Search** - Check user's local command history (`~/.ai-cli/vault.json`)
2. **Rule-Based Mapping** - Fast deterministic patterns for common tasks (in `resolver/command-resolver.ts`)
3. **AI Fallback** - OpenAI API with structured JSON parsing (in `core/ai-service.ts`)

Only the first successful match is returned; fallback only occurs if previous tiers return null.

### Key Components

| Component | File | Responsibility |
|-----------|------|---|
| **CommandResolver** | `resolver/command-resolver.ts` | Routes input through priority pipeline |
| **AIService** | `core/ai-service.ts` | Calls OpenAI with OS-aware prompts, parses JSON responses |
| **SafetyValidator** | `safety/safety-validator.ts` | Blocks dangerous patterns (regex blacklist), warns on risky operations |
| **StorageManager** | `storage/storage-manager.ts` | Manages vault JSON, command metadata, search by tags |
| **ShellIntegrator** | `shell/shell-integrator.ts` | Installs/uninstalls shell hooks (preexec for Bash/Zsh, PSReadLine for PowerShell) |
| **OSAdapter** | `os/os-adapter.ts` | Platform detection (windows/linux/macos) and arch info |

## Development Workflows

### Building & Running
```bash
npm run build       # TypeScript → JS in dist/
npm run dev         # Runs src/cli.ts directly via ts-node (unbuilt)
npm start           # Runs built dist/cli.js
npm test            # Jest with ts-jest transformer
npm run lint        # ESLint on src/**/*.ts
```

### Installation for Testing
```bash
npm run install-global  # build + npm install -g .
npm run uninstall-global
# Installs global `ai` command (entry: dist/cli.js)
```

### Testing
- Tests live in `src/**/__tests__/**` or `**/*.spec.ts|*.test.ts`
- Jest configured with `ts-jest` preset; transforms TypeScript directly
- Coverage collected in `coverage/` (text + lcov + html)

## Critical Patterns & Conventions

### Types & Interfaces
- **ResolvedCommand**: Core output type with fields: `command`, `explanation`, `tags`, `confidence` (0-1), `source` ('rule'|'ai'|'vault')
- **SafetyResult**: `blocked` (bool), `warning` (string), `riskLevel` ('low'|'medium'|'high')
- All exported from `types.ts` for consistency

### Rule-Based Mappings
In `CommandResolver.applyRules()`, patterns are hardcoded with OS-specific branching:
```typescript
if (input.includes('list files')) {
  const command = os.platform === 'windows' ? 'dir' : 'ls -la';
  return { command, explanation: '...', tags: [...], confidence: 0.9 };
}
```
Rules use `input.toLowerCase().trim()` and `.includes()` matching. **Add new rules here for fast non-AI paths.**

### Safety Validation
Two regex arrays in `SafetyValidator`:
- `dangerousPatterns` - blocks execution immediately (e.g., `rm -rf /`, `format c:`, `kill -9 1`)
- `warningPatterns` - shows warning but allows execution (e.g., `rm -rf`, `format`)
**Always check both arrays when adding dangerous command handling.**

### Command Vault Storage
Commands stored in `~/.ai-cli/vault.json` as array of `CommandEntry`:
```typescript
{ id, command, description, tags[], usageCount, lastUsed, createdAt, confidence, source }
```
Search is tag-based and substring-matched. Duplicates are merged (usage incremented). **Tags are critical for vault discovery.**

### AI Prompting
`AIService.buildPrompt()` generates OS-aware instructions:
- **Windows**: "use PowerShell or cmd commands"
- **Linux**: "use bash/sh commands"
- **macOS**: "use bash/zsh commands"

AI response must be valid JSON with exact schema. Parse with `parseAIResponse()` which extracts command, explanation, tags, confidence.

## Common Tasks

### Adding a New CLI Command
1. Add `program.command('name')` block in `cli.ts`
2. Implement action handler with proper error handling
3. Use existing services (AIService, CommandResolver, SafetyValidator) - don't recreate

### Adding a Fast Rule
1. Find/create matching pattern in `CommandResolver.applyRules()`
2. Branch on `os.platform` (windows/linux/macos)
3. Return confidence 0.9+ (rules are high confidence)
4. Add appropriate tags for vault discovery

### Adding Safety Checks
1. Add regex to `dangerousPatterns` (blocks) or `warningPatterns` (warns)
2. Test with various command formats (spaces, case variations)
3. Document the threat in comments

### Extending AI Providers
`AIService.getAvailableProvider()` checks: env var `OPENAI_API_KEY` → config file → null
Add new providers in `callAI()` with their own method (e.g., `callAnthropic()`).

## File Structure Rules
- **Config**: `~/.ai-cli/config.json` (API keys, preferences)
- **Vault**: `~/.ai-cli/vault.json` (command history)
- **Metadata**: `~/.ai-cli/metadata.json` (version, stats)
- **Shell Hooks**: Platform-specific files appended to shell rc files

## Important Dependencies
- **commander** - CLI argument parsing
- **chalk** - Terminal colors
- **inquirer** - Interactive prompts (user confirmation)
- **node-fetch** - API calls to OpenAI
- **fs-extra** - Async file operations
- **which** - Find executables in PATH

## Common Pitfalls

1. **Not checking `source` field** - Rules and vault are fast, but lower confidence than AI; consider source when debugging
2. **Forgetting OS branching** - Commands differ between Windows/Unix; always check platform before returning
3. **Unsafe regex in safety patterns** - Use `/i` flag for case-insensitive matching
4. **Not validating JSON from AI** - Always parse/validate AI response; provide fallback
5. **Hardcoded paths** - Use `path.join(os.homedir(), ...)` for cross-platform support
