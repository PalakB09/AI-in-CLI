# AI CLI Assistant

A cross-platform CLI tool that integrates with existing terminals to provide AI-assisted command suggestions, explanations, and safe execution.

## Features

- **Shell Integration**: Works with Bash, Zsh, PowerShell, and CMD
- **Safety-First**: Blocks dangerous commands and warns about risky operations
- **Rule-Based Resolution**: Fast deterministic command mapping with AI fallback
- **Command Vault**: Local storage of frequently used commands with tag-based search
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
ai vault search "git"

# Add command to vault
ai vault add "git status --porcelain" "Show git status in porcelain format" git,status

# List all commands in vault
ai vault list
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
   - Tag-based search and filtering
   - Usage frequency tracking
   - Import/export functionality

## Configuration

### AI Provider Setup

Set your preferred AI provider API key:

```bash
# OpenAI
export OPENAI_API_KEY="your-api-key"

# Or configure permanently
ai configure --provider openai --api-key your-api-key
```

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
- `ai vault [action] [query]` - Manage command vault
- `ai debug` - Show system information

### Vault Commands

- `ai vault list` - List all stored commands
- `ai vault search <query>` - Search commands
- `ai vault add "<command>" ["description"] [tags...]` - Add command
- `ai vault remove <id>` - Remove command

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all linting passes
5. Submit a pull request

### Testing
```bash
npm test
npm run coverage
```

## License

MIT License - see LICENSE file for details.

## Security

- No cloud data storage - everything is local
- No auto-execution of AI output
- Safety validation on all commands
- Local configuration only

## Support

- GitHub Issues: https://github.com/your-repo/ai-cli-assistant/issues
- Documentation: https://github.com/your-repo/ai-cli-assistant/wiki

---

**Warning**: This tool executes commands on your system. Always review suggestions before execution, especially those with warnings or high risk levels.