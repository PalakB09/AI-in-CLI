import { ResolvedCommand, SafetyResult } from "../types";

export class SafetyValidator {
  private readonly dangerousPatterns = [
    // System destruction
    /rm\s+-rf\s+\/($|\s)/i,
    /rmdir\/s\/q\s+c:\\\\/i,
    /format\s+c:/i,
    /mkfs\./i,
    /dd\s+if=.*of=\/dev\/sd/i,

    // Process killing
    /kill\s+-9\s+1$/i,
    /killall\s+-9/i,
    /taskkill\/f/i,

    // Docker dangerous operations
    /docker\s+system\s+prune\s+-af/i,
    /docker\s+rm\s+-vf/i,
    /docker\s+rmi\s+-f/i,

    // Network configuration
    /iptables\s+-F/i,
    /ip\s+link\s+set.*down/i,
    /netsh.*reset/i,

    // User management
    /userdel\s+-r/i,
    /deluser.*--remove-home/i,

    // Configuration files
    />\s*\/etc\/passwd/i,
    />\s*\/etc\/shadow/i,
    />\s*\/etc\/sudoers/i,

    // Boot management
    /update-grub/i,
    /grub-install/i,
    /bootsect/i,
  ];

  private readonly warningPatterns = [
    // File deletion
    /rm\s+-rf/i,
    /rmdir\/s/i,
    /del.*\/s/i,

    // Disk operations
    /fdisk/i,
    /diskpart/i,
    /format/i,

    // Process operations
    /kill\s+-9/i,
    /taskkill\/f/i,

    // System services
    /systemctl\s+stop/i,
    /service.*stop/i,
    /net\s+stop/i,

    // Package management
    /apt-get\s+remove/i,
    /yum\s+remove/i,
    /dnf\s+remove/i,
    /npm\s+uninstall/i,

    // Permissions
    /chmod\s+777/i,
    /icacls.*grant/i,
    /attrib.*-r/i,
  ];

