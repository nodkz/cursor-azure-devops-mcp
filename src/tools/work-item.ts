import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from './azure-devops-service.js';
import { z } from 'zod';

export function initWorkItemTools(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'azure_devops_work_item_by_id',
    'Get a work item by ID',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      try {
        const result = await azureDevOpsService.getWorkItem(id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error executing azure_devops_work_item for ID ${id}:`, error);
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
    'azure_devops_work_item_list',
    'List multiple work items by IDs',
    {
      ids: z.array(z.number()).describe('Array of work item IDs'),
    },
    async ({ ids }) => {
      try {
        const result = await azureDevOpsService.getWorkItems(ids);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error(`Error executing azure_devops_work_items for IDs ${ids.join(', ')}:`, error);
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

  // New tool for work item attachments
  server.tool(
    'azure_devops_work_item_attachments',
    'List attachments for a specific work item',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const result = await azureDevOpsService.getWorkItemAttachments(id);
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

  server.tool(
    'azure_devops_work_item_links',
    'List links for a specific work item',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const result = await azureDevOpsService.getWorkItemLinks(id);
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

  server.tool(
    'azure_devops_work_items_linked',
    'List all linked work items with their full details',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const result = await azureDevOpsService.getLinkedWorkItems(id);
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

  server.tool(
    'azure_devops_work_item_create',
    'Create a new work item',
    {
      project: z.string().describe('Project name'),
      type: z.string().describe('Work item type (e.g., "Bug", "Task", "User Story")'),
      title: z.string().describe('Work item title'),
      description: z.string().optional().describe('Work item description'),
      parentId: z.number().optional().describe('ID of parent work item if creating a child'),
      fields: z.record(z.any()).optional().describe('Additional custom fields'),
    },
    async ({ project, type, title, description, parentId, fields }) => {
      try {
        const result = await azureDevOpsService.createWorkItem({
          project,
          type,
          title,
          description,
          parentId,
          fields,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error('Error creating work item:', error);
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
}
