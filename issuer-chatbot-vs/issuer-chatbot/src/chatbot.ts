import * as OTPAuth from "otpauth";
import { randomUUID } from "crypto";
import { Config } from "./config";
import { VsAgentClient, ContextualMenu, ContextualMenuEntry } from "./vs-agent-client";
import { SchemaInfo } from "./schema-reader";
import { SessionStore, FlowType, FlowStep } from "./session-store";
import { Db } from "./db";
import { MediaStore, CipheringInfo } from "./media-store";
import { processAvatarImage } from "./image-processor";

export class Chatbot {
  private client: VsAgentClient;
  private store: SessionStore;
  private db: Db;
  private schema: SchemaInfo;
  private config: Config;
  private mediaStore: MediaStore;

  constructor(
    client: VsAgentClient,
    store: SessionStore,
    db: Db,
    schema: SchemaInfo,
    config: Config,
    mediaStore: MediaStore
  ) {
    this.client = client;
    this.store = store;
    this.db = db;
    this.schema = schema;
    this.config = config;
    this.mediaStore = mediaStore;
  }

  // -----------------------------------------------------------------------
  // Public webhook entry points
  // -----------------------------------------------------------------------

  async sendReceipts(connectionId: string, messageId: string): Promise<void> {
    await this.client.sendReceipts(connectionId, messageId);
  }

  async onNewConnection(connectionId: string): Promise<void> {
    console.log(`New connection: ${connectionId}`);
    await this.db.ensureAccount(connectionId);
    this.store.resetFlow(connectionId);

    // Auto-run /setup for first-time users (no auth methods configured)
    if (!(await this.db.hasAuthMethods(connectionId))) {
      await this.cmdSetup(connectionId);
      return;
    }

    await this.send(connectionId, `Welcome back to Avatar Issuer!\nType a command or use the menu.`);
  }

  async onMenuSelect(connectionId: string, menuId: string): Promise<void> {
    console.log(`Menu select from ${connectionId}: ${menuId}`);
    await this.db.ensureAccount(connectionId);

    // Abort always takes priority
    if (menuId === "abort") {
      await this.handleInput(connectionId, "/abort");
      return;
    }

    // If a flow is active, route the selection to it first
    if (this.store.isInFlow(connectionId)) {
      await this.routeToFlow(connectionId, menuId);
      return;
    }

    // Contextual menu selections that map to commands (only when no flow active)
    const commandMap: Record<string, string> = {
      new_avatar: "/new",
      list: "/list",
      restore: "/restore",
      auth: "/auth",
      setup: "/setup",
      logout: "/logout",
      password: "/password",
      authenticator: "/authenticator",
      help: "/usage",
    };

    const cmd = commandMap[menuId];
    if (cmd) {
      await this.handleInput(connectionId, cmd);
      return;
    }

    // Fallback — treat as free text input
    await this.handleInput(connectionId, menuId);
  }

  async onTextMessage(connectionId: string, text: string): Promise<void> {
    console.log(`Text from ${connectionId}: ${text}`);
    await this.db.ensureAccount(connectionId);
    await this.handleInput(connectionId, text.trim());
  }

  async onMediaMessage(
    connectionId: string,
    uri: string,
    mimeType: string,
    ciphering?: CipheringInfo
  ): Promise<void> {
    console.log(`Media from ${connectionId}: ${mimeType} ${uri}`);
    await this.db.ensureAccount(connectionId);

    const flow = this.store.getFlow(connectionId);
    if (
      flow.step === FlowStep.NEW_AWAIT_IMAGE ||
      flow.step === FlowStep.ISSUE_AWAIT_IMAGE
    ) {
      await this.flowProcessImage(connectionId, uri, ciphering);
    } else {
      await this.send(connectionId, "Image received, but no active flow is expecting an image.");
    }
  }

  // -----------------------------------------------------------------------
  // Core router
  // -----------------------------------------------------------------------

