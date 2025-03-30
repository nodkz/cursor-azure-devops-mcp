import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';
import { safeResponse } from '../helpers.js';

// Pull Request Change
export interface PullRequestChange {
  changeId: string;
  item?: {
    objectId?: string;
    originalObjectId?: string;
    path?: string;
    contentMetadata?: {
      fileName?: string;
      extension?: string;
    };
    isFolder?: boolean;
  };
  changeType?: string; // Add, Edit, Delete
  originalContent?: string; // Content before change
  modifiedContent?: string; // Content after change
  originalContentSize?: number; // Size of original file in bytes
  modifiedContentSize?: number; // Size of modified file in bytes
  originalContentPreview?: string; // Preview of content for large files
  modifiedContentPreview?: string; // Preview of content for large files
  isBinary?: boolean; // Whether the file is binary
  isFolder?: boolean; // Whether the item is a folder
}

export interface PullRequestChanges {
  changeEntries: PullRequestChange[];
  totalCount: number;
}

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_pr_changes',
    'Get detailed code changes for a pull request',
    {
      repositoryId: z.string().describe('Repository ID'),
      pullRequestId: z.number().describe('Pull request ID'),
      project: z.string().describe('Project name'),
    },
    async ({ repositoryId, pullRequestId, project }) => {
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

      // Get the changes for the pull request
      const changes = await gitApi.getPullRequestIterationChanges(
        repo,
        pullRequestId,
        1, // Iteration (usually 1 for the latest)
        projectName
      );

      // File size and content handling constants
      const MAX_INLINE_FILE_SIZE = 500000; // Increased to 500KB for inline content
      const PREVIEW_SIZE = 10000; // 10KB preview for very large files

      // Get detailed content for each change
      const enhancedChanges = await Promise.all(
        (changes.changeEntries || []).map(async (change: any) => {
          const filePath = change.item?.path || '';
          let originalContent = null;
          let modifiedContent = null;
          let originalContentSize = 0;
          let modifiedContentSize = 0;
          let originalContentPreview = null;
          let modifiedContentPreview = null;

          // Skip folders or binary files
          const isBinary = this.isBinaryFile(filePath);
          const isFolder = change.item?.isFolder === true;

          if (!isFolder && !isBinary && change.item) {
            try {
              // Get original content if the file wasn't newly added
              if (change.changeType !== 'add' && change.originalObjectId) {
                try {
                  // First get the item metadata to check file size
                  const originalItem = await gitApi.getItem(
                    repositoryId,
                    filePath,
                    projectName,
                    change.originalObjectId
                  );

                  originalContentSize = originalItem?.contentMetadata?.contentLength || 0;

                  // For files within the inline limit, get full content
                  if (originalContentSize <= MAX_INLINE_FILE_SIZE) {
                    const originalItemContent = await gitApi.getItemContent(
                      repositoryId,
                      filePath,
                      projectName,
                      change.originalObjectId,
                      undefined,
                      true,
                      true
                    );

                    originalContent = originalItemContent.toString('utf8');
                  }
                  // For large files, get a preview
                  else {
                    // Get just the beginning of the file for preview
                    const previewContent = await this.gitClient.getItemText(
                      repositoryId,
                      filePath,
                      projectName,
                      change.originalObjectId,
                      0, // Start at beginning
                      PREVIEW_SIZE // Get preview bytes
                    );

                    originalContentPreview = previewContent;
                    originalContent = `(File too large to display inline - ${Math.round(originalContentSize / 1024)}KB. Preview shown.)`;
                  }
                } catch (error) {
                  console.error(`Error getting original content for ${filePath}:`, error);
                  originalContent = '(Content unavailable)';
                }
              }

              // Get modified content if the file wasn't deleted
              if (change.changeType !== 'delete' && change.item.objectId) {
                try {
                  // First get the item metadata to check file size
                  const modifiedItem = await this.gitClient.getItem(
                    repositoryId,
                    filePath,
                    projectName,
                    change.item.objectId
                  );

                  modifiedContentSize = modifiedItem?.contentMetadata?.contentLength || 0;

                  // For files within the inline limit, get full content
                  if (modifiedContentSize <= MAX_INLINE_FILE_SIZE) {
                    const modifiedItemContent = await this.gitClient.getItemContent(
                      repositoryId,
                      filePath,
                      projectName,
                      change.item.objectId,
                      undefined,
                      true,
                      true
                    );

                    modifiedContent = modifiedItemContent.toString('utf8');
                  }
                  // For large files, get a preview
                  else {
                    // Get just the beginning of the file for preview
                    const previewContent = await this.gitClient.getItemText(
                      repositoryId,
                      filePath,
                      projectName,
                      change.item.objectId,
                      0, // Start at beginning
                      PREVIEW_SIZE // Get preview bytes
                    );

                    modifiedContentPreview = previewContent;
                    modifiedContent = `(File too large to display inline - ${Math.round(modifiedContentSize / 1024)}KB. Preview shown.)`;
                  }
                } catch (error) {
                  console.error(`Error getting modified content for ${filePath}:`, error);
                  modifiedContent = '(Content unavailable)';
                }
              }
            } catch (error) {
              console.error(`Error processing file ${filePath}:`, error);
            }
          }

          // Create enhanced change object
          const enhancedChange: PullRequestChange = {
            ...change,
            originalContent,
            modifiedContent,
            originalContentSize,
            modifiedContentSize,
            originalContentPreview,
            modifiedContentPreview,
            isBinary,
            isFolder,
          };

          return enhancedChange;
        })
      );

      const result = {
        changeEntries: enhancedChanges,
        totalCount: enhancedChanges.length,
      };

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
}
