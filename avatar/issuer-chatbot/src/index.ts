import express from "express";
import { loadConfig } from "./config";
import { VsAgentClient } from "./vs-agent-client";
import { discoverSchema } from "./schema-reader";
import { SessionStore } from "./session-store";
import { Db } from "./db";
import { Chatbot } from "./chatbot";
import { createWebhookRouter } from "./webhooks";
import { MediaStore } from "./media-store";

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(`Issuer Chatbot starting...`);
  console.log(`  VS-Agent URL : ${config.vsAgentAdminUrl}`);
  console.log(`  Chatbot port : ${config.chatbotPort}`);
  console.log(`  Service name : ${config.serviceName}`);
  console.log(`  AnonCreds    : ${config.enableAnoncreds}`);
  console.log(`  Database     : ${config.databaseUrl}`);

  // Wait for VS-Agent to be ready
  const client = new VsAgentClient(config);
  const agent = await client.waitForReady();
  console.log(`VS-Agent ready — DID: ${agent.publicDid}`);

  // Discover schema from organization (schema owner)
  const customSchemaBaseId = process.env.CUSTOM_SCHEMA_BASE_ID || "example";
  const orgPublicUrl = config.orgVsPublicUrl || undefined;
  const orgClient = orgPublicUrl
    ? undefined
    : new VsAgentClient({ ...config, vsAgentAdminUrl: config.orgVsAdminUrl });
  const schema = await discoverSchema(
    client,
    customSchemaBaseId,
    orgPublicUrl,
    orgClient
  );

  // Initialize database and session store
  const db = await Db.create(config.databaseUrl);
  const store = new SessionStore();

  // Initialize media store (MinIO)
  const mediaStore = new MediaStore({
    endpoint: config.minioEndpoint,
    port: config.minioPort,
    accessKey: config.minioAccessKey,
    secretKey: config.minioSecretKey,
    bucket: config.minioBucket,
    useSSL: config.minioUseSSL,
    publicUrl: config.minioPublicUrl,
  });
  try {
    await mediaStore.init();
    console.log(`MinIO ready — bucket: ${config.minioBucket}`);
  } catch (err) {
    console.warn(`MinIO init failed (avatar images will not work):`, err);
  }

  // Create chatbot
  const chatbot = new Chatbot(client, store, db, schema, config, mediaStore);

  // Start Express server with webhook routes
  const app = express();
  app.use(express.json());
  app.use("/", createWebhookRouter(chatbot));

  app.listen(config.chatbotPort, () => {
    console.log(`Issuer Chatbot listening on port ${config.chatbotPort}`);
    console.log(`Webhook endpoints:`);
    console.log(
      `  POST http://localhost:${config.chatbotPort}/connection-state-updated`
    );
    console.log(
      `  POST http://localhost:${config.chatbotPort}/message-received`
    );
    console.log(
      `  GET  http://localhost:${config.chatbotPort}/health`
    );
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down...");
    store.close();
    db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