  private async handleInput(connectionId: string, input: string): Promise<void> {
    // Check for commands first
    if (input.startsWith("/")) {
      const parts = input.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const arg = parts.slice(1).join(" ").trim() || undefined;

      switch (cmd) {
        case "/abort":
          return this.cmdAbort(connectionId);
        case "/list":
          return this.cmdList(connectionId);
        case "/new":
          return this.cmdNew(connectionId);
        case "/delete":
          return this.cmdDelete(connectionId);
        case "/issue":
          return this.cmdIssue(connectionId, arg);
        case "/restore":
          return this.cmdRestore(connectionId);
        case "/auth":
          return this.cmdAuth(connectionId);
        case "/password":
          return this.cmdPassword(connectionId);
        case "/authenticator":
          return this.cmdAuthenticator(connectionId);
        case "/setup":
          return this.cmdSetup(connectionId);
        case "/config_auth":
          return this.cmdConfigAuth(connectionId);
        case "/logout":
          return this.cmdLogout(connectionId);
        case "/usage":
        case "/help":
          return this.cmdUsage(connectionId);
        default:
          return this.send(connectionId, `Unknown command: ${cmd}`);
      }
    }

    // Not a command — route to active flow
    await this.routeToFlow(connectionId, input);
  }

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  private async cmdAbort(connectionId: string): Promise<void> {
    if (!this.store.isInFlow(connectionId)) {
      return this.send(connectionId, "No active flow to abort.");
    }
    this.store.resetFlow(connectionId);
    await this.send(connectionId, "Flow cancelled.");
  }

  private async cmdList(connectionId: string): Promise<void> {
    const avatars = await this.db.listAvatars(connectionId);
    if (avatars.length === 0) {
      return this.send(connectionId, "You have no avatars yet. Use /new to create one.");
    }
    const list = avatars.map((a) => `• ${a.name}`).join("\n");
    await this.send(connectionId, `Your avatars:\n${list}`);
  }

  private async cmdNew(connectionId: string): Promise<void> {
    this.store.setFlow(connectionId, FlowType.NEW_AVATAR, FlowStep.NEW_AWAIT_NAME);
    await this.send(connectionId, "Enter a name for your new avatar:");
  }

  private async cmdDelete(connectionId: string): Promise<void> {
    this.store.setFlow(connectionId, FlowType.DELETE_AVATAR, FlowStep.DELETE_AWAIT_NAME);
    await this.send(connectionId, "Enter the name of the avatar to delete:");
  }

  private async cmdIssue(connectionId: string, name?: string): Promise<void> {
    if (name) {
      return this.doIssue(connectionId, name);
    }
    this.store.setFlow(connectionId, FlowType.ISSUE, FlowStep.ISSUE_AWAIT_NAME);
    await this.send(connectionId, "Enter the name of the avatar to reissue:");
  }

  private async cmdRestore(connectionId: string): Promise<void> {
    this.store.setFlow(connectionId, FlowType.RESTORE, FlowStep.RESTORE_AWAIT_NAME);
    await this.send(connectionId, "Enter the name of an avatar you want to restore:");
  }

  private async cmdAuth(connectionId: string): Promise<void> {
    if (await this.db.isAuthenticated(connectionId)) {
      return this.send(connectionId, "You are already authenticated.");
    }
    if (!(await this.db.hasAuthMethods(connectionId))) {
      return this.send(connectionId, "No authentication method configured. Use /setup first.");
    }
    await this.promptAuthMethod(connectionId, FlowType.AUTH, FlowStep.AUTH_AWAIT_METHOD);
  }

  private async cmdPassword(connectionId: string): Promise<void> {
    if ((await this.db.hasAuthMethods(connectionId)) && !(await this.db.isAuthenticated(connectionId))) {
      this.store.setFlow(connectionId, FlowType.PASSWORD, FlowStep.PASSWORD_AWAIT_AUTH);
      return this.send(connectionId, "You must authenticate first. Use /auth.");
    }
    this.store.setFlow(connectionId, FlowType.PASSWORD, FlowStep.PASSWORD_AWAIT_ENTER);
    await this.send(connectionId, "Enter your new password:");
  }

