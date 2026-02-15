#!/usr/bin/env node
import dotenv from "dotenv";
import path from "path";
import chalk from "chalk";
import { Command } from "commander";
import { spawn } from "child_process";

import { AIService } from "./core/ai-service";
import { ShellIntegrator } from "./shell/shell-integrator";
import { CommandResolver } from "./resolver/command-resolver";
import { SafetyValidator } from "./safety/safety-validator";
import { StorageManager } from "./storage/storage-manager";
import { OSAdapter } from "./os/os-adapter";
import { PluginManager } from "./plugins/plugin-manager";
import { ResolvedCommand } from "./types";

dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
  override: true,
});

const program = new Command();

program
  .name("ai")
  .description("AI-powered command assistant for existing terminals")
  .version("1.0.0");

/* ---------------------------------------------------- */
/* SHARED INITIALIZATION                                */
/* ---------------------------------------------------- */

async function createContext() {
  const pluginManager = new PluginManager();
  await pluginManager.init();

  const aiService = new AIService();
  const resolver = new CommandResolver(aiService, pluginManager);
  const validator = new SafetyValidator(pluginManager);
  const storage = new StorageManager();
  const osAdapter = new OSAdapter();

  return {
    pluginManager,
    resolver,
    validator,
    storage,
    osAdapter,
  };
}

/* ---------------------------------------------------- */
/* EXECUTION PIPELINE                                   */
/* ---------------------------------------------------- */

async function executeResolvedCommand(
  resolved: ResolvedCommand,
  validator: SafetyValidator
): Promise<void> {
  const safety = await validator.validate(resolved);

  if (safety.blocked) {
    console.log(chalk.red("🚫 BLOCKED:"), safety.reason);
    return;
  }

  if (safety.warning) {
    console.log(chalk.yellow("⚠️ WARNING:"), safety.warning);
  }

  // Handle variables
  let commands = [...resolved.commands];
  if (resolved.variables) {
    const inquirer = require("inquirer");
    const answers = await inquirer.prompt(
      Object.keys(resolved.variables).map(name => ({
        type: "input",
        name,
        message: `Enter value for ${name}:`,
      }))
    );

    commands = commands.map(cmd => {
      let result = cmd;
      for (const [k, v] of Object.entries(answers)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
      return result;
    });
  }

  console.log(chalk.green("Commands:"));
  commands.forEach((c, i) => {
    console.log(`${i + 1}. ${chalk.cyan(c)}`);
  });

  const inquirer = require("inquirer");

  for (let i = 0; i < commands.length; i++) {
    const { execute } = await inquirer.prompt([
      {
        type: "confirm",
        name: "execute",
        message:
          commands.length > 1
            ? `Execute step ${i + 1}?`
            : "Execute this command?",
        default: false,
      },
    ]);

    if (!execute) {
      console.log(chalk.yellow("Skipped."));
      continue;
    }

    await runCommand(commands[i]);
  }
}

async function runCommand(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";

    const child = isWindows
      ? spawn("powershell", ["-Command", cmd], { stdio: "inherit" })
      : spawn(cmd, { shell: true, stdio: "inherit" });

    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });

    child.on("error", reject);
  });
}

/* ---------------------------------------------------- */
/* COMMAND: suggest                                     */
/* ---------------------------------------------------- */

program
  .command("suggest")
  .argument("<input...>")
  .option("-e, --explain", "Explain command")
  .option("-l, --learning", "Enable learning mode")
  .action(async (inputParts, options) => {
    const input = inputParts.join(" ");
    const ctx = await createContext();

    const resolved = await ctx.resolver.resolve(
      input,
      ctx.osAdapter.getOS(),
      options.learning,
      true
    );

    if (!resolved) {
      console.log(chalk.yellow("Could not resolve command."));
      return;
    }

    if (options.explain) {
      console.log(chalk.blue("Explanation:"));
      console.log(resolved.explanation);
    }

    await executeResolvedCommand(resolved, ctx.validator);
  });

/* ---------------------------------------------------- */
/* COMMAND: install / uninstall                         */
/* ---------------------------------------------------- */

program
  .command("install")
  .option("--shell <shell>")
  .action(async options => {
    const integrator = new ShellIntegrator();
    await integrator.install(options.shell);
    console.log(chalk.green("✓ Shell integration installed"));
  });

program
  .command("uninstall")
  .option("--shell <shell>")
  .action(async options => {
    const integrator = new ShellIntegrator();
    await integrator.uninstall(options.shell);
    console.log(chalk.green("✓ Shell integration removed"));
  });

/* ---------------------------------------------------- */
/* COMMAND: vault run                                   */
/* ---------------------------------------------------- */

program
  .command("vault:run")
  .argument("<idOrName>")
  .action(async idOrName => {
    const ctx = await createContext();
    const all = await ctx.storage.getAllCommands();

    const cmd =
      all.find(c => c.id === idOrName) ||
      all.find(c => c.name === idOrName);

    if (!cmd) {
      console.log(chalk.red("Command not found in vault."));
      return;
    }

    await ctx.storage.incrementUsage(cmd.id);

    const resolved: ResolvedCommand = {
      commands: cmd.commands,
      explanation: cmd.description,
      tags: cmd.tags,
      confidence: cmd.confidence,
      source: "vault",
      variables: cmd.variables,
    };

    await executeResolvedCommand(resolved, ctx.validator);
  });

/* ---------------------------------------------------- */
/* DEBUG                                                */
/* ---------------------------------------------------- */

program
  .command("debug")
  .action(() => {
    const osAdapter = new OSAdapter();
    console.log(chalk.blue("Debug Info"));
    console.log("OS:", osAdapter.getOS());
    console.log("Node:", process.version);
    console.log("CWD:", process.cwd());
  });

/* ---------------------------------------------------- */

async function main() {
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(chalk.red("Fatal error:"), err);
  process.exit(1);
});
