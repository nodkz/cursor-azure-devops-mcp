import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_item_update',
    'Update an existing work item',
    {
      id: z.number().describe('Work item ID to update'),
      project: z
        .string()
        .optional()
        .describe('Project name (optional if it can be determined from the work item)'),
      title: z.string().optional().describe('New work item title'),
      description: z.string().optional().describe('New work item description'),
      assignedTo: z
        .string()
        .optional()
        .describe('Email address of the user to assign the work item to'),
      areaPath: z
        .string()
        .optional()
        .describe('Area Path (e.g., "MSTeams\\Engineering Systems\\GateInfra")'),
      iterationPath: z
        .string()
        .optional()
        .describe('Iteration Path (e.g., "MSTeams\\2025\\H1\\Q2\\April")'),
      state: z.string().optional().describe('New work item state (e.g., "Active", "Resolved")'),
      fields: z.record(z.any()).optional().describe('Additional custom fields to update'),
    },
    async ({
      id,
      project,
      title,
      description,
      assignedTo,
      areaPath,
      iterationPath,
      state,
      fields,
    }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();

      // First, get the current work item to retrieve its project if not provided
      let workItemProject;
      let currentWorkItem;

      try {
        currentWorkItem = await workItemApi.getWorkItem(
          id,
          undefined,
          undefined,
          4 // WorkItemExpand.All
        );

        if (!currentWorkItem) {
          throw new Error(`Work item with ID ${id} not found`);
        }

        // Get the project from the current work item if not provided
        workItemProject = project || currentWorkItem?.fields?.['System.TeamProject'];
      } catch (error: any) {
        throw new Error(`Failed to retrieve work item with ID ${id}: ${error.message}`);
      }

      // Validate that we have a project to work with
      if (!workItemProject) {
        throw new Error(`Project name must be provided or determined from the work item`);
      }

      // Build the JSON patch document
      const patchDocument = [];

      // Track changed fields and their original values
      const originalValues: Record<string, any> = {};

      // Add title update if provided
      if (title !== undefined) {
        const originalTitle = currentWorkItem?.fields?.['System.Title'];
        originalValues['System.Title'] = originalTitle;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.Title',
          value: title,
        });
      }

      // Add description update if provided
      if (description !== undefined) {
        const originalDescription = currentWorkItem?.fields?.['System.Description'];
        originalValues['System.Description'] = originalDescription;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.Description',
          value: description,
        });
      }

      // Add state update if provided
      if (state !== undefined) {
        const originalState = currentWorkItem?.fields?.['System.State'];
        originalValues['System.State'] = originalState;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.State',
          value: state,
        });
      }

      // Add AssignedTo update if provided
      if (assignedTo !== undefined) {
        const originalAssignedTo = currentWorkItem?.fields?.['System.AssignedTo'];
        originalValues['System.AssignedTo'] = originalAssignedTo;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.AssignedTo',
          value: assignedTo,
        });
      }

      // Add area path update if provided
      if (areaPath !== undefined) {
        const originalAreaPath = currentWorkItem?.fields?.['System.AreaPath'];
        originalValues['System.AreaPath'] = originalAreaPath;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.AreaPath',
          value: areaPath,
        });
      }

      // Add iteration path update if provided
      if (iterationPath !== undefined) {
        const originalIterationPath = currentWorkItem?.fields?.['System.IterationPath'];
        originalValues['System.IterationPath'] = originalIterationPath;

        patchDocument.push({
          op: 'add',
          path: '/fields/System.IterationPath',
          value: iterationPath,
        });
      }

      // Add any additional custom fields
      for (const [key, value] of Object.entries(fields ?? {})) {
        const originalValue = currentWorkItem?.fields?.[key];
        originalValues[key] = originalValue;

        patchDocument.push({
          op: 'add',
          path: `/fields/${key}`,
          value,
        });
      }

      // Check if we have any updates to make
      if (patchDocument.length === 0) {
        throw new Error('No updates provided for the work item');
      }

      // Update the work item using workItemClient
      const updatedWorkItem = await workItemApi.updateWorkItem(
        undefined,
        patchDocument,
        id,
        workItemProject,
        false, // validateOnly
        false, // bypassRules
        undefined, // suppressNotifications
        4 // expand = 4 is WorkItemExpand.All in the SDK
      );

      // Prepare the response with both updated work item and original values
      const response = {
        workItem: updatedWorkItem,
        changedFields: {
          original: originalValues,
          updated: {} as Record<string, any>,
        },
      };

      // Extract the updated values for comparison
      for (const fieldPath of Object.keys(originalValues)) {
        response.changedFields.updated[fieldPath] = updatedWorkItem?.fields?.[fieldPath];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}
