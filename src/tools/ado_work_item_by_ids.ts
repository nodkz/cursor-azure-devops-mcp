import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_item_by_ids',
    'List multiple work items by IDs',
    {
      ids: z.array(z.number()).describe('Array of work item IDs'),
    },
    async ({ ids }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();
      const result = await workItemApi.getWorkItems(ids);
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
