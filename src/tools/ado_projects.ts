import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool('ado_projects', 'Get projects from Azure DevOps', {}, async () => {
    const coreApi = await azureDevOpsService.getCoreApi();
    const result = await coreApi.getProjects();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });
}
