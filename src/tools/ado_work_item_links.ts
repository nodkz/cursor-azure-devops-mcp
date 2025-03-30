import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import { z } from 'zod';
import { WorkItemLink } from '../types.js';
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';

export async function getWorkItemLinks(
  workItemApi: IWorkItemTrackingApi,
  id: number
): Promise<Record<string, WorkItemLink[]>> {
  // Get work item with relations
  const workItem = await workItemApi.getWorkItem(
    id,
    undefined,
    undefined,
    4 // 4 = WorkItemExpand.All in the SDK
  );

  if (!workItem) {
    throw new Error(`Work item with ID ${id} not found.`);
  }
  if (!workItem.relations) {
    throw new Error(`Work item with ID ${id} has no relations.`);
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

export default function init(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  server.tool(
    'ado_work_item_links',
    'List links for a specific work item',
    {
      id: z.number().describe('Work item ID'),
    },
    async ({ id }) => {
      const workItemApi = await azureDevOpsService.getWorkItemApi();
      const groupedRelations = await getWorkItemLinks(workItemApi, id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(groupedRelations, null, 2),
          },
        ],
      };
    }
  );
}
