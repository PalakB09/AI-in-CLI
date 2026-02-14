# AI CLI Assistant

A cross-platform CLI tool that integrates with existing terminals to provide AI-assisted command suggestions, explanations, and safe execution.

## Features

- **Shell Integration**: Works with Bash, Zsh, PowerShell, and CMD
- **Safety-First**: Blocks dangerous commands and warns about risky operations
- **Rule-Based Resolution**: Fast deterministic command mapping with AI fallback
- **Command Vault**: Local storage of frequently used commands with custom names and tag-based search
- **Name-Based Execution**: Run stored commands using memorable names instead of auto-generated IDs
- **Cross-Platform**: Windows, Linux, and macOS support with OS-specific adaptations
- **No Custom Terminal**: Integrates with your existing shell, no new UI required

## Quick Start

### Installation

#### Linux/macOS
```bash
curl -fsSL https://raw.githubusercontent.com/your-repo/ai-cli-assistant/main/scripts/install.sh | bash
```

#### Windows
```powershell
iwr -useb https://raw.githubusercontent.com/your-repo/ai-cli-assistant/main/scripts/install.bat | iex
```

#### Manual Installation
```bash
npm install -g ai-cli-assistant
ai install
```

### Basic Usage

```bash
# Get command suggestions
ai suggest "list all files with details"

# Explain before executing
ai suggest "remove all log files" --explain

# Dry run (show what would be executed)
ai suggest "compress folder" --dry-run

# Search command vault
ai vault:search "git"

# Add command to vault with custom name
ai vault:add --name "status-check" --description "Show git status" "git status --porcelain"

# Add command with variables
ai vault:add --name "greet" --description "Personalized greeting" "echo Hello {name}!"

# Add command to vault (auto-generated ID)
ai vault:add "git status --porcelain" --description "Show git status"

# List all commands in vault
ai vault:list

# Run command by custom name
ai vault:run status-check

# Run command by ID
ai vault:run abc123def
```

## Command Vault Features

### Variable Substitution
Store commands with dynamic variables that get replaced with user input when executed:

```bash
# Add command with variables
ai vault:add --name "greet" --description "Personalized greeting" "echo Hello {name}, welcome to {place}!"

# Run command (will prompt for variable values)
ai vault:run greet
# Output: Enter value for name: Alice
#         Enter value for place: Wonderland
#         Hello Alice, welcome to Wonderland!
```

Variables use the `{variable_name}` syntax and are automatically detected when adding commands to the vault.

### Custom Names
Store commands with memorable names for easy recall:

```bash
# Add with custom name
ai vault:add --name "deploy-app" --description "Deploy application to production" "npm run build && npm run deploy"

# Run by name
ai vault:run deploy-app
```

### Name vs ID
- **Custom Names**: Human-readable identifiers (e.g., "deploy-app", "cleanup-logs")
- **Auto-generated IDs**: Unique alphanumeric strings (e.g., "abc123def")
- **Backward Compatibility**: Existing commands work with IDs; new commands can use names

### Search and Discovery
```bash
# Search by command content, description, or tags
ai vault:search "git status"

# View all commands with names and usage stats
ai vault:list
```

## Architecture

### Core Components

1. **Shell Integration Layer**
   - Bash/Zsh: Uses `preexec` and ZLE widgets
   - PowerShell: PSReadLine key handlers
   - CMD: Batch wrapper (limited functionality)

2. **Command Resolution Pipeline**
   - Priority 1: Command Vault search
   - Priority 2: Rule-based mappings
   - Priority 3: AI fallback (OpenAI/Anthropic)

3. **Safety System**
   - Blocks dangerous patterns (`rm -rf /`, `format c:`, etc.)
   - Warnings for risky operations
   - Dry-run support where possible
   - User confirmation for high-risk commands

4. **Storage System**
   - Local JSON storage in `~/.ai-cli/`
   - Custom names and tag-based search
   - Usage frequency tracking
   - Import/export functionality


### Shell Installation

#### Bash
```bash
ai install --shell bash
# Adds hooks to ~/.bashrc
```

#### Zsh
```bash
ai install --shell zsh
# Adds ZLE widget to ~/.zshrc
# Press Ctrl+T for AI suggestions
```

