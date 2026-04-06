import { Router, Request, Response } from "express";
import { Chatbot } from "./chatbot";

interface ConnectionStateEvent {
  connectionId: string;
  state: string;
  [key: string]: unknown;
}

interface MediaItem {
  uri?: string;
  mimeType?: string;
  byteCount?: number;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

interface MessageReceivedEvent {
  timestamp?: string;
  message: {
    id?: string;
    connectionId: string;
    type?: string;
    content?: string;
    text?: string;
    selectionId?: string;
    menuId?: string;
    selectedOption?: string;
    items?: MediaItem[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function createWebhookRouter(chatbot: Chatbot): Router {
  const router = Router();

  router.post(
    "/connection-state-updated",
    async (req: Request, res: Response) => {
      try {
        const event = req.body as ConnectionStateEvent;
        console.log(
          `Webhook: connection-state-updated — ${event.connectionId} → ${event.state}`
        );

        if (
          event.state === "COMPLETED" ||
          event.state === "completed" ||
          event.state === "active"
        ) {
          await chatbot.onNewConnection(event.connectionId);
        }

        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Error handling connection event:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  router.post("/message-received", async (req: Request, res: Response) => {
    try {
      const event = req.body as MessageReceivedEvent;
      const msg = event.message;
      const connectionId = msg.connectionId;
      const msgType = (msg.type || "").toLowerCase();
      const messageId = msg.id;

      console.log(`Webhook: message-received — ${connectionId} type=${msgType} id=${messageId}`);

      // Ignore system messages (profile auto-disclosure, receipts, etc.)
      if (
        msgType === "profile" ||
        msgType === "receipts"
      ) {
        res.status(200).json({ ok: true });
        return;
      }

      // Send received + viewed indicators for all user messages
      if (messageId && connectionId) {
        chatbot.sendReceipts(connectionId, messageId).catch((err: unknown) =>
          console.error("Failed to send receipts:", err)
        );
      }

      if (msgType === "contextual-menu-select") {
        // ContextualMenuSelectMessage: { selectionId: string }
        const selectionId = msg.selectionId || "";
        await chatbot.onMenuSelect(connectionId, selectionId);
      } else if (msgType === "menu-select") {
        // MenuSelectMessage: { menuItems: [{ id: string }] }
        const menuItems = msg.menuItems as { id: string }[] | undefined;
        const selectionId = menuItems?.[0]?.id || "";
        await chatbot.onMenuSelect(connectionId, selectionId);
      } else if (msgType === "text") {
        const text = msg.content || msg.text || "";
        if (text) {
          await chatbot.onTextMessage(connectionId, text);
        }
      } else if (msgType === "media") {
        const items = msg.items || [];
        const firstItem = items[0];
        console.log(`Media item payload: ${JSON.stringify(firstItem)}`);
        if (firstItem?.uri && firstItem?.mimeType?.startsWith("image/")) {
          const ciphering = firstItem.ciphering as { algorithm: string; parameters?: Record<string, unknown> } | undefined;
          await chatbot.onMediaMessage(connectionId, firstItem.uri, firstItem.mimeType, ciphering);
        } else {
          console.log(`Ignoring media message without image item`);
        }
      } else {
        console.log(`Ignoring unhandled message type: ${msgType}`);
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Error handling message event:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Health check
  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  return router;
}
