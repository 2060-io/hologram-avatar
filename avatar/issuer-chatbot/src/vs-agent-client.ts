import { Config } from "./config";

export interface AgentInfo {
  publicDid: string;
  label: string;
  [key: string]: unknown;
}

export interface VtjscCredential {
  id: string;
  credentialSubject?: {
    jsonSchema?: { $ref: string } | string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface VtjscEntry {
  credential: VtjscCredential;
  schemaId: string;
  [key: string]: unknown;
}

export interface VtjscListResponse {
  data: VtjscEntry[];
}

export interface CreateCredentialTypeRequest {
  name: string;
  version: string;
  attributes?: string[];
  relatedJsonSchemaCredentialId?: string;
  supportRevocation: boolean;
}

export interface CredentialType {
  id: string;
  name: string;
  version: string;
  relatedJsonSchemaCredentialId?: string;
  [key: string]: unknown;
}

export interface CredentialIssuanceClaim {
  name: string;
  value: string;
  mimeType?: string;
}

export interface ContextualMenuEntry {
  id: string;
  title: string;
}

export interface ContextualMenu {
  title: string;
  description: string;
  options: ContextualMenuEntry[];
}

export interface SendMessageRequest {
  connectionId: string;
  content: string;
  contextualMenu?: ContextualMenu;
}

export class VsAgentClient {
  private baseUrl: string;

  constructor(config: Config) {
    this.baseUrl = config.vsAgentAdminUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `VS-Agent API error: ${method} ${path} returned ${response.status}: ${text}`
      );
    }
    return response.json() as Promise<T>;
  }

  async getAgent(): Promise<AgentInfo> {
    return this.request<AgentInfo>("GET", "/v1/agent");
  }

  async getJsonSchemaCredentials(): Promise<VtjscListResponse> {
    return this.request<VtjscListResponse>(
      "GET",
      "/v1/vt/json-schema-credentials"
    );
  }

  async getCredentialTypes(): Promise<CredentialType[]> {
    return this.request<CredentialType[]>("GET", "/v1/credential-types");
  }

  async createCredentialType(
    params: CreateCredentialTypeRequest
  ): Promise<CredentialType> {
    return this.request<CredentialType>(
      "POST",
      "/v1/credential-types",
      params
    );
  }

  async issueCredentialOverConnection(
    connectionId: string,
    credentialDefinitionId: string,
    claims: CredentialIssuanceClaim[]
  ): Promise<void> {
    await this.request<unknown>("POST", "/v1/message", {
      type: "credential-issuance",
      connectionId,
      credentialDefinitionId,
      claims,
    });
  }

  async sendReceipts(
    connectionId: string,
    messageId: string,
    states: string[] = ["received", "viewed"]
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.request<unknown>("POST", "/v1/message", {
      type: "receipts",
      connectionId,
      receipts: states.map((state) => ({
        message_id: messageId,
        state,
        timestamp: now,
      })),
    });
  }

  async sendMediaUrl(
    connectionId: string,
    url: string,
    description?: string
  ): Promise<void> {
    await this.request<unknown>("POST", "/v1/message", {
      type: "media",
      connectionId,
      items: [
        {
          uri: url,
          mimeType: "text/uri-list",
          description: description || url,
        },
      ],
    });
  }

  async sendMediaImage(
    connectionId: string,
    uri: string,
    mimeType: string,
    width: number,
    height: number,
    byteCount: number,
    description?: string,
    preview?: string
  ): Promise<void> {
    const item: Record<string, unknown> = {
      uri,
      mimeType,
      width,
      height,
      byteCount,
      description: description || "Avatar image",
    };
    if (preview) {
      item.preview = preview;
    }
    await this.request<unknown>("POST", "/v1/message", {
      type: "media",
      connectionId,
      description: description || "Avatar image",
      items: [item],
    });
  }

  async sendMessage(params: SendMessageRequest): Promise<void> {
    // Send text message
    await this.request<unknown>("POST", "/v1/message", {
      type: "text",
      connectionId: params.connectionId,
      content: params.content,
    });

    // Send contextual menu update if provided
    if (params.contextualMenu) {
      await this.request<unknown>("POST", "/v1/message", {
        type: "contextual-menu-update",
        connectionId: params.connectionId,
        title: params.contextualMenu.title,
        description: params.contextualMenu.description,
        options: params.contextualMenu.options,
      });
    }
  }

  async sendQuestionMessage(
    connectionId: string,
    question: string,
    options: { id: string; title: string }[],
    contextualMenu?: ContextualMenu
  ): Promise<void> {
    await this.request<unknown>("POST", "/v1/message", {
      type: "menu-display",
      connectionId,
      prompt: question,
      menuItems: options.map((o) => ({ id: o.id, text: o.title })),
    });
    if (contextualMenu) {
      await this.request<unknown>("POST", "/v1/message", {
        type: "contextual-menu-update",
        connectionId,
        title: contextualMenu.title,
        description: contextualMenu.description,
        options: contextualMenu.options,
      });
    }
  }

  async sendMenuUpdate(
    connectionId: string,
    menu: ContextualMenu
  ): Promise<void> {
    await this.request<unknown>("POST", "/v1/message", {
      type: "contextual-menu-update",
      connectionId,
      title: menu.title,
      description: menu.description,
      options: menu.options,
    });
  }

  async waitForReady(
    maxRetries: number = 30,
    intervalMs: number = 2000
  ): Promise<AgentInfo> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.getAgent();
      } catch {
        if (i < maxRetries - 1) {
          console.log(
            `Waiting for VS-Agent at ${this.baseUrl}... (${i + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }
    }
    throw new Error(
      `VS-Agent not reachable at ${this.baseUrl} after ${maxRetries} retries`
    );
  }
}