  private async cmdAuthenticator(connectionId: string): Promise<void> {
    if ((await this.db.hasAuthMethods(connectionId)) && !(await this.db.isAuthenticated(connectionId))) {
      this.store.setFlow(connectionId, FlowType.AUTHENTICATOR, FlowStep.AUTHENTICATOR_AWAIT_AUTH);
      return this.send(connectionId, "You must authenticate first. Use /auth.");
    }
    await this.startAuthenticatorSetup(connectionId);
  }

  private async cmdSetup(connectionId: string): Promise<void> {
    if (await this.db.hasAuthMethods(connectionId)) {
      return this.send(connectionId, "You already have an authentication method configured. Use /auth to authenticate, then /password or /authenticator to change it.");
    }
    this.store.setFlow(connectionId, FlowType.SETUP, FlowStep.SETUP_AWAIT_CHOICE);
    await this.client.sendQuestionMessage(
      connectionId,
      "Welcome! What would you like to do?",
      [
        { id: "setup_restore", title: "Restore Avatar(s)" },
        { id: "setup_new", title: "New Account" },
      ],
      await this.buildMenu(connectionId)
    );
  }

  private async cmdLogout(connectionId: string): Promise<void> {
    if (!(await this.db.isAuthenticated(connectionId))) {
      return this.send(connectionId, "You are not authenticated.");
    }
    await this.db.logout(connectionId);
    await this.send(connectionId, "You have been logged out.");
  }

  // -----------------------------------------------------------------------
  // Flow routing
  // -----------------------------------------------------------------------

  private async routeToFlow(connectionId: string, input: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);

