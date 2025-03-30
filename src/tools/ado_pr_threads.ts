import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_pr_threads',
    'List threads and comments from a pull request',
    {
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().optional().describe('Project name'),
      repositoryId: z.string().optional().describe('Repository ID'),
    },
    async ({ repositoryId, pullRequestId, project }) => {
      // Use the provided project or fall back to the default project
      const projectName = project || azureDevOpsService.defaultProject;
      if (!projectName) {
        throw new Error('Project name is required');
      }

      const gitApi = await azureDevOpsService.getGitApi();

      let repo = repositoryId;
      if (!repo) {
        // If repository is not provided, get the default repository ID
        const prData = await gitApi.getPullRequestById(pullRequestId, projectName);
        if (!prData || !prData.repository?.id) {
          throw new Error('Pull request not found or no repository associated');
        }
        repo = prData.repository.id;
      }

      const threads = await gitApi.getThreads(repo, pullRequestId, projectName);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(threads, null, 2),
          },
        ],
      };
    }
  );
}
