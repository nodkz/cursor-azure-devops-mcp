import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  // New tool for getting file content directly from a branch
  server.tool(
    'ado_branch_file_content',
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
    }
  );
}
