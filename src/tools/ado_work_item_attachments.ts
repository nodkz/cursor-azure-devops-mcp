import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  // New tool for work item attachments
  server.tool(
    'ado_work_item_attachments',
    'List attachments for a specific work item',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      // Get work item with relations (includes attachments)
      const workItemApi = await azureDevOpsService.getWorkItemApi();

      const workItem = await workItemApi.getWorkItem(
        id,
        undefined,
        undefined,
        4 // 4 = WorkItemExpand.Relations in the SDK
      );

      if (!workItem || !workItem.relations) {
        return {
          content: [
            {
              type: 'text',
              text: `No attachments found in WorkItem ${id}`,
            },
          ],
        };
      }

      // Filter for attachment relations
      const attachmentRelations = workItem.relations.filter(
        (relation: any) => relation.rel === 'AttachedFile' || relation.rel === 'Hyperlink'
      );

      // Map relations to attachment objects
      const attachments = attachmentRelations.map((relation: any) => {
        const url = relation.url;
        const attributes = relation.attributes || {};

        const attachment = {
          url,
          name: attributes.name || url.split('/').pop() || 'unnamed',
          comment: attributes.comment || '',
          resourceSize: attributes.resourceSize || 0,
          contentType: attributes.resourceType || '',
        };

        return attachment;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(attachments, null, 2),
          },
        ],
      };
    }
  );
}
