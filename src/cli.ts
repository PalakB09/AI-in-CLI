#!/usr/bin/env node
import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: true,
});
console.log(
  "[ENV]",
  "CWD =", process.cwd(),
  "| GEMINI_API_KEY =",
  process.env.GEMINI_API_KEY?.slice(0, 6) || "NOT FOUND"
);


import { Command } from "commander";
import chalk from "chalk";
import { AIService } from "./core/ai-service";
import { ShellIntegrator } from "./shell/shell-integrator";
import { CommandResolver } from "./resolver/command-resolver";
import { SafetyValidator } from "./safety/safety-validator";
import { StorageManager } from "./storage/storage-manager";
import { OSAdapter } from "./os/os-adapter";

const program = new Command();

program
  .name("ai")
  .description("AI-powered command assistant for existing terminals")
  .version("1.0.0");

program
  .command("suggest")
  .description("Get command suggestions for natural language input")
  .argument("<input...>", "Natural language description of desired action")
  .option("-e, --explain", "Explain the suggested command before execution")
  .option("-d, --dry-run", "Show what would be executed without running")
  .option("--shell <shell>", "Specify shell type (bash/zsh/powershell/cmd)")
  .action(async (inputParts: string[], options) => {
    console.log('RAW INPUT Parts:', inputParts);
    const input = inputParts.join(" ");
    console.log('RAW INPUT:', input);
    try {
      const aiService = new AIService();
      const resolver = new CommandResolver(aiService);

      const validator = new SafetyValidator();
      const osAdapter = new OSAdapter();

      const resolvedCommand = await resolver.resolve(input, osAdapter.getOS());

      if (!resolvedCommand) {
        console.log(
          chalk.yellow("Could not resolve your request to a command."),
        );
        return;
      }

      const safetyResult = await validator.validate(resolvedCommand);

      if (options.explain || safetyResult.warning) {
        console.log(chalk.blue("Command explanation:"));
        console.log(resolvedCommand.explanation || "No explanation available");
        console.log("");
      }

      if (safetyResult.blocked) {
        console.log(chalk.red("⚠️  SAFETY BLOCK: ") + safetyResult.reason);
        return;
      }

      if (safetyResult.warning) {
        console.log(
          chalk.yellow("⚠️  SAFETY WARNING: ") + safetyResult.warning,
        );
      }

      console.log(chalk.green("Suggested command:"));
      console.log(chalk.cyan(resolvedCommand.command));

      if (!options.dryRun && !safetyResult.blocked) {
        const inquirer = require("inquirer");

        const { shouldExecute } = await inquirer.prompt([
          {
            type: "confirm",
            name: "shouldExecute",
            message: "Execute this command?",
            default: false,
          },
        ]);

        if (shouldExecute) {
          const { execSync } = require("child_process");
          try {
            const isWindows = process.platform === "win32";

            if (isWindows) {
              execSync(`powershell -Command "${resolvedCommand.command}"`, {
                stdio: "inherit",
              });
            } else {
              execSync(resolvedCommand.command, { stdio: "inherit" });
            }
          } catch (error) {
            console.error(
              chalk.red("Command execution failed:"),
              error.message,
            );
          }
        }
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("install")
  .description("Install shell integration")
  .option("--shell <shell>", "Shell type (bash/zsh/powershell/cmd)")
  .action(async (options) => {
    try {
      const integrator = new ShellIntegrator();
      await integrator.install(options.shell);
      console.log(chalk.green("✓ Shell integration installed successfully"));
    } catch (error) {
      console.error(chalk.red("Installation failed:"), error.message);
    }
  });

program
  .command("uninstall")
  .description("Remove shell integration")
  .option("--shell <shell>", "Shell type (bash/zsh/powershell/cmd)")
  .action(async (options) => {
    try {
      const integrator = new ShellIntegrator();
      await integrator.uninstall(options.shell);
      console.log(chalk.green("✓ Shell integration removed successfully"));
    } catch (error) {
      console.error(chalk.red("Uninstallation failed:"), error.message);
    }
  });

program
  .command("vault")
  .description("Manage command vault")
  .argument("[action]", "Action to perform (list|search|add|remove)")
  .argument("[query]", "Search query or command to add")
  .action(async (action = "list", query = "") => {
    try {
      const storage = new StorageManager();

      switch (action) {
        case "list":
          const commands = await storage.getAllCommands();
          console.table(commands);
          break;
        case "search":
          const results = await storage.searchCommands(query);
          console.table(results);
          break;
        case "add":
          if (!query) {
            console.log(chalk.red("Please provide a command to add"));
            return;
          }
          await storage.addCommand(query);
          console.log(chalk.green("✓ Command added to vault"));
          break;
        default:
          console.log(
            chalk.red("Invalid action. Use: list, search, add, remove"),
          );
      }
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
    }
  });

program
  .command("debug")
  .description("Show debugging information")
  .action(() => {
    const osAdapter = new OSAdapter();
    console.log(chalk.blue("Debug Information:"));
    console.log("OS:", osAdapter.getOS());
    console.log("Shell:", process.env.SHELL || "Unknown");
    console.log("Node Version:", process.version);
    console.log("Working Directory:", process.cwd());
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
