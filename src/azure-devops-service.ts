import * as azdev from 'azure-devops-node-api';
import { configManager } from './config-manager.js';
import { ICoreApi } from 'azure-devops-node-api/CoreApi.js';
import { IWorkItemTrackingApi } from 'azure-devops-node-api/WorkItemTrackingApi.js';
import { IGitApi } from 'azure-devops-node-api/GitApi.js';

class LoggingHandler {
  constructor(private wrappedHandler: any) {}

  // Implement the IRequestHandler interface
  prepareRequest(options: any): void {
    console.log('Preparing request:', options);
    this.wrappedHandler.prepareRequest(options);
  }

  canHandleAuthentication(): boolean {
    return this.wrappedHandler.canHandleAuthentication();
  }

  handleAuthentication(response: any, authOptions: any): Promise<any> {
    console.log('Handling auth for response:', response.statusCode);
    return this.wrappedHandler.handleAuthentication(response, authOptions);
  }
}

/**
 * Service for interacting with Azure DevOps API
 */
class AzureDevOpsService {
  private connection: azdev.WebApi;
  private coreApi: ICoreApi | undefined;
  private workItemApi: IWorkItemTrackingApi | undefined;
  private gitApi: IGitApi | undefined;
  public defaultProject: string | undefined;
  public organizationUrl: string;

  constructor(connection?: azdev.WebApi, defaultProject?: string) {
    const config = configManager.loadConfig();
    const { organizationUrl, token } = config.azureDevOps;

    if (!organizationUrl || !token) {
      throw new Error('Azure DevOps organization URL and token are required');
    }

    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    this.connection =
      connection ?? new azdev.WebApi(organizationUrl, new LoggingHandler(authHandler));
    this.defaultProject = defaultProject ?? config.azureDevOps.project;
    this.organizationUrl = organizationUrl;
  }

  async getCoreApi(): Promise<ICoreApi> {
    if (!this.coreApi) {
      this.coreApi = await this.connection.getCoreApi();
    }
    return this.coreApi;
  }

  async getWorkItemApi(): Promise<IWorkItemTrackingApi> {
    if (!this.workItemApi) {
      this.workItemApi = await this.connection.getWorkItemTrackingApi();
    }
    return this.workItemApi;
  }

  async getGitApi(): Promise<IGitApi> {
    if (!this.gitApi) {
      this.gitApi = await this.connection.getGitApi();
    }
    return this.gitApi;
  }

  async testConnection(): Promise<boolean> {
    await this.getCoreApi();
    await this.getWorkItemApi();
    await this.getGitApi();
    return true;
  }
}

// Export the class and create a singleton instance
export { AzureDevOpsService };
export const azureDevOpsService = new AzureDevOpsService();
