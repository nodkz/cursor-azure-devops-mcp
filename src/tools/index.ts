import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from './azure-devops-service.js';
import { initCoreTools } from './core.js';
import { initWorkItemTools } from './work-item.js';
import { initGitTools } from './git.js';

export function initTools(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  initCoreTools(server, azureDevOpsService);
  initWorkItemTools(server, azureDevOpsService);
  initGitTools(server, azureDevOpsService);
}
