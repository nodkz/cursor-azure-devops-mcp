import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_pr_by_id',
    'Get a pull request by ID',
    {
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().optional().describe('Project name'),
    },
    async ({ pullRequestId, project }) => {
      const projectName = project || azureDevOpsService.defaultProject;
      if (!projectName) {
        throw new Error('Project name is required');
      }

      const gitClient = await azureDevOpsService.getGitApi();
      const result = await gitClient.getPullRequestById(pullRequestId, projectName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );
}
