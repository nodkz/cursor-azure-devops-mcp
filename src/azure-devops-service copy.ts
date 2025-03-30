import * as azdev from 'azure-devops-node-api';
import { configManager } from './config-manager.js';
import {
  TeamProject,
  WorkItem,
  GitRepository,
  GitPullRequest,
  GitPullRequestCommentThread,
  ApiClients,
  WorkItemAttachment,
  PullRequestChange,
  PullRequestChanges,
  PullRequestCommentRequest,
  PullRequestCommentResponse,
  PullRequestFileContent,
  WorkItemLink,
  CreateWorkItemParams,
} from './types.js';
import { safeStringify } from './helpers.js';

/**
 * Service for interacting with Azure DevOps API
 */
class AzureDevOpsService {
  private connection: azdev.WebApi | null = null;
  private projectClient: any = null;
  private workItemClient: any = null;
  private gitClient: any = null;
  private defaultProject: string | undefined;
  private organizationUrl: string | undefined;

  constructor(connection?: azdev.WebApi, defaultProject?: string) {
    if (connection) {
      this.connection = connection;
    }
    this.defaultProject = defaultProject;
  }

  /**
   * Initialize the Azure DevOps API connection
   */
  async initialize(): Promise<void> {
    if (this.connection) {
      return;
    }

    const config = configManager.loadConfig();
    const { organizationUrl, token } = config.azureDevOps;

    if (!organizationUrl || !token) {
      throw new Error('Azure DevOps organization URL and token are required');
    }

    // Store organization URL
    this.organizationUrl = organizationUrl;

    // Create a connection to Azure DevOps
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    this.connection = new azdev.WebApi(organizationUrl, authHandler);

    // Set default project if not provided in constructor
    if (!this.defaultProject && config.azureDevOps.project) {
      this.defaultProject = config.azureDevOps.project;
    }

    // Get API clients
    this.projectClient = await this.connection.getCoreApi();
    this.workItemClient = await this.connection.getWorkItemTrackingApi();
    this.gitClient = await this.connection.getGitApi();
  }

  /**
   * Get all projects from Azure DevOps
   */
  async getProjects(): Promise<TeamProject[]> {
    await this.initialize();

    if (!this.projectClient) {
      throw new Error('Project client not initialized');
    }

    // CoreApi provides the getProjects method to list all projects
    const projects = await this.projectClient.getProjects();
    return projects;
  }

  /**
   * Get a specific work item by ID
   */
  async getWorkItem(id: number): Promise<WorkItem> {
    await this.initialize();

    if (!this.workItemClient) {
      throw new Error('Work item client not initialized');
    }

    const workItem = await this.workItemClient.getWorkItem(id);
    return workItem;
  }

  /**
   * Get multiple work items by IDs
   */
  async getWorkItems(ids: number[]): Promise<WorkItem[]> {
    await this.initialize();

    if (!this.workItemClient) {
      throw new Error('Work item client not initialized');
    }

    const workItems = await this.workItemClient.getWorkItems(ids);
    return workItems;
  }

