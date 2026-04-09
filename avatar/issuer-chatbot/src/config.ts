export interface Config {
  vsAgentAdminUrl: string;
  orgVsAdminUrl: string;
  orgVsPublicUrl: string;
  chatbotPort: number;
  databaseUrl: string;
  serviceName: string;
  enableAnoncreds: boolean;
  logLevel: string;
  minioEndpoint: string;
  minioPort: number;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioUseSSL: boolean;
  minioPublicUrl: string;
}

export function loadConfig(): Config {
  return {
    vsAgentAdminUrl: process.env.VS_AGENT_ADMIN_URL || "http://localhost:3000",
    orgVsAdminUrl: process.env.ORG_VS_ADMIN_URL || process.env.VS_AGENT_ADMIN_URL || "http://localhost:3000",
    orgVsPublicUrl: process.env.ORG_VS_PUBLIC_URL || "",
    chatbotPort: parseInt(process.env.CHATBOT_PORT || "4000", 10),
    databaseUrl: process.env.DATABASE_URL || "sqlite:./data/sessions.db",
    serviceName: process.env.SERVICE_NAME || "Example Verana Service",
    enableAnoncreds: process.env.ENABLE_ANONCREDS !== "false",
    logLevel: process.env.LOG_LEVEL || "info",
    minioEndpoint: process.env.MINIO_ENDPOINT || "localhost",
    minioPort: parseInt(process.env.MINIO_PORT || "9000", 10),
    minioAccessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    minioSecretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    minioBucket: process.env.MINIO_BUCKET || "avatar-previews",
    minioUseSSL: process.env.MINIO_USE_SSL === "true",
    minioPublicUrl: process.env.MINIO_PUBLIC_URL || "http://localhost:9000",
  };
}
