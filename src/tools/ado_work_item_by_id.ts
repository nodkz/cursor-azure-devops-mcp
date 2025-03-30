import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_item_by_id',
    'Get a work item by ID',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();
      const workItem = await workItemApi.getWorkItem(
        id,
        undefined,
        undefined,
        4 /* WorkItemExpand.All */
      );
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
