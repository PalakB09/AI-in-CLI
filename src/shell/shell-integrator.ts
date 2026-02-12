import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class ShellIntegrator {
  private readonly homeDir = os.homedir();
  private readonly configDir = path.join(this.homeDir, '.ai-cli');

  async install(shellType?: string): Promise<void> {
    const shell = shellType || await this.detectCurrentShell();
    
    switch (shell) {
      case 'bash':
        await this.installBash();
        break;
      case 'zsh':
        await this.installZsh();
        break;
      case 'powershell':
        await this.installPowerShell();
        break;
      case 'cmd':
        console.log(chalk.yellow('CMD integration requires wrapper usage only'));
        break;
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  async uninstall(shellType?: string): Promise<void> {
    const shell = shellType || await this.detectCurrentShell();
    
    switch (shell) {
      case 'bash':
        await this.uninstallBash();
        break;
      case 'zsh':
        await this.uninstallZsh();
        break;
      case 'powershell':
        await this.uninstallPowerShell();
        break;
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  private async detectCurrentShell(): Promise<string> {
    if (process.platform === 'win32') {
      return 'powershell';
    }
    
    try {
      const { stdout } = await execAsync('echo $SHELL');
      const shellPath = stdout.trim();
      if (shellPath.includes('bash')) return 'bash';
      if (shellPath.includes('zsh')) return 'zsh';
    } catch (error) {
      console.log(chalk.yellow('Could not detect shell, defaulting to bash'));
    }
    
    return 'bash';
  }

  private async installBash(): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    const hookScript = `
# AI CLI Assistant Integration
ai_suggest_missing_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    ai suggest "$*" --explain
    return 127
  fi
}

preexec_functions+=(_ai_command_interceptor)
`;

    await this.appendToFile(bashrcPath, hookScript);
    console.log(chalk.green('✓ Bash integration installed'));
  }

  private async installZsh(): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    const hookScript = `
# AI CLI Assistant Integration
_ai_zle_widget() {
    local current_command="\$LBUFFER"
    if [[ "\$current_command" != *"ai suggest"* ]] && ! command -v "\${current_command%% *}" &>/dev/null && [[ -n "\$current_command" ]]; then
        zle -M "Getting AI suggestion..."
        local suggestion=\$(ai suggest "\$current_command" 2>/dev/null | head -n 1)
        if [[ -n "\$suggestion" ]]; then
            LBUFFER="\$suggestion"
        fi
    fi
    zle reset-prompt
}
zle -N _ai_zle_widget
bindkey '^T' _ai_zle_widget
`;

    await this.appendToFile(zshrcPath, hookScript);
    console.log(chalk.green('✓ Zsh integration installed'));
  }

  private async installPowerShell(): Promise<void> {
    const profilePath = await this.getPowerShellProfilePath();
    const hookScript = `
# AI CLI Assistant Integration
$script:AI_OriginalPSReadLineHandler = $null

function Invoke-AICommandSuggestion {
    param([string]$CommandLine)
    
    if ($CommandLine -like "*ai suggest*") { return }
    
    $firstCommand = ($CommandLine -split ' ')[0]
    if (-not (Get-Command $firstCommand -ErrorAction SilentlyContinue)) {
        Write-Host "Command not found. Getting AI suggestion..." -ForegroundColor Yellow
        $suggestion = ai suggest $CommandLine --explain
        Write-Host $suggestion -ForegroundColor Cyan
    }
}

Set-PSReadLineKeyHandler -Key "Ctrl+t" -BriefDescription "AI Suggest" -ScriptBlock {
    param($key, $arg)
    $line = $null
    $cursor = $null
    [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)
    Invoke-AICommandSuggestion -CommandLine $line
}
`;

    await this.appendToFile(profilePath, hookScript);
    console.log(chalk.green('✓ PowerShell integration installed'));
  }

  private async uninstallBash(): Promise<void> {
    const bashrcPath = path.join(this.homeDir, '.bashrc');
    await this.removeFromFile(bashrcPath, '# AI CLI Assistant Integration');
  }

  private async uninstallZsh(): Promise<void> {
    const zshrcPath = path.join(this.homeDir, '.zshrc');
    await this.removeFromFile(zshrcPath, '# AI CLI Assistant Integration');
  }

  private async uninstallPowerShell(): Promise<void> {
    const profilePath = await this.getPowerShellProfilePath();
    await this.removeFromFile(profilePath, '# AI CLI Assistant Integration');
  }

  private async getPowerShellProfilePath(): Promise<string> {
    const { stdout } = await execAsync('powershell -Command "echo $PROFILE"');
    return stdout.trim();
  }

  private async appendToFile(filePath: string, content: string): Promise<void> {
    await fs.ensureFile(filePath);
    const existingContent = await fs.readFile(filePath, 'utf8');
    
    if (!existingContent.includes('# AI CLI Assistant Integration')) {
      await fs.appendFile(filePath, '\n' + content + '\n');
    }
  }

  private async removeFromFile(filePath: string, marker: string): Promise<void> {
    if (await fs.pathExists(filePath)) {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n');
      const filteredLines = [];
      let skip = false;
      
      for (const line of lines) {
        if (line.includes(marker)) {
          skip = true;
        } else if (skip && line.trim() === '') {
          skip = false;
          continue;
        }
        
        if (!skip) {
          filteredLines.push(line);
        }
      }
      
      await fs.writeFile(filePath, filteredLines.join('\n'));
    }
  }

  generateWrapperScript(): string {
    return `@echo off
if "%1"=="" (
    echo Usage: ai [suggest|install|uninstall|vault|debug] [args...]
    exit /b 1
)
node "%~dp0..\\dist\\cli.js" %*
`;
  }
}