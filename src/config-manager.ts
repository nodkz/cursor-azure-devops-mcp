import fs from 'fs';
import path from 'path';
import os from 'os';
import { z } from 'zod';
import dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Define configuration schema with Zod
const ConfigSchema = z.object({
  version: z.string(),
  server: z.object({
    port: z.coerce.number().default(3000),
    host: z.string().default('localhost'),
  }),
  azureDevOps: z.object({
    organizationUrl: z.string().url().optional(),
    token: z.string().optional(),
    project: z.string().optional(),
  }),
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
    enableConsole: z.boolean().default(true),
  }),
});

// Type for the configuration
export type Config = z.infer<typeof ConfigSchema>;

// Create a default config object
const DEFAULT_CONFIG: Config = {
  version: '1.0.0',
  server: {
    port: 3000,
    host: 'localhost',
  },
  azureDevOps: {
    organizationUrl: undefined,
    token: undefined,
    project: undefined,
  },
  logging: {
    level: 'info',
    enableConsole: true,
  },
};

/**
 * Configuration Manager class that loads configuration from multiple sources
 * with the following priority:
 * 1. Command line arguments
 * 2. VSCode/Cursor IDE settings
 * 3. Environment variables / .env file
 * 4. Default values
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config | null = null;
  private packageJson: { version: string } = { version: '1.0.0' };

  private constructor() {
    try {
      // Load package.json for version info
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        this.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error loading package.json:', error);
    }
  }

  /**
   * Get the singleton instance of the ConfigManager
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Parse command line arguments using yargs
   */
  private parseCommandLineArgs(): Partial<Config> {
    const argv = yargs(hideBin(process.argv))
      .options({
        port: {
          type: 'number',
          describe: 'Server port number',
          alias: 'p',
        },
        host: {
          type: 'string',
          describe: 'Server hostname',
          alias: 'h',
        },
        'azure-org-url': {
          type: 'string',
          describe: 'Azure DevOps organization URL',
          alias: 'org',
        },
        'azure-token': {
          type: 'string',
          describe: 'Azure DevOps personal access token',
          alias: 'token',
        },
        'azure-project': {
          type: 'string',
          describe: 'Azure DevOps project name',
          alias: 'project',
        },
        'log-level': {
          type: 'string',
          describe: 'Logging level (error, warn, info, debug)',
          choices: ['error', 'warn', 'info', 'debug'],
          alias: 'log',
        },
      })
      .help()
      .alias('help', '?')
      .parseSync();

    const result: Partial<Config> = {
      server: {
        port: DEFAULT_CONFIG.server.port,
        host: DEFAULT_CONFIG.server.host,
      },
      azureDevOps: {
        organizationUrl: undefined,
        token: undefined,
        project: undefined,
      },
      logging: {
        level: DEFAULT_CONFIG.logging.level,
        enableConsole: DEFAULT_CONFIG.logging.enableConsole,
      },
    };

    // Map command line args to config structure
    if (argv.port !== undefined) {
      result.server!.port = argv.port;
    }

    if (argv.host !== undefined) {
      result.server!.host = argv.host;
    }

    if (argv['azure-org-url'] !== undefined) {
      result.azureDevOps!.organizationUrl = argv['azure-org-url'];
    }

    if (argv['azure-token'] !== undefined) {
      result.azureDevOps!.token = argv['azure-token'];
    }

    if (argv['azure-project'] !== undefined) {
      result.azureDevOps!.project = argv['azure-project'];
    }

    if (argv['log-level'] !== undefined) {
      result.logging!.level = argv['log-level'] as 'error' | 'warn' | 'info' | 'debug';
    }

    return result;
  }

  /**
   * Load configuration from VSCode/Cursor IDE settings
   */
  private loadIdeSettings(): Partial<Config> {
    const result: Partial<Config> = {
      server: {
        port: DEFAULT_CONFIG.server.port,
        host: DEFAULT_CONFIG.server.host,
      },
      azureDevOps: {
        organizationUrl: undefined,
        token: undefined,
        project: undefined,
      },
      logging: {
        level: DEFAULT_CONFIG.logging.level,
        enableConsole: DEFAULT_CONFIG.logging.enableConsole,
      },
    };

    // Standard locations for VSCode settings
    const vscodePaths = [
      // Global VSCode settings
      path.join(os.homedir(), '.vscode', 'settings.json'),
      // Workspace VSCode settings
      path.join(process.cwd(), '.vscode', 'settings.json'),
      // Cursor IDE settings (similar location to VSCode)
      path.join(os.homedir(), '.cursor', 'settings.json'),
      path.join(process.cwd(), '.cursor', 'settings.json'),
    ];

    for (const settingsPath of vscodePaths) {
      try {
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

          // Try to find Azure DevOps settings in VSCode/Cursor configs
          if (settings['azureDevOps.organization']) {
            result.azureDevOps!.organizationUrl = `https://dev.azure.com/${settings['azureDevOps.organization']}`;
          }

          if (settings['azureDevOps.orgUrl']) {
            result.azureDevOps!.organizationUrl = settings['azureDevOps.orgUrl'];
          }

          if (settings['azureDevOps.token']) {
            result.azureDevOps!.token = settings['azureDevOps.token'];
          }

          if (settings['azureDevOps.project']) {
            result.azureDevOps!.project = settings['azureDevOps.project'];
          }

          // Also look for specific cursor-azure-devops-mcp settings
          const cursorSettings = settings['cursor-azure-devops-mcp'];
          if (cursorSettings) {
            if (cursorSettings.port !== undefined) {
              result.server!.port = cursorSettings.port;
            }

            if (cursorSettings.host !== undefined) {
              result.server!.host = cursorSettings.host;
            }

            if (cursorSettings.organizationUrl !== undefined) {
              result.azureDevOps!.organizationUrl = cursorSettings.organizationUrl;
            }

            if (cursorSettings.token !== undefined) {
              result.azureDevOps!.token = cursorSettings.token;
            }

            if (cursorSettings.project !== undefined) {
              result.azureDevOps!.project = cursorSettings.project;
            }

            if (cursorSettings.logLevel !== undefined) {
              result.logging!.level = cursorSettings.logLevel as
                | 'error'
                | 'warn'
                | 'info'
                | 'debug';
            }
          }
        }
      } catch (_error) {
        // Silently ignore errors reading settings files
      }
    }

    return result;
  }

  /**
   * Load configuration from environment variables / .env file
   */
  private loadEnvConfig(): Partial<Config> {
    // Also try loading from the current working directory
    const cwd = process.cwd();
    const cwdEnvPath = path.join(cwd, '.env');
    if (fs.existsSync(cwdEnvPath)) {
      dotenv.config({ path: cwdEnvPath });
    }

    // Try loading from the parent directory
    const parentEnvPath = path.join(cwd, '..', '.env');
    if (fs.existsSync(parentEnvPath)) {
      dotenv.config({ path: parentEnvPath });
    }

    // Create the result configuration object directly from environment variables
    return {
      server: {
        port: process.env.PORT ? parseInt(process.env.PORT, 10) : DEFAULT_CONFIG.server.port,
        host: process.env.HOST || DEFAULT_CONFIG.server.host,
      },
      azureDevOps: {
        organizationUrl: process.env.AZURE_DEVOPS_ORG_URL,
        token: process.env.AZURE_DEVOPS_TOKEN,
        project: process.env.AZURE_DEVOPS_PROJECT,
      },
      logging: {
        level: (process.env.LOG_LEVEL || DEFAULT_CONFIG.logging.level) as
          | 'error'
          | 'warn'
          | 'info'
          | 'debug',
        enableConsole: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
      },
    };
  }

  /**
   * Load the configuration from all sources with proper priority
   */
  public loadConfig(): Config {
    if (this.config) {
      return this.config;
    }

    // Start with default config
    const baseConfig = {
      ...DEFAULT_CONFIG,
      version: this.packageJson.version,
    };

    // Get config from different sources
    const envConfig = this.loadEnvConfig();
    const ideConfig = this.loadIdeSettings();
    const cmdLineConfig = this.parseCommandLineArgs();

    // Directly create the merged config to avoid issues with nested objects
    const mergedConfig = {
      version: this.packageJson.version,
      server: {
        port:
          cmdLineConfig.server?.port ||
          ideConfig.server?.port ||
          envConfig.server?.port ||
          DEFAULT_CONFIG.server.port,
        host:
          cmdLineConfig.server?.host ||
          ideConfig.server?.host ||
          envConfig.server?.host ||
          DEFAULT_CONFIG.server.host,
      },
      azureDevOps: {
        organizationUrl:
          cmdLineConfig.azureDevOps?.organizationUrl ||
          ideConfig.azureDevOps?.organizationUrl ||
          envConfig.azureDevOps?.organizationUrl,
        token:
          cmdLineConfig.azureDevOps?.token ||
          ideConfig.azureDevOps?.token ||
          envConfig.azureDevOps?.token,
        project:
          cmdLineConfig.azureDevOps?.project ||
          ideConfig.azureDevOps?.project ||
          envConfig.azureDevOps?.project,
      },
      logging: {
        level: (cmdLineConfig.logging?.level ||
          ideConfig.logging?.level ||
          envConfig.logging?.level ||
          DEFAULT_CONFIG.logging.level) as 'error' | 'warn' | 'info' | 'debug',
        enableConsole:
          cmdLineConfig.logging?.enableConsole !== undefined
            ? cmdLineConfig.logging?.enableConsole
            : ideConfig.logging?.enableConsole !== undefined
              ? ideConfig.logging?.enableConsole
              : envConfig.logging?.enableConsole !== undefined
                ? envConfig.logging?.enableConsole
                : DEFAULT_CONFIG.logging.enableConsole,
      },
    };

    // Validate the configuration
    try {
      this.config = ConfigSchema.parse(mergedConfig);
      return this.config;
    } catch (_error) {
      console.error('Configuration validation error:', _error);
      // Return a default config if validation fails
      return baseConfig;
    }
  }

  /**
   * Print the current configuration (with sensitive info redacted)
   */
  public printConfig(): void {
    const config = this.loadConfig();

    // Create a copy with redacted token
    const printableConfig = {
      ...config,
      azureDevOps: {
        ...config.azureDevOps,
        token: config.azureDevOps.token ? '*****' : undefined,
      },
    };

    console.log('=== Configuration ===');
    console.log(JSON.stringify(printableConfig, null, 2));
    console.log('====================');
  }

  /**
   * Check if the Azure DevOps configuration is valid
   */
  public isAzureDevOpsConfigValid(): boolean {
    const config = this.loadConfig();
    return !!config.azureDevOps.organizationUrl && !!config.azureDevOps.token;
  }
}

// Export an instance of the config manager
export const configManager = ConfigManager.getInstance();

// Export a function to get the config for backward compatibility
export function loadConfig(): Config {
  return configManager.loadConfig();
}