    switch (flow.step) {
      // /new
      case FlowStep.NEW_AWAIT_NAME:
        return this.flowNewName(connectionId, input);
      case FlowStep.NEW_AWAIT_NAME_CONFIRM:
        return this.flowNewNameConfirm(connectionId, input);
      case FlowStep.NEW_AWAIT_IMAGE:
        return this.flowImageSkipOrText(connectionId, input);
      case FlowStep.NEW_AWAIT_IMAGE_CONFIRM:
        return this.flowImageConfirm(connectionId, input);

      // /delete
      case FlowStep.DELETE_AWAIT_NAME:
        return this.flowDeleteName(connectionId, input);

      // /issue
      case FlowStep.ISSUE_AWAIT_NAME:
        return this.doIssue(connectionId, input);
      case FlowStep.ISSUE_AWAIT_IMAGE:
        return this.flowImageSkipOrText(connectionId, input);
      case FlowStep.ISSUE_AWAIT_IMAGE_CONFIRM:
        return this.flowImageConfirm(connectionId, input);

      // /restore
      case FlowStep.RESTORE_AWAIT_NAME:
        return this.flowRestoreName(connectionId, input);
      case FlowStep.RESTORE_AWAIT_METHOD:
        return this.flowRestoreMethod(connectionId, input);
      case FlowStep.RESTORE_AWAIT_PASSWORD:
        return this.flowRestorePassword(connectionId, input);
      case FlowStep.RESTORE_AWAIT_OTP:
        return this.flowRestoreOtp(connectionId, input);

      // /auth
      case FlowStep.AUTH_AWAIT_METHOD:
        return this.flowAuthMethod(connectionId, input);
      case FlowStep.AUTH_AWAIT_PASSWORD:
        return this.flowAuthPassword(connectionId, input);
      case FlowStep.AUTH_AWAIT_OTP:
        return this.flowAuthOtp(connectionId, input);

      // /password
      case FlowStep.PASSWORD_AWAIT_AUTH:
        return this.send(connectionId, "Please authenticate first with /auth, then retry /password.");
      case FlowStep.PASSWORD_AWAIT_ENTER:
        return this.flowPasswordEnter(connectionId, input);
      case FlowStep.PASSWORD_AWAIT_CONFIRM:
        return this.flowPasswordConfirm(connectionId, input);

      // /authenticator
      case FlowStep.AUTHENTICATOR_AWAIT_AUTH:
        return this.send(connectionId, "Please authenticate first with /auth, then retry /authenticator.");
      case FlowStep.AUTHENTICATOR_AWAIT_OTP:
        return this.flowAuthenticatorOtp(connectionId, input);

      // /setup
      case FlowStep.SETUP_AWAIT_CHOICE:
        return this.flowSetupChoice(connectionId, input);

      // /config_auth
      case FlowStep.CONFIG_AUTH_AWAIT_METHOD:
        return this.flowConfigAuthMethod(connectionId, input);

      default:
        await this.send(connectionId, "Type a command or use the menu. Try /new to create an avatar.");
    }
  }

  // -----------------------------------------------------------------------
  // /new flow
  // -----------------------------------------------------------------------

  private async flowNewName(connectionId: string, name: string): Promise<void> {
    // Validate @ prefix format
    if (!name.startsWith("@") || name.slice(1).includes("@")) {
      return this.send(connectionId, `Avatar name must start with "@" and contain no other "@" characters. Try again:`);
    }

    // Validate length
    const minLen = this.schema.nameMinLength;
    const maxLen = this.schema.nameMaxLength;
    if (name.length < minLen || name.length > maxLen) {
      return this.send(connectionId, `Avatar name must be between ${minLen} and ${maxLen} characters. Try again:`);
    }

    // Check uniqueness
    if (await this.db.getAvatar(name)) {
      return this.send(connectionId, `The avatar name "${name}" is already taken. Try another name:`);
    }

    // Step 2: Confirm name
    this.store.updateStep(connectionId, FlowStep.NEW_AWAIT_NAME_CONFIRM, { avatarName: name });
    await this.client.sendQuestionMessage(
      connectionId,
      `Avatar name: ${name}. Confirm?`,
      [
        { id: "confirm_yes", title: "Yes" },
        { id: "confirm_no", title: "No" },
      ],
      await this.buildMenu(connectionId)
    );
  }

  private async flowNewNameConfirm(connectionId: string, input: string): Promise<void> {
    if (input === "confirm_no") {
      this.store.updateStep(connectionId, FlowStep.NEW_AWAIT_NAME);
      return this.send(connectionId, "Enter a name for your new avatar:");
    }
    if (input !== "confirm_yes") {
      return this.send(connectionId, "Please select Yes or No.");
    }

    // Name confirmed — move to image step
    await this.promptForImage(connectionId);
  }

  // -----------------------------------------------------------------------
  // Shared image flow (used by both /new and /issue)
  // -----------------------------------------------------------------------

  private async promptForImage(connectionId: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    const imageStep =
      flow.type === FlowType.NEW_AVATAR
        ? FlowStep.NEW_AWAIT_IMAGE
        : FlowStep.ISSUE_AWAIT_IMAGE;

    this.store.updateStep(connectionId, imageStep);

    await this.send(
      connectionId,
      "Send an image for your avatar (preferably squared, minimum 128×128)."
    );
    await this.client.sendQuestionMessage(
      connectionId,
      "Or you can skip",
      [{ id: "skip_image", title: "Skip" }],
      await this.buildMenu(connectionId)
    );
  }

  private async flowImageSkipOrText(connectionId: string, input: string): Promise<void> {
    if (input === "skip_image") {
      // Issue with empty avatar
      await this.finalizeIssue(connectionId, "");
      return;
    }
    await this.send(connectionId, "Please send an image, or tap Skip.");
  }

  private async flowProcessImage(
    connectionId: string,
    mediaUri: string,
    ciphering?: CipheringInfo
  ): Promise<void> {
    try {
      await this.send(connectionId, "Processing your image...");

      // Download from VS-Agent media URI (decrypt if ciphering present)
      const { buffer } = await this.mediaStore.downloadFromUrl(mediaUri, ciphering);

      // Process: center crop + resize to 512x512 + PNG
      const processed = await processAvatarImage(buffer);

      // Upload to MinIO
      const objectName = `${connectionId}/${randomUUID()}.png`;
      const presignedUrl = await this.mediaStore.upload(
        objectName,
        processed.buffer,
        processed.mimeType
      );

      // Send processed image back to user (with 64x64 thumbnail preview)
      await this.client.sendMediaImage(
        connectionId,
        presignedUrl,
        processed.mimeType,
        processed.width,
        processed.height,
        processed.buffer.length,
        "Your processed avatar",
        processed.previewBase64
      );

      // Store the base64 data URI in flow data for credential issuance
      const flow = this.store.getFlow(connectionId);
      const confirmStep =
        flow.type === FlowType.NEW_AVATAR
          ? FlowStep.NEW_AWAIT_IMAGE_CONFIRM
          : FlowStep.ISSUE_AWAIT_IMAGE_CONFIRM;

      this.store.updateStep(connectionId, confirmStep, {
        avatarBase64: processed.base64DataUri,
      });

      await this.client.sendQuestionMessage(
        connectionId,
        "Confirm this avatar?",
        [
          { id: "image_yes", title: "Yes" },
          { id: "image_no", title: "No" },
        ],
        await this.buildMenu(connectionId)
      );
    } catch (error) {
      console.error(`Failed to process image for ${connectionId}:`, error);
      await this.send(connectionId, "Failed to process image. Please try again or tap Skip.");
      // Stay in the same image-await step
    }
  }

  private async flowImageConfirm(connectionId: string, input: string): Promise<void> {
    if (input === "image_no") {
      // Go back to image prompt
      await this.promptForImage(connectionId);
      return;
    }
    if (input !== "image_yes") {
      return this.send(connectionId, "Please select Yes or No.");
    }

    const flow = this.store.getFlow(connectionId);
    const avatarBase64 = flow.data.avatarBase64 || "";
    await this.finalizeIssue(connectionId, avatarBase64);
  }

  private async finalizeIssue(connectionId: string, avatarValue: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    const avatarName = flow.data.avatarName;

    if (flow.type === FlowType.NEW_AVATAR) {
      // Persist the avatar in DB
      await this.db.createAvatar(avatarName, connectionId);
      await this.send(connectionId, `Avatar "${avatarName}" created! Issuing credential...`);
    } else {
      await this.send(connectionId, `Reissuing credential for "${avatarName}"...`);
    }

    this.store.resetFlow(connectionId);
    await this.doIssueInternal(connectionId, avatarName, avatarValue);
  }

  // -----------------------------------------------------------------------
  // /delete flow
  // -----------------------------------------------------------------------

  private async flowDeleteName(connectionId: string, name: string): Promise<void> {
    const avatar = await this.db.getAvatar(name);
    if (!avatar) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `Avatar "${name}" not found.`);
    }
    if (avatar.accountConnectionId !== connectionId) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `You are not the owner of avatar "${name}".`);
    }
    await this.db.deleteAvatar(name);
    this.store.resetFlow(connectionId);
    await this.send(connectionId, `Avatar "${name}" deleted.`);
  }

  // -----------------------------------------------------------------------
  // /issue
  // -----------------------------------------------------------------------

  private async doIssue(connectionId: string, name: string): Promise<void> {
    const avatar = await this.db.getAvatar(name);
    if (!avatar) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `Avatar "${name}" not found.`);
    }
    if (avatar.accountConnectionId !== connectionId) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `You are not the owner of avatar "${name}".`);
    }

    // Start the image prompt flow for reissuance
    this.store.setFlow(connectionId, FlowType.ISSUE, FlowStep.ISSUE_AWAIT_IMAGE, {
      avatarName: name,
    });
    await this.promptForImage(connectionId);
  }

  private async doIssueInternal(
    connectionId: string,
    avatarName: string,
    avatarValue: string = ""
  ): Promise<void> {
    try {
      const claimsArray = this.schema.attributes.map((attr) => {
        if (attr.name === "name") return { name: attr.name, value: avatarName };
        if (attr.name === "avatar") return { name: attr.name, value: avatarValue };
        return { name: attr.name, value: "" };
      });
      console.log(`Issuing credential to ${connectionId} for avatar "${avatarName}"`);

      await this.client.issueCredentialOverConnection(
        connectionId,
        this.schema.credentialDefinitionId,
        claimsArray
      );

      await this.send(connectionId, `Credential for "${avatarName}" issued successfully!`);
    } catch (error) {
      console.error(`Failed to issue credential for ${connectionId}:`, error);
      await this.send(connectionId, `Failed to issue credential. Please try again with /issue ${avatarName}`);
    }
  }

  // -----------------------------------------------------------------------
  // /restore flow
  // -----------------------------------------------------------------------

  private async flowRestoreName(connectionId: string, avatarName: string): Promise<void> {
    const ownerConnectionId = await this.db.findAccountByAvatar(avatarName);
    if (!ownerConnectionId) {
      return this.send(connectionId, `Avatar "${avatarName}" not found. Enter the name of an avatar you want to restore:`);
    }
    if (ownerConnectionId === connectionId) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `You already own avatar "${avatarName}".`);
    }

    // Check what auth methods the OLD account has
    const oldAccount = await this.db.getAccount(ownerConnectionId);
    if (!oldAccount) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `Account for this avatar no longer exists.`);
    }

    const methods: { id: string; title: string }[] = [];
    if (oldAccount.passwordHash) methods.push({ id: "password", title: "Password" });
    if (oldAccount.authenticatorSecret) methods.push({ id: "authenticator", title: "Authenticator" });

    if (methods.length === 0) {
      this.store.resetFlow(connectionId);
      return this.send(connectionId, `No recovery method was configured for this avatar. Recovery is not possible.`);
    }

    this.store.updateStep(connectionId, FlowStep.RESTORE_AWAIT_METHOD, {
      avatarName,
      oldConnectionId: ownerConnectionId,
    });

    await this.client.sendQuestionMessage(
      connectionId,
      "Choose a recovery method:",
      methods,
      await this.buildMenu(connectionId)
    );
  }

  private async flowRestoreMethod(connectionId: string, method: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    if (method === "password") {
      this.store.updateStep(connectionId, FlowStep.RESTORE_AWAIT_PASSWORD);
      await this.send(connectionId, "Enter the password for the old account:");
    } else if (method === "authenticator") {
      this.store.updateStep(connectionId, FlowStep.RESTORE_AWAIT_OTP);
      await this.send(connectionId, "Enter the authenticator code (OTP):");
    } else {
      await this.send(connectionId, "Invalid choice. Please select from the options.");
    }
  }

  private async flowRestorePassword(connectionId: string, password: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    const oldConnectionId = flow.data.oldConnectionId;

    if (await this.db.verifyPassword(oldConnectionId, password)) {
      await this.completeRestore(connectionId, oldConnectionId);
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Incorrect password. Restore failed.");
    }
  }

  private async flowRestoreOtp(connectionId: string, otp: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    const oldConnectionId = flow.data.oldConnectionId;
    const secret = await this.db.getAuthenticatorSecret(oldConnectionId);

    if (secret && this.verifyTotp(secret, otp)) {
      await this.completeRestore(connectionId, oldConnectionId);
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Invalid OTP. Restore failed.");
    }
  }

  private async completeRestore(connectionId: string, oldConnectionId: string): Promise<void> {
    await this.db.mergeAccounts(oldConnectionId, connectionId);
    await this.db.setAuthenticated(connectionId);
    this.store.resetFlow(connectionId);

    const avatars = await this.db.listAvatars(connectionId);
    const list = avatars.map((a) => `• ${a.name}`).join("\n");
    await this.send(connectionId, `Restore successful! Your avatars:\n${list}`);
  }

  // -----------------------------------------------------------------------
  // /auth flow
  // -----------------------------------------------------------------------

  private async promptAuthMethod(
    connectionId: string,
    flowType: FlowType,
    awaitStep: FlowStep
  ): Promise<void> {
    const account = (await this.db.getAccount(connectionId))!;
    const methods: { id: string; title: string }[] = [];
    if (account.passwordHash) methods.push({ id: "password", title: "Password" });
    if (account.authenticatorSecret) methods.push({ id: "authenticator", title: "Authenticator" });

    this.store.setFlow(connectionId, flowType, awaitStep);
    await this.client.sendQuestionMessage(
      connectionId,
      "Choose an authentication method:",
      methods,
      await this.buildMenu(connectionId)
    );
  }

  private async flowAuthMethod(connectionId: string, method: string): Promise<void> {
    if (method === "password") {
      this.store.updateStep(connectionId, FlowStep.AUTH_AWAIT_PASSWORD);
      await this.send(connectionId, "Enter your password:");
    } else if (method === "authenticator") {
      this.store.updateStep(connectionId, FlowStep.AUTH_AWAIT_OTP);
      await this.send(connectionId, "Enter the authenticator code (OTP):");
    } else {
      await this.send(connectionId, "Invalid choice. Please select from the options.");
    }
  }

  private async flowAuthPassword(connectionId: string, password: string): Promise<void> {
    if (await this.db.verifyPassword(connectionId, password)) {
      await this.db.setPasswordAuth(connectionId);
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Authentication successful!");
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Incorrect password. Authentication failed.");
    }
  }

  private async flowAuthOtp(connectionId: string, otp: string): Promise<void> {
    const secret = await this.db.getAuthenticatorSecret(connectionId);
    if (secret && this.verifyTotp(secret, otp)) {
      await this.db.setAuthenticatorAuth(connectionId);
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Authentication successful!");
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Invalid OTP. Authentication failed.");
    }
  }

  // -----------------------------------------------------------------------
  // /password flow
  // -----------------------------------------------------------------------

  private async flowPasswordEnter(connectionId: string, password: string): Promise<void> {
    this.store.updateStep(connectionId, FlowStep.PASSWORD_AWAIT_CONFIRM, { password });
    await this.send(connectionId, "Confirm your password:");
  }

  private async flowPasswordConfirm(connectionId: string, confirm: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    if (confirm === flow.data.password) {
      await this.db.setPassword(connectionId, confirm);
      await this.db.setAuthenticated(connectionId);
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Password saved successfully!");
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Passwords do not match. Try again with /password.");
    }
  }

  // -----------------------------------------------------------------------
  // /authenticator flow
  // -----------------------------------------------------------------------

  private async startAuthenticatorSetup(connectionId: string): Promise<void> {
    const secret = new OTPAuth.Secret({ size: 20 });

    this.store.setFlow(connectionId, FlowType.AUTHENTICATOR, FlowStep.AUTHENTICATOR_AWAIT_OTP, {
      secret: secret.base32,
    });

    await this.send(connectionId, "Set up your authenticator app (Google Authenticator, Authy, etc.).");
    await this.send(connectionId, "Copy this secret and add it manually to your app:");
    await this.send(connectionId, secret.base32);
    await this.send(connectionId, "Then enter the 6-digit code to confirm:");
  }

  private async flowAuthenticatorOtp(connectionId: string, otp: string): Promise<void> {
    const flow = this.store.getFlow(connectionId);
    const secret = flow.data.secret;

    if (this.verifyTotp(secret, otp)) {
      await this.db.setAuthenticatorSecret(connectionId, secret);
      await this.db.setAuthenticated(connectionId);
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Authenticator configured successfully!");
    } else {
      this.store.resetFlow(connectionId);
      await this.send(connectionId, "Invalid code. Authenticator setup failed. Try again with /authenticator.");
    }
  }

  // -----------------------------------------------------------------------
  // /setup flow
  // -----------------------------------------------------------------------

  private async flowSetupChoice(connectionId: string, choice: string): Promise<void> {
    if (choice === "setup_restore") {
      return this.cmdRestore(connectionId);
    } else if (choice === "setup_new") {
      return this.cmdConfigAuth(connectionId);
    } else {
      await this.send(connectionId, "Invalid choice. Please select from the options.");
    }
  }

  // -----------------------------------------------------------------------
  // /config_auth flow
  // -----------------------------------------------------------------------

  private async cmdConfigAuth(connectionId: string): Promise<void> {
    this.store.setFlow(connectionId, FlowType.CONFIG_AUTH, FlowStep.CONFIG_AUTH_AWAIT_METHOD);
    await this.client.sendQuestionMessage(
      connectionId,
      "Choose an authentication method to set up:",
      [
        { id: "config_password", title: "Password" },
        { id: "config_authenticator", title: "Authenticator" },
      ],
      await this.buildMenu(connectionId)
    );
  }

  private async flowConfigAuthMethod(connectionId: string, method: string): Promise<void> {
    if (method === "config_password") {
      this.store.setFlow(connectionId, FlowType.PASSWORD, FlowStep.PASSWORD_AWAIT_ENTER);
      await this.send(connectionId, "Enter your new password:");
    } else if (method === "config_authenticator") {
      await this.startAuthenticatorSetup(connectionId);
    } else {
      await this.send(connectionId, "Invalid choice. Please select from the options.");
    }
  }

  // -----------------------------------------------------------------------
  // Contextual menu
  // -----------------------------------------------------------------------

  private async buildMenu(connectionId: string): Promise<ContextualMenu> {
    const inFlow = this.store.isInFlow(connectionId);

    if (inFlow) {
      return {
        title: "Avatar Issuer",
        description: "Flow in progress",
        options: [{ id: "abort", title: "Abort current flow" }],
      };
    }

    const authenticated = await this.db.isAuthenticated(connectionId);
    const hasAuth = await this.db.hasAuthMethods(connectionId);

    const options: ContextualMenuEntry[] = [];

    // First slot: auth/setup/logout
    if (authenticated) {
      options.push({ id: "logout", title: "Logout" });
    } else if (hasAuth) {
      options.push({ id: "auth", title: "Authenticate" });
    } else {
      options.push({ id: "setup", title: "Setup Authentication" });
    }

    options.push({ id: "new_avatar", title: "New Avatar" });
    options.push({ id: "restore", title: "Restore Avatar(s)" });
    options.push({ id: "list", title: "List Avatars" });

    if (authenticated) {
      options.push({ id: "password", title: "Password Setup" });
      options.push({ id: "authenticator", title: "Authenticator Setup" });
    }

    options.push({ id: "help", title: "Help" });

    return {
      title: "Avatar Issuer",
      description: authenticated ? "Authenticated" : "Not Authenticated",
      options,
    };
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async cmdUsage(connectionId: string): Promise<void> {
    const authenticated = await this.db.isAuthenticated(connectionId);
    const hasAuth = await this.db.hasAuthMethods(connectionId);

    const lines: string[] = ["Available commands:"];
    lines.push("/new — Create a new avatar");
    lines.push("/list — List your avatars");
    lines.push("/issue <name> — Reissue credential for an avatar");
    lines.push("/delete — Delete an avatar");
    lines.push("/restore — Restore avatar(s) from another account");

    if (!hasAuth) {
      lines.push("/setup — Set up authentication");
    } else if (!authenticated) {
      lines.push("/auth — Authenticate");
    } else {
      lines.push("/password — Set or change password");
      lines.push("/authenticator — Set up authenticator app");
      lines.push("/logout — Log out");
    }

    lines.push("/abort — Cancel current operation");
    lines.push("/usage — Show this help");

    await this.send(connectionId, lines.join("\n"));
  }

  private async send(connectionId: string, text: string): Promise<void> {
    await this.client.sendMessage({
      connectionId,
      content: text,
      contextualMenu: await this.buildMenu(connectionId),
    });
  }

  private verifyTotp(secret: string, token: string): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: "Avatar Issuer",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token, window: 1 });
    return delta !== null;
  }
}
