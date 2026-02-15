import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

const START_MARKER = '# AI CLI Assistant Integration START';
const END_MARKER = '# AI CLI Assistant Integration END';

export class ShellIntegrator {
  private readonly homeDir = os.homedir();

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

  // async uninstall(shellType?: string): Promise<void> {
  //   const shell = shellType || await this.detectCurrentShell();

  //   switch (shell) {
  //     case 'bash':
  //       await this.uninstall(path.join(this.homeDir, '.bashrc'));
  //       break;
  //     case 'zsh':
  //       await this.uninstall(path.join(this.homeDir, '.zshrc'));
  //       break;
  //     case 'powershell':
  //       await this.uninstall(await this.getPowerShellProfilePath());
  //       break;
  //     default:
  //       throw new Error(`Unsupported shell: ${shell}`);
  //   }
  // }

  private async detectCurrentShell(): Promise<string> {
    if (process.platform === 'win32') return 'powershell';

    try {
      const { stdout } = await execAsync('echo $SHELL');
      if (stdout.includes('zsh')) return 'zsh';
      if (stdout.includes('bash')) return 'bash';
    } catch {}

    return 'bash';
  }

  /* -------------------- INSTALLERS -------------------- */

  private async installBash(): Promise<void> {
    const bashrc = path.join(this.homeDir, '.bashrc');
    const script = `
${START_MARKER}
ai_suggest_missing_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    ai suggest "$*" --explain
    return 127
  fi
}
${END_MARKER}
`;
    await this.appendBlock(bashrc, script);
    console.log(chalk.green('✓ Bash integration installed'));
  }

  private async installZsh(): Promise<void> {
    const zshrc = path.join(this.homeDir, '.zshrc');
    const script = `
${START_MARKER}
_ai_suggest_widget() {
  zle -M "Press Enter to get AI suggestion"
}
zle -N _ai_suggest_widget
bindkey '^T' _ai_suggest_widget
${END_MARKER}
`;
    await this.appendBlock(zshrc, script);
    console.log(chalk.green('✓ Zsh integration installed'));
  }

  private async installPowerShell(): Promise<void> {
    const profilePath = await this.getPowerShellProfilePath();
    const script = `
${START_MARKER}
function Invoke-AICommandSuggestion {
  param([string]$CommandLine)
  ai suggest -- "$CommandLine" --explain
}

Set-PSReadLineKeyHandler -Key "Ctrl+t" -ScriptBlock {
  param($key, $arg)
  $line = $null
  $cursor = $null
  [Microsoft.PowerShell.PSConsoleReadLine]::GetBufferState([ref]$line, [ref]$cursor)
  Invoke-AICommandSuggestion -CommandLine $line
}
${END_MARKER}
`;
    await this.appendBlock(profilePath, script);
    console.log(chalk.green('✓ PowerShell integration installed'));
  }

  /* -------------------- UNINSTALL -------------------- */

   async uninstall(filePath: string): Promise<void> {
    if (!(await fs.pathExists(filePath))) return;

    const content = await fs.readFile(filePath, 'utf8');
    const start = content.indexOf(START_MARKER);
    const end = content.indexOf(END_MARKER);

    if (start === -1 || end === -1) return;

    const updated =
      content.slice(0, start) +
      content.slice(end + END_MARKER.length);

    await fs.writeFile(filePath, updated);
  }

  /* -------------------- HELPERS -------------------- */

  private async getPowerShellProfilePath(): Promise<string> {
    const { stdout } = await execAsync(
      'powershell -Command "echo $PROFILE"'
    );
    return stdout.trim();
  }

  private async appendBlock(filePath: string, block: string): Promise<void> {
    await fs.ensureFile(filePath);
    const content = await fs.readFile(filePath, 'utf8');

    if (content.includes(START_MARKER)) return;

    await fs.appendFile(filePath, '\n' + block + '\n');
  }

  generateWrapperScript(): string {
    return `@echo off
if "%1"=="" (
  echo Usage: ai [suggest|install|uninstall|vault|debug]
  exit /b 1
)
node "%~dp0..\\dist\\cli.js" %*
`;
  }
}