  async validate(command: ResolvedCommand): Promise<SafetyResult> {
    const normalizedCommand = command.command.toLowerCase().trim();

    // Check for blocked patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(normalizedCommand)) {
        return {
          blocked: true,
          reason: this.getBlockReason(pattern, command.command),
          riskLevel: "high",
        };
      }
    }

    // Check for warning patterns
    for (const pattern of this.warningPatterns) {
      if (pattern.test(normalizedCommand)) {
        return {
          blocked: false,
          warning: this.getWarningReason(pattern, command.command),
          riskLevel: "high",
        };
      }
    }

    // Additional contextual checks
    const contextWarnings = this.checkContextualDangers(command);
    if (contextWarnings) {
      return contextWarnings;
    }

    return {
      blocked: false,
      riskLevel: "low",
    };
  }

  private getBlockReason(pattern: RegExp, command: string): string {
    const cmd = command.toLowerCase();

    if (/rm\s+-rf\s+\/($|\s)/i.test(cmd)) {
      return "Attempting to delete root directory - extremely dangerous operation";
    }
    if (/format\s+c:/i.test(cmd)) {
      return "Attempting to format system drive - data loss will occur";
    }
    if (/kill\s+-9\s+1$/i.test(cmd)) {
      return "Attempting to kill init process - system will become unstable";
    }
    if (/docker\s+system\s+prune\s+-af/i.test(cmd)) {
      return "Docker system prune with -af will remove all containers, images, and networks";
    }

    return "Command contains dangerous operations that could cause system damage";
  }

  private getWarningReason(pattern: RegExp, command: string): string {
    const cmd = command.toLowerCase();

    if (/rm\s+-rf/i.test(cmd)) {
      return "This command will recursively delete files and directories. Review the target carefully.";
    }

    if (/kill\s+-9/i.test(cmd)) {
      return "Force killing processes can cause data loss or system instability.";
    }

    if (/systemctl\s+stop/i.test(cmd)) {
      return "Stopping system services may affect dependent applications.";
    }

    if (/format/i.test(cmd)) {
      return "Formatting operations will erase all data on the target device.";
    }

    return "This command performs potentially destructive operations. Proceed with caution.";
  }

  private checkContextualDangers(
    command: ResolvedCommand,
  ): SafetyResult | null {
    const cmd = command.command.toLowerCase().trim();

    // Check for sudo/sudoers usage
    if (cmd.includes("sudo") || cmd.includes("runas")) {
      return {
        blocked: false,
        warning:
          "This command requires elevated privileges. Ensure you trust the command execution.",
        riskLevel: "medium",
      };
    }

    // Check for curl/pipe to shell
    if ((cmd.includes("curl") || cmd.includes("wget")) && cmd.includes("|")) {
      if (
        cmd.includes("sh") ||
        cmd.includes("bash") ||
        cmd.includes("powershell")
      ) {
        return {
          blocked: false,
          warning:
            "Executing downloaded content directly can be dangerous. Verify the source first.",
          riskLevel: "high",
        };
      }
    }

    // Check for chmod with recursive flag
    if (cmd.includes("chmod") && cmd.includes("-r")) {
      return {
        blocked: false,
        warning:
          "Recursive permission changes can affect many files. Review carefully.",
        riskLevel: "medium",
      };
    }

    // Check for environment variable modifications
    if (
      cmd.includes("export") ||
      cmd.includes("setenv") ||
      cmd.includes("set ")
    ) {
      return {
        blocked: false,
        warning: "Modifying environment variables can affect system behavior.",
        riskLevel: "low",
      };
    }

    return null;
  }

  isDryRunPossible(command: string): boolean {
    const cmd = command.toLowerCase().trim();

    // Commands that support dry-run flags
    const dryRunCommands = [
      { cmd: "rm", flag: "--dry-run" },
      { cmd: "rsync", flag: "--dry-run" },
      { cmd: "ansible-playbook", flag: "--check" },
      { cmd: "terraform", flag: "plan" },
      { cmd: "helm", flag: "--dry-run" },
      { cmd: "kubectl", flag: "--dry-run" },
    ];

    for (const { cmd: baseCmd, flag } of dryRunCommands) {
      if (cmd.startsWith(baseCmd + " ") && !cmd.includes(flag)) {
        return true;
      }
    }

    return false;
  }

  addDryRunFlag(command: string): string {
    const cmd = command.toLowerCase().trim();

    if (cmd.startsWith("rm ") && !cmd.includes("--dry-run")) {
      return command.replace(/^rm\s+/, "rm --dry-run ");
    }
    if (cmd.startsWith("rsync ") && !cmd.includes("--dry-run")) {
      return command.replace(/^rsync\s+/, "rsync --dry-run ");
    }
    if (cmd.startsWith("ansible-playbook ") && !cmd.includes("--check")) {
      return command.replace(
        /^ansible-playbook\s+/,
        "ansible-playbook --check ",
      );
    }
    if (
      cmd.startsWith("terraform ") &&
      !cmd.includes("plan") &&
      !cmd.includes("apply")
    ) {
      return command.replace(/^terraform\s+/, "terraform plan ");
    }
    if (cmd.startsWith("helm ") && !cmd.includes("--dry-run")) {
      return command.replace(/^helm\s+/, "helm --dry-run ");
    }
    if (cmd.startsWith("kubectl ") && !cmd.includes("--dry-run")) {
      return command.replace(/^kubectl\s+/, "kubectl --dry-run ");
    }

    return command;
  }

  async promptConfirmation(
    command: string,
    riskLevel: string,
  ): Promise<boolean> {
    if (riskLevel === "low") {
      return true;
    }

    const inquirer = require("inquirer");
    const message =
      riskLevel === "high"
        ? `⚠️  HIGH RISK: Are you absolutely sure you want to execute?\n${command}`
        : `⚠️  MEDIUM RISK: Are you sure you want to execute this command?\n${command}`;

    const { shouldExecute } = await inquirer.prompt([
      {
        type: "confirm",
        name: "shouldExecute",
        message: "Execute this command?",
        default: false,
      },
    ]);

    return shouldExecute;
  }
}
