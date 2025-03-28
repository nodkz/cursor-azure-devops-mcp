#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { configManager } from './config-manager.js';
import { azureDevOpsService } from './tools/azure-devops-service.js';
import { initTools } from './tools/index.js';
import { version, name } from '../package.json';

// Create MCP server
const server = new McpServer({
  name,
  version,
  description: 'MCP Server for Azure DevOps integration with Cursor IDE',
});

// Start server
async function main() {
  // Load configuration from all sources (command line, IDE settings, env vars, defaults)
  const _config = configManager.loadConfig();
  configManager.printConfig();

  // Check if Azure DevOps configuration is valid
  if (!configManager.isAzureDevOpsConfigValid()) {
    console.error('Azure DevOps configuration is missing or invalid.');
    console.error(
      'Please provide organizationUrl and token via command line, IDE settings, or environment variables.'
    );
    process.exit(1);
  }

  try {
    console.info('Starting Azure DevOps MCP Server with stdio transport...');

    // Initialize Azure DevOps API connection
    try {
      await azureDevOpsService.initialize();
      console.info('Azure DevOps API connection initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Azure DevOps API connection:', error);
      process.exit(1);
    }

    // Create transport and connect
    initTools(server, azureDevOpsService);
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.info('Azure DevOps MCP Server running on stdio');
    console.info('Available tools:');

    Object.entries<any>((server as any)._registeredTools).forEach(([name, tool]) => {
      console.info(`- ${name}: ${tool.description}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the server
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
