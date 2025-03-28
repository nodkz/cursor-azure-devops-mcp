import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from './azure-devops-service.js';

export function initCoreTools(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  // Register Azure DevOps tools
  server.tool('azure_devops_projects', 'Get projects from Azure DevOps', {}, async () => {
    try {
      const result = await azureDevOpsService.getProjects();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error executing azure_devops_projects:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: String(error) }, null, 2),
          },
        ],
      };
    }
  });
}
