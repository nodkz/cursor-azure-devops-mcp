import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from './azure-devops-service.js';
import { safeResponse } from '../helpers.js';
import { z } from 'zod';

export function initGitTools(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'azure_devops_repositories',
    'List repositories for a project from Azure DevOps',
    {
      project: z.string().optional().describe('Project name'),
    },
    async ({ project }) => {
      try {
        const result = await azureDevOpsService.getRepositories(project);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(
          `Error executing azure_devops_repositories for project ${project || 'default'}:`,
          error
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: String(error) }, null, 2),
            },
          ],
        };
      }
    }
  );

  server.tool(
    'azure_devops_pr_list',
    'List all pull requests for a repository',
    {
      repositoryId: z.string().describe('Repository ID'),
      project: z.string().optional().describe('Project name'),
    },
    async ({ repositoryId, project }) => {
      try {
        const result = await azureDevOpsService.getPullRequests(repositoryId, project);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(
          `Error executing azure_devops_pull_requests for repository ${repositoryId}:`,
          error
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: String(error) }, null, 2),
            },
          ],
        };
      }
    }
  );

  server.tool(
    'azure_devops_pr_by_id',
    'Get a pull request by ID',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().optional().describe('Project name'),
    },
    async ({ repositoryId, pullRequestId, project }) => {
      try {
        const result = await azureDevOpsService.getPullRequestById(
          repositoryId,
          pullRequestId,
          project
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(
          `Error executing azure_devops_pull_request_by_id for repository ${repositoryId} PR #${pullRequestId}:`,
          error
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: String(error) }, null, 2),
            },
          ],
        };
      }
    }
  );

  server.tool(
    'azure_devops_pr_threads',
    'List threads (comments) from a pull request',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().describe('Project name'),
    },
    async ({ repositoryId, pullRequestId, project }) => {
      const result = await azureDevOpsService.getPullRequestThreads(
        repositoryId,
        pullRequestId,
        project
      );
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

  // New tool for pull request changes with file contents
  server.tool(
    'azure_devops_pr_changes',
    'Get detailed code changes for a pull request',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().describe('Project name'),
    },
    async ({ repositoryId, pullRequestId, project }) => {
      const result = await azureDevOpsService.getPullRequestChanges(
        repositoryId,
        pullRequestId,
        project
      );

      return {
        content: [
          {
            type: 'text',
            text: safeResponse(result),
          },
        ],
      };
    }
  );

  // New tool for getting content of large files in pull requests by chunks
  server.tool(
    'azure_devops_pr_file_content',
    'Get the content of a specific file in a pull request. By default returns the complete file as plain text. Set returnPlainText=false to get content in chunks with metadata.',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      filePath: z.string().describe('File path'),
      objectId: z.string().describe('Object ID of the file version'),
      startPosition: z
        .number()
        .optional()
        .describe('Starting position in the file (bytes) - only used when returnPlainText=false')
        .default(0),
      length: z
        .number()
        .optional()
        .describe('Length to read (bytes) - only used when returnPlainText=false')
        .default(100000),
      project: z.string().optional().describe('Project name'),
      returnPlainText: z
        .boolean()
        .optional()
        .describe(
          'When true (default), returns complete file as plain text; when false, returns JSON with chunk details'
        )
        .default(true),
    },
    async (
      {
        repositoryId,
        pullRequestId,
        filePath,
        objectId,
        startPosition,
        length,
        project,
        returnPlainText,
      },
      _context
    ) => {
      try {
        if (returnPlainText) {
          // Get the complete file content
          const content = await azureDevOpsService.getCompletePullRequestFileContent(
            repositoryId,
            pullRequestId,
            filePath,
            objectId,
            project
          );

          // Return in the proper MCP format
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        } else {
          // Get the file content in chunks with metadata
          const result = await azureDevOpsService.getPullRequestFileContent(
            repositoryId,
            pullRequestId,
            filePath,
            objectId,
            startPosition,
            length,
            project
          );

          // Format the response properly
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }
      } catch (error) {
        console.error('Error retrieving PR file content:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // New tool for getting file content directly from a branch
  server.tool(
    'azure_devops_branch_file_content',
    'Get the content of a file directly from a branch. By default returns the complete file as plain text. Set returnPlainText=false to get content in chunks with metadata. ',
    {
      repositoryId: z.string().describe('Repository ID'),
      branchName: z.string().describe('Branch name'),
      filePath: z.string().describe('File path'),
      startPosition: z
        .number()
        .optional()
        .describe('Starting position in the file (bytes) - only used when returnPlainText=false')
        .default(0),
      length: z
        .number()
        .optional()
        .describe('Length to read (bytes) - only used when returnPlainText=false')
        .default(100000),
      project: z.string().optional().describe('Project name'),
      returnPlainText: z
        .boolean()
        .optional()
        .describe(
          'When true (default), returns complete file as plain text; when false, returns JSON with chunk details'
        )
        .default(true),
    },
    async (
      { repositoryId, branchName, filePath, startPosition, length, project, returnPlainText },
      _context
    ) => {
      try {
        if (returnPlainText) {
          // Get the complete file content
          const content = await azureDevOpsService.getCompleteFileFromBranch(
            repositoryId,
            filePath,
            branchName,
            project
          );

          // Return in the proper MCP format
          return {
            content: [
              {
                type: 'text',
                text: content,
              },
            ],
          };
        } else {
          // Get the file content in chunks with metadata
          const result = await azureDevOpsService.getFileFromBranch(
            repositoryId,
            filePath,
            branchName,
            startPosition,
            length,
            project
          );

          // Format the response properly
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          };
        }
      } catch (error) {
        console.error('Error retrieving branch file content:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );

  // New tool for creating pull request comments
  server.tool(
    'azure_devops_pr_comment_create',
    'Create a comment on a pull request',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().describe('Project name'),
      content: z.string().describe('Comment text'),
      threadId: z.number().optional().describe('Thread ID (if adding to existing thread)'),
      filePath: z.string().optional().describe('File path (if commenting on a file)'),
      lineNumber: z.number().optional().describe('Line number (if commenting on a specific line)'),
      parentCommentId: z
        .number()
        .optional()
        .describe('Parent comment ID (if replying to a comment)'),
      status: z.string().optional().describe('Comment status (e.g., "active", "fixed")'),
    },
    async params => {
      const result = await azureDevOpsService.createPullRequestComment(params);
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
