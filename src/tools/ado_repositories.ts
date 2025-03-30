import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_repositories',
    'List repositories for a project from Azure DevOps',
    {
      project: z.string().optional().describe('Project name'),
    },
    async ({ project }) => {
      const gitApi = await azureDevOpsService.getGitApi();
      const projectName = project || azureDevOpsService.defaultProject;

      if (!projectName) {
        throw new Error('Project name is required');
      }

      const repositories = await gitApi.getRepositories(projectName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(repositories, null, 2),
          },
        ],
      };
    }
  );
}