  /**
   * Get repositories for a project
   */
  async getRepositories(project?: string): Promise<GitRepository[]> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const repositories = await this.gitClient.getRepositories(projectName);
    return repositories;
  }

  /**
   * Get pull requests for a repository
   */
  async getPullRequests(repositoryId: string, project?: string): Promise<GitPullRequest[]> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const pullRequests = await this.gitClient.getPullRequests(repositoryId, {
      project: projectName,
    });

    return pullRequests;
  }

  /**
   * Get a specific pull request by ID
   */
  async getPullRequestById(
    repositoryId: string,
    pullRequestId: number,
    project?: string
  ): Promise<GitPullRequest> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const pullRequest = await this.gitClient.getPullRequestById(
      pullRequestId,
      repositoryId,
      projectName
    );
    return pullRequest;
  }

  /**
   * Get threads (comments) for a pull request
   */
  async getPullRequestThreads(
    repositoryId: string,
    pullRequestId: number,
    project?: string
  ): Promise<GitPullRequestCommentThread[]> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    const threads = await this.gitClient.getThreads(repositoryId, pullRequestId, projectName);
    return threads;
  }

  /**
   * Test the connection to Azure DevOps
   */
  async testConnection(): Promise<boolean> {
    await this.initialize();
    // If we get here, the connection was successful
    return true;
  }

  /**
   * Get the API clients
   * @returns Object containing all initialized clients
   */
  getClients(): ApiClients {
    if (!this.projectClient || !this.workItemClient || !this.gitClient) {
      throw new Error('API clients not initialized. Call initialize() first.');
    }

    return {
      projectClient: this.projectClient,
      workItemClient: this.workItemClient,
      gitClient: this.gitClient,
    };
  }

  /**
   * Get attachments for a specific work item
   * @param workItemId The ID of the work item
   * @returns Array of attachments with metadata
   */
  async getWorkItemAttachments(workItemId: number): Promise<WorkItemAttachment[]> {
    await this.initialize();

    if (!this.workItemClient) {
      throw new Error('Work item client not initialized');
    }

    // Get work item with relations (includes attachments)
    const workItem = await this.workItemClient.getWorkItem(
      workItemId,
      undefined,
      undefined,
      4 // 4 = WorkItemExpand.Relations in the SDK
    );

    if (!workItem || !workItem.relations) {
      return [];
    }

    // Filter for attachment relations
    const attachmentRelations = workItem.relations.filter(
      (relation: any) => relation.rel === 'AttachedFile' || relation.rel === 'Hyperlink'
    );

    // Map relations to attachment objects
    const attachments = attachmentRelations.map((relation: any) => {
      const url = relation.url;
      const attributes = relation.attributes || {};

      const attachment: WorkItemAttachment = {
        url,
        name: attributes.name || url.split('/').pop() || 'unnamed',
        comment: attributes.comment || '',
        resourceSize: attributes.resourceSize || 0,
        contentType: attributes.resourceType || '',
      };

      return attachment;
    });

    return attachments;
  }

  /**
   * Get all links associated with a work item (parent, child, related, etc.)
   * @param workItemId The ID of the work item
   * @returns Object with work item links grouped by relationship type
   */
  async getWorkItemLinks(workItemId: number): Promise<Record<string, WorkItemLink[]>> {
    await this.initialize();

    if (!this.workItemClient) {
      throw new Error('Work item client not initialized');
    }

    // Get work item with relations
    const workItem = await this.workItemClient.getWorkItem(
      workItemId,
      undefined,
      undefined,
      4 // 4 = WorkItemExpand.Relations in the SDK
    );

    if (!workItem || !workItem.relations) {
      return {};
    }

    // Filter for work item link relations (exclude attachments and hyperlinks)
    const linkRelations = workItem.relations.filter(
      (relation: any) =>
        relation.rel.includes('Link') &&
        relation.rel !== 'AttachedFile' &&
        relation.rel !== 'Hyperlink'
    );

    // Group relations by relationship type
    const groupedRelations: Record<string, WorkItemLink[]> = {};

    linkRelations.forEach((relation: any) => {
      const relType = relation.rel;

      // Extract work item ID from URL
      // URL format is typically like: https://dev.azure.com/{org}/{project}/_apis/wit/workItems/{id}
      let targetId = 0;
      try {
        const urlParts = relation.url.split('/');
        targetId = parseInt(urlParts[urlParts.length - 1], 10);
      } catch (error: any) {
        console.error('Failed to extract work item ID from URL:', relation.url, error.message);
      }

      if (!groupedRelations[relType]) {
        groupedRelations[relType] = [];
      }

      const workItemLink: WorkItemLink = {
        ...relation,
        targetId,
        title: relation.attributes?.name || `Work Item ${targetId}`,
      };

      groupedRelations[relType].push(workItemLink);
    });

    return groupedRelations;
  }

  /**
   * Get all linked work items with their full details
   * @param workItemId The ID of the work item to get links from
   * @returns Array of work items that are linked to the specified work item
   */
  async getLinkedWorkItems(workItemId: number): Promise<WorkItem[]> {
    await this.initialize();

    if (!this.workItemClient) {
      throw new Error('Work item client not initialized');
    }

    // First get all links
    const linkGroups = await this.getWorkItemLinks(workItemId);

    // Extract all target IDs from all link groups
    const linkedIds: number[] = [];

    Object.values(linkGroups).forEach(links => {
      links.forEach(link => {
        if (link.targetId > 0) {
          linkedIds.push(link.targetId);
        }
      });
    });

    // If no linked items found, return empty array
    if (linkedIds.length === 0) {
      return [];
    }

    // Get the full work item details for all linked items
    const linkedWorkItems = await this.getWorkItems(linkedIds);
    return linkedWorkItems;
  }

  /**
   * Get detailed changes for a pull request
   */
  async getPullRequestChanges(
    repositoryId: string,
    pullRequestId: number,
    project?: string
  ): Promise<PullRequestChanges> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    // Get the changes for the pull request
    const changes = await this.gitClient.getPullRequestIterationChanges(
      repositoryId,
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
                const originalItem = await this.gitClient.getItem(
                  repositoryId,
                  filePath,
                  projectName,
                  change.originalObjectId
                );

                originalContentSize = originalItem?.contentMetadata?.contentLength || 0;

                // For files within the inline limit, get full content
                if (originalContentSize <= MAX_INLINE_FILE_SIZE) {
                  const originalItemContent = await this.gitClient.getItemContent(
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
        } as PullRequestChange;

        return enhancedChange;
      })
    );

    return {
      changeEntries: enhancedChanges,
      totalCount: enhancedChanges.length,
    };
  }

  /**
   * Helper method to get the Git API client
   */
  private async getGitApiClient() {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    return this.gitClient;
  }

  /**
   * Retrieves complete file content by fetching chunks in parallel
   * @param fetchChunk Function to fetch a single chunk of the file
   * @returns Promise resolving to the complete file content as string
   */
  private async getCompleteFileContent(
    fetchChunk: (startPosition: number, length: number) => Promise<PullRequestFileContent>
  ): Promise<string> {
    try {
      // First, fetch a tiny chunk to determine if it's binary and get content length
      const initialChunk = await fetchChunk(0, 1024);

      if (initialChunk.isBinary) {
        return `[Binary file content not displayed. File size: ${initialChunk.contentLength || initialChunk.size} bytes]`;
      }

      const contentLength = initialChunk.contentLength || initialChunk.size;

      // If the file is small enough, return it directly
      if (contentLength <= 100000) {
        if (contentLength <= initialChunk.content.length) {
          return initialChunk.content;
        }
        const fullContent = await fetchChunk(0, contentLength);
        return fullContent.content;
      }

      // For larger files, fetch in parallel chunks
      const totalLength = contentLength;
      const CHUNK_SIZE = 100000; // 100KB chunks
      const NUM_PARALLEL_REQUESTS = 5; // Number of parallel requests

      const chunks: string[] = [];
      let position = 0;

      // Process the file in batches of parallel requests
      while (position < totalLength) {
        const chunkPromises: Promise<PullRequestFileContent>[] = [];

        // Create batch of chunk requests
        for (let i = 0; i < NUM_PARALLEL_REQUESTS && position < totalLength; i++) {
          const chunkSize = Math.min(CHUNK_SIZE, totalLength - position);
          chunkPromises.push(fetchChunk(position, chunkSize));
          position += chunkSize;
        }

        // Wait for all chunks in this batch to be retrieved
        const chunkResults = await Promise.all(chunkPromises);

        // Add chunks to our collection in the correct order
        for (const chunk of chunkResults) {
          chunks.push(chunk.content);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return chunks.join('');
    } catch (error) {
      console.error('Error retrieving complete file content:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve complete file content: ${error.message}`);
      } else {
        throw new Error('Failed to retrieve complete file content due to an unknown error');
      }
    }
  }

  /**
   * Get the content of a file in a pull request
   */
  async getPullRequestFileContent(
    repositoryId: string,
    pullRequestId: number,
    filePath: string,
    objectId: string,
    startPosition = 0,
    length = 100000,
    project?: string
  ): Promise<PullRequestFileContent> {
    try {
      const gitClient = await this.getGitApiClient();
      const projectName = project || this.defaultProject;

      if (!projectName) {
        throw new Error('Project name is required but not provided');
      }

      // Check if this is likely a binary file
      const isBinaryFile = this.isBinaryFile(filePath);

      try {
        // Get the content with range
        const content = await gitClient.getBlobContent(
          repositoryId,
          objectId,
          projectName,
          undefined, // download
          undefined, // scopePath
          {
            startPosition: startPosition,
            endPosition: startPosition + length - 1,
          }
        );

        // Check if we got a Buffer
        let contentStr = '';
        let contentSize = 0;
        let totalContentLength = 0;

        if (Buffer.isBuffer(content)) {
          contentSize = content.length;

          // Attempt to get the total file size by requesting the file metadata
          try {
            const fileInfo = await gitClient.getBlobsZip(repositoryId, [objectId], projectName);

            // This may not give us the exact size, but we'll try to estimate
            totalContentLength = fileInfo?._response?.bodyAsText?.length || contentSize;
          } catch (_error: any) {
            // If we can't get the total size, use the current chunk size or try another method
            totalContentLength = contentSize;
          }

          if (isBinaryFile) {
            contentStr = '[Binary content]';
          } else {
            try {
              contentStr = content.toString('utf8');
            } catch (_error: any) {
              contentStr = '[Error converting content to string]';
            }
          }
        } else if (typeof content === 'string') {
          contentStr = content;
          contentSize = contentStr.length;
          totalContentLength = contentSize;
        } else if (content === null || content === undefined) {
          contentStr = '';
          contentSize = 0;
          totalContentLength = 0;
        } else {
          // In case we got some other type
          try {
            contentStr = safeStringify(content);
            contentSize = contentStr.length;
            totalContentLength = contentSize;
          } catch (_error: any) {
            contentStr = '[Error: could not serialize content]';
            contentSize = contentStr.length;
            totalContentLength = contentSize;
          }
        }

        return {
          content: contentStr,
          size: totalContentLength,
          position: startPosition,
          length: contentSize,
          isBinary: isBinaryFile,
          contentLength: totalContentLength,
        };
      } catch (error) {
        console.error('Error getting content directly:', error);

        // Fallback to branch access if direct objectId access fails
        try {
          // Get the pull request details to find the source branch
          const pullRequest = await gitClient.getPullRequestById(
            pullRequestId,
            repositoryId,
            projectName
          );

          if (!pullRequest || !pullRequest.sourceRefName) {
            throw new Error('Could not determine source branch for pull request');
          }

          // Extract branch name from ref (remove 'refs/heads/' prefix)
          const branchName = pullRequest.sourceRefName.replace(/^refs\/heads\//, '');

          // Use the getFileFromBranch method as a fallback
          console.log(`Falling back to branch access for ${filePath} using branch ${branchName}`);
          return await this.getFileFromBranch(
            repositoryId,
            filePath,
            branchName,
            startPosition,
            length,
            projectName
          );
        } catch (fallbackError) {
          console.error('Fallback to branch access also failed:', fallbackError);
          return {
            content: '',
            size: 0,
            position: startPosition,
            length: 0,
            error: `Failed to retrieve content for file: ${filePath}. Direct access and branch fallback both failed.`,
            isBinary: false,
            contentLength: 0,
          };
        }
      }
    } catch (error) {
      console.error('Error in getPullRequestFileContent:', error);
      return {
        content: '',
        size: 0,
        position: startPosition,
        length: 0,
        error: `Failed to retrieve content: ${error instanceof Error ? error.message : String(error)}`,
        isBinary: false,
        contentLength: 0,
      };
    }
  }

  /**
   * Get the complete content of a file from a pull request, automatically handling chunking
   * This simplifies access to large files by combining chunks internally
   */
  async getCompletePullRequestFileContent(
    repositoryId: string,
    pullRequestId: number,
    filePath: string,
    objectId: string,
    project?: string
  ): Promise<string> {
    // Check if this is a binary file before proceeding
    if (this.isBinaryFile(filePath)) {
      return `[Binary file - content cannot be displayed as text]`;
    }

    try {
      const content = await this.getCompleteFileContent((startPosition, length) =>
        this.getPullRequestFileContent(
          repositoryId,
          pullRequestId,
          filePath,
          objectId,
          startPosition,
          length,
          project
        )
      );
      return content;
    } catch (error) {
      console.error('Error retrieving complete pull request file content:', error);
      throw error;
    }
  }

  /**
   * Get the complete content of a file from a branch, automatically handling chunking
   * This simplifies access to large files by combining chunks internally
   */
  async getCompleteFileFromBranch(
    repositoryId: string,
    filePath: string,
    branchName: string,
    project?: string
  ): Promise<string> {
    // Check if this is a binary file before proceeding
    if (this.isBinaryFile(filePath)) {
      return `[Binary file - content cannot be displayed as text]`;
    }

    try {
      const content = await this.getCompleteFileContent((startPosition, length) =>
        this.getFileFromBranch(repositoryId, filePath, branchName, startPosition, length, project)
      );
      return content;
    } catch (error) {
      console.error('Error retrieving complete branch file content:', error);
      throw error;
    }
  }

  /**
   * Helper function to determine if a file is likely binary based on extension
   */
  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.ico',
      '.svg',
      '.pdf',
      '.doc',
      '.docx',
      '.ppt',
      '.pptx',
      '.xls',
      '.xlsx',
      '.zip',
      '.tar',
      '.gz',
      '.rar',
      '.7z',
      '.exe',
      '.dll',
      '.so',
      '.dylib',
      '.bin',
      '.dat',
      '.class',
    ];

    const extension = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return binaryExtensions.includes(extension);
  }

  /**
   * Helper method to get a file's content from a specific branch
   * This is useful for accessing files in pull requests when direct object ID access fails
   */
  async getFileFromBranch(
    repositoryId: string,
    filePath: string,
    branchName: string,
    startPosition = 0,
    length = 100000,
    project?: string
  ): Promise<PullRequestFileContent> {
    try {
      const gitClient = await this.getGitApiClient();
      const projectName = project || this.defaultProject;

      if (!projectName) {
        throw new Error('Project name is required but not provided');
      }

      // Check if this is likely a binary file
      const isBinaryFile = this.isBinaryFile(filePath);

      try {
        // Attempt to get the item by path
        const gitItem = await gitClient.getItem(
          repositoryId,
          filePath,
          projectName,
          undefined, // version
          undefined, // versionOptions
          undefined, // versionType
          undefined, // includeContent
          undefined, // latestProcessedChange
          branchName, // versionDescriptor
          undefined // includeContentMetadata
        );

        if (!gitItem || !gitItem.objectId) {
          throw new Error(`File not found at path: ${filePath}`);
        }

        // Get the content with range
        const content = await gitClient.getItemContent(
          repositoryId,
          filePath,
          projectName,
          undefined, // version
          undefined, // versionOptions
          undefined, // versionType
          branchName, // versionDescriptor
          undefined, // download
          undefined, // includeContent
          undefined, // latestProcessedChange
          {
            startPosition: startPosition,
            endPosition: startPosition + length - 1,
          }
        );

        // Check if we got a Buffer
        let contentStr = '';
        let contentSize = 0;
        let totalContentLength = 0;

        if (Buffer.isBuffer(content)) {
          contentSize = content.length;

          // Attempt to get the total file size by requesting the file without content
          try {
            const fileInfo = await gitClient.getItem(
              repositoryId,
              filePath,
              projectName,
              undefined,
              undefined,
              undefined,
              undefined, // Don't request content
              undefined,
              branchName,
              true // includeContentMetadata
            );

            totalContentLength = fileInfo.contentMetadata?.contentLength || contentSize;
          } catch (_error: any) {
            // If we can't get the total size, use the current chunk size
            totalContentLength = contentSize;
          }

          if (isBinaryFile) {
            contentStr = '[Binary content]';
          } else {
            try {
              contentStr = content.toString('utf8');
            } catch (_error: any) {
              contentStr = '[Error converting content to string]';
            }
          }
        } else if (typeof content === 'string') {
          contentStr = content;
          contentSize = contentStr.length;
          totalContentLength = contentSize;
        } else if (content === null || content === undefined) {
          contentStr = '';
          contentSize = 0;
          totalContentLength = 0;
        } else {
          // In case we got some other type
          try {
            contentStr = safeStringify(content);
            contentSize = contentStr.length;
            totalContentLength = contentSize;
          } catch (_error: any) {
            contentStr = '[Error: could not serialize content]';
            contentSize = contentStr.length;
            totalContentLength = contentSize;
          }
        }

        return {
          content: contentStr,
          size: totalContentLength,
          position: startPosition,
          length: contentSize,
          isBinary: isBinaryFile,
          contentLength: totalContentLength,
        };
      } catch (error) {
        // Log the error for debugging
        console.error('Error in getFileFromBranch:', error);

        // Return a structured error response
        return {
          content: '',
          size: 0,
          position: startPosition,
          length: 0,
          error: error instanceof Error ? error.message : String(error),
          isBinary: false,
          contentLength: 0,
        };
      }
    } catch (error) {
      console.error('Error in getFileFromBranch:', error);
      throw error;
    }
  }

  /**
   * Create a comment on a pull request
   */
  async createPullRequestComment(
    params: PullRequestCommentRequest
  ): Promise<PullRequestCommentResponse> {
    await this.initialize();

    if (!this.gitClient) {
      throw new Error('Git client not initialized');
    }

    const {
      repositoryId,
      pullRequestId,
      project,
      content,
      threadId,
      filePath,
      lineNumber,
      parentCommentId,
      status,
    } = params;

    // Use the provided project or fall back to the default project
    const projectName = project || this.defaultProject;

    if (!projectName) {
      throw new Error('Project name is required');
    }

    let commentResponse: PullRequestCommentResponse | null = null;

    try {
      // Case 1: Adding a comment to an existing thread
      if (threadId) {
        // Create comment on existing thread
        const comment = await this.gitClient.createComment(
          {
            content,
            parentCommentId,
          },
          repositoryId,
          pullRequestId,
          threadId,
          projectName
        );

        commentResponse = {
          id: comment.id || 0,
          content: comment.content || '',
          threadId,
          status: comment.status,
          author: comment.author,
          createdDate: comment.publishedDate,
          url: comment.url,
        };
      }
      // Case 2: Creating a new thread with a comment
      else {
        // Set up the new thread
        const threadContext: any = {};

        if (filePath) {
          // Comment on a file
          threadContext.filePath = filePath;

          // If line number is provided, set up position
          if (lineNumber) {
            threadContext.rightFileStart = {
              line: lineNumber,
              offset: 1,
            };
            threadContext.rightFileEnd = {
              line: lineNumber,
              offset: 1,
            };
          }
        }

        // Create a new thread with our comment
        const newThread = await this.gitClient.createThread(
          {
            comments: [
              {
                content,
                parentCommentId,
              },
            ],
            status,
            threadContext,
          },
          repositoryId,
          pullRequestId,
          projectName
        );

        // Extract the created comment from the thread
        const createdComment =
          newThread.comments && newThread.comments.length > 0 ? newThread.comments[0] : null;

        if (createdComment && newThread.id) {
          commentResponse = {
            id: createdComment.id || 0,
            content: createdComment.content || '',
            threadId: newThread.id,
            status: createdComment.status,
            author: createdComment.author,
            createdDate: createdComment.publishedDate,
            url: createdComment.url,
          };
        } else {
          throw new Error('Failed to create comment on pull request');
        }
      }

      return (
        commentResponse || {
          id: 0,
          content: '',
          threadId: threadId || 0,
          status: 'unknown',
        }
      );
    } catch (error) {
      console.error('Error creating pull request comment:', error);
      throw new Error(
        `Failed to create comment: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createWorkItem(params: CreateWorkItemParams) {
    const { project, type, title, description, parentId, fields = {} } = params;

    const patchDocument = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: title,
      },
    ];

    if (description) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.Description',
        value: description,
      });
    }

    // Add any additional custom fields
    for (const [key, value] of Object.entries(fields)) {
      patchDocument.push({
        op: 'add',
        path: `/fields/${key}`,
        value,
      });
    }

    // Create the work item using workItemClient
    const workItem = await this.workItemClient.createWorkItem(
      undefined,
      patchDocument,
      project,
      type,
      undefined,
      undefined,
      undefined,
      true
    );

    // If a parent ID is provided, create a parent-child relationship
    if (parentId && workItem?.id) {
      await this.workItemClient.createRelation(
        workItem.id,
        {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${this.organizationUrl}/_apis/wit/workItems/${parentId}`,
        },
        project
      );
    }

    return workItem;
  }
}

// Export the class and create a singleton instance
export { AzureDevOpsService };
export const azureDevOpsService = new AzureDevOpsService();
