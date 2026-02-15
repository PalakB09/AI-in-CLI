import { ResolvedCommand, SafetyResult } from "../types";
import { PluginManager } from "../plugins/plugin-manager";

export class SafetyValidator {
  private readonly dangerousPatterns: RegExp[] = [
    /rm\s+-rf\s+\/(\s|$)/i,
    /rmdir\s*\/s\s*\/q\s+c:\\\\/i,
    /format\s+c:/i,
    /mkfs\./i,
    /dd\s+if=.*of=\/dev\/sd/i,

    /kill\s+-9\s+1(\s|$)/i,
    /killall\s+-9/i,
    /taskkill\s*\/f/i,

    /docker\s+system\s+prune\s+-af/i,
    /docker\s+rm\s+-vf/i,
    /docker\s+rmi\s+-f/i,

    /iptables\s+-F/i,
    /ip\s+link\s+set.*down/i,
    /netsh.*reset/i,

    /userdel\s+-r/i,
    /deluser.*--remove-home/i,

    />\s*\/etc\/passwd/i,
    />\s*\/etc\/shadow/i,
    />\s*\/etc\/sudoers/i,

    /update-grub/i,
    /grub-install/i,
    /bootsect/i,
  ];

  private readonly warningPatterns: RegExp[] = [
    /rm\s+-rf/i,
    /rmdir\s*\/s/i,
    /del.*\/s/i,
    /fdisk/i,
    /diskpart/i,
    /kill\s+-9/i,
    /taskkill/i,
    /docker\s+(rm|rmi|system)/i,
    /iptables/i,
    /netsh/i,
    /chmod\s+-r/i,
  ];

  private pluginManager: PluginManager;
  private initialized = false;

  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.pluginManager.init();
  }

  async validate(resolvedCommand: ResolvedCommand): Promise<SafetyResult> {
    await this.init();

    // 1️⃣ Plugin safety rules FIRST
    const pluginResult =
      this.pluginManager.getSafetyChecks(resolvedCommand);
    if (pluginResult) {
      return pluginResult;
    }

    // 2️⃣ Built-in hard blocks
    for (const command of resolvedCommand.commands) {
      const cmd = command.toLowerCase().trim();

      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(cmd)) {
          return {
            blocked: true,
            reason: this.getBlockReason(cmd),
            riskLevel: "high",
          };
        }
      }

      // 3️⃣ Built-in warnings
      for (const pattern of this.warningPatterns) {
        if (pattern.test(cmd)) {
          return {
            blocked: false,
            warning: this.getWarningReason(cmd),
            riskLevel: "high",
          };
        }
      }
    }

    // 4️⃣ Contextual checks
    const contextual = this.checkContextualDangers(resolvedCommand);
    if (contextual) {
      return contextual;
    }

    return {
      blocked: false,
      riskLevel: "low",
    };
  }

  private getBlockReason(cmd: string): string {
    if (/rm\s+-rf\s+\/(\s|$)/i.test(cmd)) {
      return "Attempting to delete the root directory.";
    }
    if (/format\s+c:/i.test(cmd)) {
      return "Formatting the system drive will destroy all data.";
    }
    if (/kill\s+-9\s+1/i.test(cmd)) {
      return "Killing PID 1 will destabilize the system.";
    }
    if (/docker\s+system\s+prune\s+-af/i.test(cmd)) {
      return "Docker prune with -af removes all containers and images.";
    }
    return "Command contains dangerous operations.";
  }

  private getWarningReason(cmd: string): string {
    if (/rm\s+-rf/i.test(cmd)) {
      return "Recursive deletion can remove large amounts of data.";
    }
    if (/kill\s+-9/i.test(cmd)) {
      return "Force killing processes can cause instability.";
    }
    if (/chmod\s+-r/i.test(cmd)) {
      return "Recursive permission changes affect many files.";
    }
    if (/docker/i.test(cmd)) {
      return "Docker operations may remove containers or images.";
    }
    return "This command may have destructive side effects.";
  }

  private checkContextualDangers(
    resolvedCommand: ResolvedCommand
  ): SafetyResult | null {
    for (const command of resolvedCommand.commands) {
      const cmd = command.toLowerCase().trim();

      if (cmd.includes("sudo") || cmd.includes("runas")) {
        return {
          blocked: false,
          warning:
            "This command requires elevated privileges.",
          riskLevel: "medium",
        };
      }

      if (
        (cmd.includes("curl") || cmd.includes("wget")) &&
        cmd.includes("|") &&
        (cmd.includes("sh") || cmd.includes("bash") || cmd.includes("powershell"))
      ) {
        return {
          blocked: false,
          warning:
            "Piping remote scripts directly into a shell is dangerous.",
          riskLevel: "high",
        };
      }
    }

    return null;
  }

  isDryRunPossible(): boolean {
    // Explicitly disabled — no false safety guarantees
    return false;
  }

  addDryRunFlag(command: string): string {
    // No fake dry-runs
    return `echo "[DRY RUN] ${command}"`;
  }
}
