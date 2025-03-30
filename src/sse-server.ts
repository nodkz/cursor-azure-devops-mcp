#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { azureDevOpsService } from './azure-devops-service.js';
import { config } from './config.js';
import { version, name } from '../package.json';
import { initTools } from './tools/index.js';

// Create Express app
const app = express();
const PORT = config.server.port;

const server = new McpServer({ name, version });
initTools(server, azureDevOpsService);

app.use(cors());

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports = new Map<string, SSEServerTransport>();

// Serve basic info at root
app.get('/', (_req, res) => {
  res.send(`
    <h1>Azure DevOps MCP Server</h1>
    <p>Status: Running</p>
    <p>SSE endpoint: <a href="/sse">/sse</a></p>
    <p>Version: ${version}</p>
    <p>Active connections: ${transports.size}</p>
    <p>Available tools:</p>
    <table>
      ${Object.entries<any>((server as any)._registeredTools)
        .map(([name, tool]) => `<tr><td>${name}</td><td>${tool.description}</td></tr>`)
        .join('')}
    </table>
  `);
});

// SSE endpoint - this is what Cursor connects to
app.get('/sse', async (req, res) => {
  console.log('New SSE connection request from:', req.headers['user-agent']);
  const transport = new SSEServerTransport('/message', res);
  transports.set(transport.sessionId, transport);
  res.on('close', () => {
    console.log('Client disconnected:', transport.sessionId);
    transports.delete(transport.sessionId);
  });
  await server.connect(transport);
  console.log('SSE transport connected:', transport.sessionId);
});

// Message endpoint for receiving messages from the client
app.post('/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  console.log('Received message from client: ', sessionId);
  const transport = transports.get(sessionId);

  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send('No transport found for sessionId');
  }
});

// Initialize Azure DevOps connection
async function initializeAzureDevOps() {
  try {
    await azureDevOpsService.testConnection();
    console.log('Azure DevOps API connection initialized successfully');
    return true;
  } catch (error) {
    console.error('Error connecting to Azure DevOps API:', error);
    console.error('Please check your .env configuration');
    return false;
  }
}

// Start HTTP server
async function startServer() {
  // Initialize Azure DevOps connection
  const initialized = await initializeAzureDevOps();
  if (!initialized) {
    console.error('Failed to initialize Azure DevOps connection. Exiting...');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`Message endpoint: http://localhost:${PORT}/message`);
  });
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Start the server
console.log('Starting Azure DevOps MCP Server with SSE transport...');
console.log('Available tools:');
Object.entries<any>((server as any)._registeredTools).forEach(([name, tool]) => {
  console.log(`- ${name}: ${tool.description}`);
});
console.log('');
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});
