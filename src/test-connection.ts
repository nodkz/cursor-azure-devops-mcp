#!/usr/bin/env node

import { azureDevOpsService } from './tools/azure-devops-service.js';
import { configManager } from './config-manager.js';

/**
 * Test connection to Azure DevOps API
 */
async function testConnection() {
  // Load configuration from all sources (command line, IDE settings, env vars, defaults)
  const config = configManager.loadConfig();

  console.log('Testing connection to Azure DevOps...');
  console.log(`Organization URL: ${config.azureDevOps.organizationUrl}`);

  try {
    // Initialize the Azure DevOps API client
    await azureDevOpsService.initialize();
    console.log('✅ Connection successful!');

    // Get projects
    console.log('\nFetching projects...');
    const projects = await azureDevOpsService.getProjects();
    console.log(`Found ${projects.length} projects:`);

    // Display projects
    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name} (${project.id})`);
    });

    console.log('\nConnection test completed successfully.');
    return true;
  } catch (error) {
    console.error('❌ Connection failed:', error);
    console.error('\nPlease check your Azure DevOps credentials in the .env file:');
    console.error(
      '- AZURE_DEVOPS_ORG_URL should be in the format: https://dev.azure.com/your-organization'
    );
    console.error(
      '- AZURE_DEVOPS_TOKEN should be a valid personal access token with appropriate permissions'
    );
    return false;
  }
}

// Run the test
testConnection()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
