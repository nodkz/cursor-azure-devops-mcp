import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_item_create',
    'Create a new work item',
    {
      type: z.string().describe('Work item type (e.g., "Bug", "Task", "User Story")'),
      title: z.string().describe('Work item title'),
      description: z.string().optional().describe('Work item description'),
      project: z.string().optional().describe('Project name (optional if parentId is provided)'),
      assignedTo: z
        .string()
        .optional()
        .describe('Email address of the user to assign the work item to'),
      parentId: z.number().optional().describe('ID of parent work item if creating a child'),
      areaPath: z.string().optional().describe('Area Path (e.g., "MSTeams\\Web\\Frontend")'),
      iterationPath: z
        .string()
        .optional()
        .describe('Iteration Path (e.g., "MSTeams\\2025\\H1\\Q2\\April")'),
      fields: z.record(z.any()).optional().describe('Additional custom fields'),
    },
    async ({
      project,
      type,
      title,
      description,
      assignedTo,
      parentId,
      areaPath,
      iterationPath,
      fields,
    }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();

      // If parentId is provided, first retrieve the parent work item
      let parentWorkItem;
      let parentAreaPath;
      let parentIterationPath;
      let parentTeamProject;

      if (parentId) {
        try {
          parentWorkItem = await workItemApi.getWorkItem(
            parentId,
            undefined,
            undefined,
            4 // WorkItemExpand.All
          );

          if (!parentWorkItem) {
            throw new Error(`Parent work item with ID ${parentId} not found`);
          }

          // Extract areaPath, iterationPath and teamProject from parent
          parentAreaPath = parentWorkItem?.fields?.['System.AreaPath'];
          parentIterationPath = parentWorkItem?.fields?.['System.IterationPath'];
          parentTeamProject = parentWorkItem?.fields?.['System.TeamProject'];
        } catch (error: any) {
          throw new Error(
            `Failed to retrieve parent work item with ID ${parentId}: ${error.message}`
          );
        }
      }

      // Use parent's TeamProject as default if project parameter is not provided
      const effectiveProject = project || parentTeamProject;

      // Validate that we have a project to work with
      if (!effectiveProject) {
        throw new Error(`Project name must be provided either directly or via a parent work item`);
      }

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

      // Add AssignedTo if provided
      if (assignedTo) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: assignedTo,
        });
      }

      // Add area path - use parent's if available and user didn't specify one
      const effectiveAreaPath = areaPath || (parentId ? parentAreaPath : undefined);
      if (effectiveAreaPath) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.AreaPath',
          value: effectiveAreaPath,
        });
      }

      // Add iteration path - use parent's if available and user didn't specify one
      const effectiveIterationPath = iterationPath || (parentId ? parentIterationPath : undefined);
      if (effectiveIterationPath) {
        patchDocument.push({
          op: 'add',
          path: '/fields/System.IterationPath',
          value: effectiveIterationPath,
        });
      }

      // Add any additional custom fields
      for (const [key, value] of Object.entries(fields ?? {})) {
        patchDocument.push({
          op: 'add',
          path: `/fields/${key}`,
          value,
        });
      }

      // Create the work item using workItemClient
      const workItem = await workItemApi.createWorkItem(
        undefined,
        patchDocument,
        effectiveProject,
        type,
        undefined,
        undefined,
        undefined,
        4 // 4 = WorkItemExpand.All in the SDK - return all fields
      );

      // If a parent ID is provided, create a parent-child relationship
      if (parentId && workItem?.id && parentWorkItem) {
        // Use updateWorkItem to add a relation to the parent
        await workItemApi.updateWorkItem(
          undefined,
          [
            {
              op: 'add',
              path: '/relations/-',
              value: {
                rel: 'System.LinkTypes.Hierarchy-Reverse',
                url: parentWorkItem.url, // Use the direct URL from the parent work item
                attributes: {
                  isLocked: false,
                  name: 'Parent',
                },
              },
            },
          ],
          workItem.id,
          effectiveProject
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(workItem, null, 2),
          },
        ],
      };
    }
  );
}
