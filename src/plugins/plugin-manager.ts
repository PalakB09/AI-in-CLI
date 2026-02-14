import * as fs from "fs-extra";
import * as path from "path";
import * as os from "os";
import { Plugin, ResolvedCommand, OS, SafetyResult } from "../types";

export class PluginManager {
  private plugins: Plugin[] = [];
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = path.join(os.homedir(), ".ai-cli", "plugins");
  }

  async loadPlugins(): Promise<void> {
    try {
      if (!await fs.pathExists(this.pluginsDir)) {
        await fs.ensureDir(this.pluginsDir);
        return;
      }

      const pluginFiles = await fs.readdir(this.pluginsDir);
      for (const file of pluginFiles) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          try {
            const pluginPath = path.join(this.pluginsDir, file);
            const pluginModule = require(pluginPath);
            const plugin: Plugin = pluginModule.default || pluginModule;
            if (this.validatePlugin(plugin)) {
              this.plugins.push(plugin);
              console.log(`Loaded plugin: ${plugin.name} v${plugin.version}`);
            }
          } catch (error) {
            console.warn(`Failed to load plugin ${file}:`, error instanceof Error ? error.message : String(error));
          }
        }
      }
    } catch (error) {
      console.warn("Plugin loading error:", error instanceof Error ? error.message : String(error));
    }
  }

  private validatePlugin(plugin: any): plugin is Plugin {
    return plugin && typeof plugin.name === 'string' && typeof plugin.version === 'string';
  }

  getRules(input: string, os: OS): ResolvedCommand | null {
    for (const plugin of this.plugins) {
      if (plugin.getRules) {
        const result = plugin.getRules(input, os);
        if (result) return result;
      }
    }
    return null;
  }

  getSafetyChecks(command: ResolvedCommand): SafetyResult | null {
    for (const plugin of this.plugins) {
      if (plugin.getSafetyChecks) {
        const result = plugin.getSafetyChecks(command);
        if (result) return result;
      }
    }
    return null;
  }

  onCommandExecuted(command: ResolvedCommand, success: boolean): void {
    for (const plugin of this.plugins) {
      if (plugin.onCommandExecuted) {
        plugin.onCommandExecuted(command, success);
      }
    }
  }
}