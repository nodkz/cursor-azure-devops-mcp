import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';
import { getWorkItemLinks } from './ado_work_item_links.js';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_items_linked',
    'List all linked work items with their full details',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();
      const linkGroups = await getWorkItemLinks(workItemApi, id);

      // Extract all target IDs from all link groups
      const linkedIds: number[] = [];
      Object.values(linkGroups).forEach(links => {
        links.forEach(link => {
          if (link.targetId > 0) {
            linkedIds.push(link.targetId);
          }
        });
      });
      if (linkedIds.length === 0) {
        throw new Error(`No linked work items found for work item ID ${id}.`);
      }

      // Get the full work item details for all linked items
      const linkedWorkItems = await workItemApi.getWorkItems(linkedIds);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(linkedWorkItems, null, 2),
          },
        ],
      };
    }
  );
}
