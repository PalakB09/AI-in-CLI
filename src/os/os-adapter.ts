import { OS } from '../types';
import * as os from 'os';
import * as which from 'which';

export class OSAdapter {
  private currentOS: OS;

  constructor() {
    this.currentOS = this.detectOS();
  }

  getOS(): OS {
    return this.currentOS;
  }

  private detectOS(): OS {
    const platform = os.platform();
    let detectedPlatform: 'windows' | 'linux' | 'macos';

    switch (platform) {
      case 'win32':
        detectedPlatform = 'windows';
        break;
      case 'darwin':
        detectedPlatform = 'macos';
        break;
      case 'linux':
        detectedPlatform = 'linux';
        break;
      default:
        detectedPlatform = 'linux'; // Default fallback
    }

    return {
      platform: detectedPlatform,
      arch: os.arch(),
      shell: this.detectShell()
    };
  }

  private detectShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || 'bash';
}

  isCommandAvailable(command: string): boolean {
    try {
      which.sync(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  getAlternativeCommands(primaryCommand: string): string[] {
    const alternatives: Record<string, Record<string, string[]>> = {
      windows: {
        'ls': ['dir'],
        'cat': ['type'],
        'cp': ['copy'],
        'mv': ['move', 'ren'],
        'rm': ['del', 'rmdir'],
        'clear': ['cls'],
        'grep': ['findstr'],
        'ps': ['tasklist'],
        'kill': ['taskkill'],
        'ifconfig': ['ipconfig'],
        'ping': ['ping'],
        'mkdir': ['mkdir'],
        'chmod': ['icacls', 'attrib'],
        'tar': ['tar'],
        'ssh': ['ssh'],
        'scp': ['scp'],
        'wget': ['curl', 'bitsadmin'],
        'curl': ['curl', 'Invoke-WebRequest'],
        'nano': ['notepad'],
        'vim': ['notepad']
      },
      linux: {
        'dir': ['ls'],
        'type': ['cat'],
        'copy': ['cp'],
        'move': ['mv'],
        'del': ['rm'],
        'rmdir': ['rm -rf'],
        'cls': ['clear'],
        'findstr': ['grep'],
        'tasklist': ['ps'],
        'taskkill': ['kill'],
        'ipconfig': ['ifconfig', 'ip addr'],
        'notepad': ['nano', 'vim'],
        'attrib': ['chmod']
      },
      macos: {
        'dir': ['ls'],
        'type': ['cat'],
        'copy': ['cp'],
        'move': ['mv'],
        'del': ['rm'],
        'rmdir': ['rm -rf'],
        'cls': ['clear'],
        'findstr': ['grep'],
        'tasklist': ['ps'],
        'taskkill': ['kill'],
        'ipconfig': ['ifconfig', 'ip addr'],
        'notepad': ['nano', 'vim', 'open -e'],
        'attrib': ['chmod']
      }
    };

    const platform = this.currentOS.platform;
    const platformAlternatives = alternatives[platform];
    return platformAlternatives?.[primaryCommand] || [];
  }

  normalizeCommand(command: string): string {
    const normalized = command.trim();
    
    if (this.currentOS.platform === 'windows') {
      return this.normalizeWindowsCommand(normalized);
    } else {
      return this.normalizeUnixCommand(normalized);
    }
  }

  private normalizeWindowsCommand(command: string): string {
    // Convert Unix-style paths to Windows
    let normalized = command.replace(/\//g, '\\');
    
    // Replace common Unix commands with Windows equivalents
    const replacements: Record<string, string> = {
      'ls -la': 'dir',
      'ls -l': 'dir',
      'ls': 'dir',
      'cat': 'type',
      'cp -r': 'xcopy /E /I',
      'cp': 'copy',
      'mv': 'move',
      'rm -rf': 'rmdir /S /Q',
      'rm': 'del',
      'clear': 'cls',
      'grep': 'findstr',
      'ps aux': 'tasklist',
      'kill': 'taskkill',
      'chmod +x': 'icacls', // Different semantics, but closest equivalent
      'tar -xvf': 'tar -xvf', // tar is available on Windows 10+
      'wget': 'curl -O',
      'curl -O': 'curl -O',
      'nano': 'notepad'
    };

    for (const [unix, windows] of Object.entries(replacements)) {
      if (normalized.startsWith(unix + ' ') || normalized === unix) {
        normalized = normalized.replace(unix, windows);
      }
    }

    return normalized;
  }

  private normalizeUnixCommand(command: string): string {
    // Windows-style paths to Unix
    let normalized = command.replace(/\\/g, '/');
    
    // Replace Windows commands with Unix equivalents
    const replacements: Record<string, string> = {
      'dir': 'ls -la',
      'type': 'cat',
      'copy': 'cp',
      'move': 'mv',
      'del': 'rm',
      'rmdir /S /Q': 'rm -rf',
      'rmdir': 'rm -rf',
      'cls': 'clear',
      'findstr': 'grep',
      'tasklist': 'ps aux',
      'taskkill': 'kill',
      'icacls': 'chmod',
      'attrib': 'chmod',
      'notepad': 'nano'
    };

    for (const [windows, unix] of Object.entries(replacements)) {
      if (normalized.startsWith(windows + ' ') || normalized === windows) {
        normalized = normalized.replace(windows, unix);
      }
    }

    return normalized;
  }

  getExecutableExtension(): string {
    return this.currentOS.platform === 'windows' ? '.exe' : '';
  }

  getPathVariable(): string {
    return this.currentOS.platform === 'windows' ? 'Path' : 'PATH';
  }

  getPathSeparator(): string {
    return this.currentOS.platform === 'windows' ? ';' : ':';
  }

  getHomeDirectory(): string {
    return os.homedir();
  }

  getTempDirectory(): string {
    return os.tmpdir();
  }

  supportsSymlinks(): boolean {
    return this.currentOS.platform !== 'windows';
  }

  supportsPermissions(): boolean {
    return this.currentOS.platform !== 'windows';
  }

  supportsCaseSensitivity(): boolean {
    return this.currentOS.platform !== 'windows';
  }

  getSystemInfo(): {
    platform: string;
    release: string;
    arch: string;
    hostname: string;
    homedir: string;
    shell: string;
  } {
    return {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      homedir: os.homedir(),
      shell: this.currentOS.shell || 'unknown'
    };
  }
}