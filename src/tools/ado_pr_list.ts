import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_pr_list',
    'List pull requests from Azure DevOps',
    {
      repositoryId: z.string().optional().describe('Repository Id or Name').default(''),
      project: z.string().optional().describe('Project name'),
    },
    async ({ repositoryId, project }) => {
      const projectName = project || azureDevOpsService.defaultProject;
      if (!projectName) {
        throw new Error('Project name is required');
      }

      const gitClient = await azureDevOpsService.getGitApi();
      const pullRequests = await gitClient.getPullRequestsByProject(
        projectName,
        {
          repositoryId: repositoryId || undefined, // remove empty string
        },
        10000, // maxCommentLength
        0, // skip
        20 // top
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(pullRequests, null, 2),
          },
        ],
      };
    }
  );
}
