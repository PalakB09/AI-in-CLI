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
        detectedPlatform = 'linux';
    }

    return {
      platform: detectedPlatform,
      arch: os.arch(),
      shell: this.detectShell(),
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
    } catch {
      return false;
    }
  }

  getAlternativeCommands(primaryCommand: string): string[] {
    const alternatives: Record<string, Record<string, string[]>> = {
      windows: {
        ls: ['dir'],
        cat: ['type'],
        cp: ['copy'],
        mv: ['move', 'ren'],
        rm: ['del', 'rmdir'],
        clear: ['cls'],
        grep: ['findstr'],
        ps: ['tasklist'],
        kill: ['taskkill'],
        ifconfig: ['ipconfig'],
        mkdir: ['mkdir'],
        chmod: ['icacls'],
        wget: ['curl', 'bitsadmin'],
        nano: ['notepad'],
        vim: ['notepad'],
      },
      linux: {
        dir: ['ls'],
        type: ['cat'],
        copy: ['cp'],
        move: ['mv'],
        del: ['rm'],
        cls: ['clear'],
        findstr: ['grep'],
        tasklist: ['ps'],
        taskkill: ['kill'],
        ipconfig: ['ifconfig', 'ip addr'],
        notepad: ['nano', 'vim'],
        attrib: ['chmod'],
      },
      macos: {
        dir: ['ls'],
        type: ['cat'],
        copy: ['cp'],
        move: ['mv'],
        del: ['rm'],
        cls: ['clear'],
        findstr: ['grep'],
        tasklist: ['ps'],
        taskkill: ['kill'],
        ipconfig: ['ifconfig', 'ip addr'],
        notepad: ['nano', 'vim', 'open -e'],
        attrib: ['chmod'],
      },
    };

    return alternatives[this.currentOS.platform]?.[primaryCommand] || [];
  }

  normalizeCommand(command: string): string {
    const normalized = command.trim();
    return this.currentOS.platform === 'windows'
      ? this.normalizeWindowsCommand(normalized)
      : this.normalizeUnixCommand(normalized);
  }

  private normalizeWindowsCommand(command: string): string {
    // Do NOT touch URLs
    let normalized = command.replace(
      /(?<!https?):\/(?!\/)/g,
      '\\'
    );

    const replacements: Record<string, string> = {
      'ls -la': 'dir',
      'ls -l': 'dir',
      ls: 'dir',
      cat: 'type',
      'cp -r': 'xcopy /E /I',
      cp: 'copy',
      mv: 'move',
      rm: 'del',
      clear: 'cls',
      grep: 'findstr',
      'ps aux': 'tasklist',
      kill: 'taskkill',
      nano: 'notepad',
    };

    for (const key of Object.keys(replacements).sort((a, b) => b.length - a.length)) {
      if (normalized === key || normalized.startsWith(key + ' ')) {
        normalized = normalized.replace(key, replacements[key]);
        break;
      }
    }

    return normalized;
  }

  private normalizeUnixCommand(command: string): string {
    let normalized = command.replace(/\\/g, '/');

    const replacements: Record<string, string> = {
      dir: 'ls -la',
      type: 'cat',
      copy: 'cp',
      move: 'mv',
      del: 'rm',
      cls: 'clear',
      findstr: 'grep',
      tasklist: 'ps aux',
      taskkill: 'kill',
      icacls: 'chmod',
      attrib: 'chmod',
      notepad: 'nano',
    };

    for (const key of Object.keys(replacements).sort((a, b) => b.length - a.length)) {
      if (normalized === key || normalized.startsWith(key + ' ')) {
        normalized = normalized.replace(key, replacements[key]);
        break;
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
    return this.currentOS.platform !== 'windows' || !!process.env.USERNAME;
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
      shell: this.currentOS.shell || 'unknown',
    };
  }
}