#### PowerShell
```bash
ai install --shell powershell
# Adds PSReadLine handler
# Press Ctrl+T for AI suggestions
```

## Command Reference

### Main Commands

- `ai suggest <input>` - Get command suggestion
- `ai install [--shell <type>]` - Install shell integration
- `ai uninstall [--shell <type>]` - Remove shell integration
- `ai vault:list` - List all stored commands
- `ai vault:search <query>` - Search commands in vault
- `ai vault:add [options] <command>` - Add command to vault
- `ai vault:run <idOrName>` - Run stored command by ID or name
- `ai debug` - Show system information

### Vault Commands

- `ai vault:list` - List all stored commands
- `ai vault:search <query>` - Search commands in vault
- `ai vault:add [options] <command>` - Add command to vault
  - `--name <name>` - Custom name for the command
  - `--description <description>` - Description for the command
- `ai vault:run <idOrName>` - Run stored command by ID or custom name

### Options

- `--explain` - Show explanation before execution
- `--dry-run` - Show what would be executed
- `--shell <type>` - Specify shell type

## Safety Features

### Blocked Commands
The following patterns are automatically blocked:
- `rm -rf /` and variants
- `format c:` and disk formatting
- System-critical process termination
- Docker system prune with force flags
- System file modifications

### Warning Patterns
Commands with these patterns trigger warnings:
- Recursive deletion (`rm -rf`, `rmdir /s`)
- Force kill operations
- System service modifications
- Package removal operations

### Risk Levels
- **Low**: Normal operations
- **Medium**: Requires user confirmation
- **High**: Requires explicit confirmation

## Command Examples

### File Operations
```bash
ai suggest "show hidden files"
# Output: ls -la (Linux/macOS) or dir /a (Windows)

ai suggest "create nested directories"
# Output: mkdir -p path/to/nested/folder

ai suggest "find all log files"
# Output: find . -name "*.log" -type f
```

### Git Operations
```bash
ai suggest "show git status"
# Output: git status

ai suggest "stage all changes"
# Output: git add .

ai suggest "commit with message"
# Output: git commit -m "your message"
```

### System Operations
```bash
ai suggest "show running processes"
# Output: ps aux (Unix) or tasklist (Windows)

ai suggest "check disk space"
# Output: df -h (Unix) or wmic logicaldisk (Windows)
```

### Vault Management
```bash
# Store frequently used commands with names
ai vault:add --name "cleanup" --description "Remove temporary files" "rm -rf /tmp/*"

# Run by name anytime
ai vault:run cleanup

# Store deployment script
ai vault:add --name "deploy" --description "Full deployment pipeline" "npm run build && npm run test && npm run deploy"

# Execute deployment
ai vault:run deploy

# Search your command library
ai vault:search "git"
```

## Development

### Project Structure
```
src/
├── core/           # AI service and main logic
├── shell/          # Shell integration
├── resolver/       # Command resolution
├── safety/         # Safety validation
├── storage/        # Command vault
├── os/             # OS-specific adapters
└── utils/          # Utility functions
```

### Building
```bash
npm run build
npm run test
npm run lint
```

### Local Development
```bash
npm run dev -- suggest "list files"
```

## Troubleshooting

### Common Issues

1. **Command not found**
   ```bash
   # Restart your terminal or run:
   source ~/.bashrc  # or ~/.zshrc
   ```

2. **AI suggestions not working**
   ```bash
   # Check API key
   ai debug
   export OPENAI_API_KEY="your-key"
   ```

3. **Shell integration issues**
   ```bash
   # Reinstall for specific shell
   ai uninstall --shell bash
   ai install --shell bash
   ```

### Debug Mode
```bash
ai debug
```

Shows:
- Operating system
- Detected shell
- Node.js version
- Configuration status

## Uninstallation

### Automatic
```bash
ai uninstall
npm uninstall -g ai-cli-assistant
```

### Manual
1. Remove shell hooks from config files
2. Delete `~/.ai-cli/` directory
3. Remove global npm package


## Security

- No cloud data storage - everything is local
- No auto-execution of AI output
- Safety validation on all commands
- Local configuration only


**Warning**: This tool executes commands on your system. Always review suggestions before execution, especially those with warnings or high risk levels.