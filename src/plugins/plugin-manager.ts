import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { Plugin, ResolvedCommand, OS, SafetyResult } from "../types";

export class PluginManager {
  private plugins: Plugin[] = [];
  private pluginsDir: string;
  private initialized = false;

  constructor() {
    this.pluginsDir = path.join(os.homedir(), ".ai-cli", "plugins");
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadPlugins();
  }

  private async loadPlugins(): Promise<void> {
    try {
      if (!(await fs.pathExists(this.pluginsDir))) {
        await fs.ensureDir(this.pluginsDir);
        return;
      }

      const pluginFiles = await fs.readdir(this.pluginsDir);

      for (const file of pluginFiles) {
        // NEVER load .ts at runtime
        if (!file.endsWith(".js")) continue;

        const pluginPath = path.join(this.pluginsDir, file);

        try {
          const pluginModule = require(pluginPath);
          const plugin: Plugin = pluginModule.default || pluginModule;

          if (!this.validatePlugin(plugin)) continue;

          // Prevent duplicate plugin names
          if (this.plugins.some(p => p.name === plugin.name)) {
            console.warn(`Duplicate plugin ignored: ${plugin.name}`);
            continue;
          }

          this.plugins.push(plugin);
          console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
        } catch (error) {
          console.warn(
            `Failed to load plugin ${file}:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    } catch (error) {
      console.warn(
        "Plugin loading error:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private validatePlugin(plugin: any): plugin is Plugin {
    return (
      plugin &&
      typeof plugin.name === "string" &&
      typeof plugin.version === "string"
    );
  }

  getRules(input: string, os: OS): ResolvedCommand | null {
    for (const plugin of this.plugins) {
      if (!plugin.getRules) continue;

      try {
        const result = plugin.getRules(input, os);
        if (result) return result;
      } catch (error) {
        console.warn(
          `Plugin rule error (${plugin.name}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    return null;
  }

  getSafetyChecks(command: ResolvedCommand): SafetyResult | null {
    for (const plugin of this.plugins) {
      if (!plugin.getSafetyChecks) continue;

      try {
        const result = plugin.getSafetyChecks(command);
        if (result) return result;
      } catch (error) {
        console.warn(
          `Plugin safety error (${plugin.name}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    return null;
  }

  onCommandExecuted(command: ResolvedCommand, success: boolean): void {
    for (const plugin of this.plugins) {
      if (!plugin.onCommandExecuted) continue;

      try {
        plugin.onCommandExecuted(command, success);
      } catch (error) {
        console.warn(
          `Plugin hook error (${plugin.name}):`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
}
