import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AzureDevOpsService } from '../azure-devops-service.js';
import ado_projects from './ado_projects.js';
import ado_repositories from './ado_repositories.js';
import ado_pr_list from './ado_pr_list.js';
import ado_pr_by_id from './ado_pr_by_id.js';
import ado_pr_threads from './ado_pr_threads.js';
import ado_work_item_by_id from './ado_work_item_by_id.js';
import ado_work_item_by_ids from './ado_work_item_by_ids.js';
import ado_work_item_links from './ado_work_item_links.js';
import ado_work_items_linked from './ado_work_items_linked.js';
import ado_work_item_attachments from './ado_work_item_attachments.js';
import ado_work_item_create from './ado_work_item_create.js';
import ado_work_item_update from './ado_work_item_update.js';

export function initTools(server: McpServer, azureDevOpsService: AzureDevOpsService): void {
  spyOnToolCalls(server); // spy on callback that is passed to server.tool(..., cb)

  ado_projects(server, azureDevOpsService);
  ado_repositories(server, azureDevOpsService);
  ado_pr_list(server, azureDevOpsService);
  ado_pr_by_id(server, azureDevOpsService);
  ado_pr_threads(server, azureDevOpsService);
  ado_work_item_by_id(server, azureDevOpsService);
  ado_work_item_by_ids(server, azureDevOpsService);
  ado_work_item_links(server, azureDevOpsService);
  ado_work_items_linked(server, azureDevOpsService);
  ado_work_item_attachments(server, azureDevOpsService);
  ado_work_item_create(server, azureDevOpsService);
  ado_work_item_update(server, azureDevOpsService);
}

function spyOnToolCalls(instance: McpServer) {
  const methodName = 'tool';
  const originalMethod = instance[methodName];

  if (typeof originalMethod !== 'function') {
    throw new Error(`${methodName} is not a function on the provided instance.`);
  }

  instance[methodName] = new Proxy(originalMethod.bind(instance), {
    apply(target, _thisArg, argumentsList: [any, any, any, any]) {
      const name = argumentsList[0];
      const cb = argumentsList[argumentsList.length - 1];
      argumentsList[argumentsList.length - 1] = async (params: any, extra: any) => {
        try {
          console.log(`[${name}] Executing tool with params:`, params, extra);
          const result = await cb(params, extra);
          console.log(`[${name}] Tool executed successfully, result:`, result);
          return result;
        } catch (error) {
          console.error(`[${name}] Error executing tool:`, error);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: String(error) }, null, 2),
              },
            ],
          };
        }
      };
      target(...argumentsList);
    },
  });
}
