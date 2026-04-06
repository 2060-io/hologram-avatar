/**
 * In-memory flow state for each connection.
 * Persistent data lives in Db (accounts + avatars).
 * This module only tracks the *current interactive flow* per connection.
 */

export enum FlowType {
  NONE = "NONE",
  NEW_AVATAR = "NEW_AVATAR",
  DELETE_AVATAR = "DELETE_AVATAR",
  ISSUE = "ISSUE",
  RESTORE = "RESTORE",
  AUTH = "AUTH",
  PASSWORD = "PASSWORD",
  AUTHENTICATOR = "AUTHENTICATOR",
  SETUP = "SETUP",
  CONFIG_AUTH = "CONFIG_AUTH",
}

export enum FlowStep {
  // Shared
  IDLE = "IDLE",

  // /new
  NEW_AWAIT_NAME = "NEW_AWAIT_NAME",
  NEW_AWAIT_NAME_CONFIRM = "NEW_AWAIT_NAME_CONFIRM",
  NEW_AWAIT_IMAGE = "NEW_AWAIT_IMAGE",
  NEW_AWAIT_IMAGE_CONFIRM = "NEW_AWAIT_IMAGE_CONFIRM",

  // /delete
  DELETE_AWAIT_NAME = "DELETE_AWAIT_NAME",

  // /issue (takes <name> inline, but might prompt if missing)
  ISSUE_AWAIT_NAME = "ISSUE_AWAIT_NAME",
  ISSUE_AWAIT_IMAGE = "ISSUE_AWAIT_IMAGE",
  ISSUE_AWAIT_IMAGE_CONFIRM = "ISSUE_AWAIT_IMAGE_CONFIRM",

  // /restore
  RESTORE_AWAIT_NAME = "RESTORE_AWAIT_NAME",
  RESTORE_AWAIT_METHOD = "RESTORE_AWAIT_METHOD",
  RESTORE_AWAIT_PASSWORD = "RESTORE_AWAIT_PASSWORD",
  RESTORE_AWAIT_OTP = "RESTORE_AWAIT_OTP",

  // /auth
  AUTH_AWAIT_METHOD = "AUTH_AWAIT_METHOD",
  AUTH_AWAIT_PASSWORD = "AUTH_AWAIT_PASSWORD",
  AUTH_AWAIT_OTP = "AUTH_AWAIT_OTP",

  // /password
  PASSWORD_AWAIT_AUTH = "PASSWORD_AWAIT_AUTH",
  PASSWORD_AWAIT_ENTER = "PASSWORD_AWAIT_ENTER",
  PASSWORD_AWAIT_CONFIRM = "PASSWORD_AWAIT_CONFIRM",

  // /authenticator
  AUTHENTICATOR_AWAIT_AUTH = "AUTHENTICATOR_AWAIT_AUTH",
  AUTHENTICATOR_AWAIT_OTP = "AUTHENTICATOR_AWAIT_OTP",

  // /setup
  SETUP_AWAIT_CHOICE = "SETUP_AWAIT_CHOICE",

  // /config_auth
  CONFIG_AUTH_AWAIT_METHOD = "CONFIG_AUTH_AWAIT_METHOD",
}

export interface FlowState {
  type: FlowType;
  step: FlowStep;
  /** Scratch data for the current flow */
  data: Record<string, string>;
}

export class SessionStore {
  private flows: Map<string, FlowState> = new Map();

  getFlow(connectionId: string): FlowState {
    let flow = this.flows.get(connectionId);
    if (!flow) {
      flow = { type: FlowType.NONE, step: FlowStep.IDLE, data: {} };
      this.flows.set(connectionId, flow);
    }
    return flow;
  }

  setFlow(connectionId: string, type: FlowType, step: FlowStep, data: Record<string, string> = {}): void {
    this.flows.set(connectionId, { type, step, data });
  }

  updateStep(connectionId: string, step: FlowStep, extraData?: Record<string, string>): void {
    const flow = this.getFlow(connectionId);
    flow.step = step;
    if (extraData) {
      Object.assign(flow.data, extraData);
    }
  }

  resetFlow(connectionId: string): void {
    this.flows.set(connectionId, { type: FlowType.NONE, step: FlowStep.IDLE, data: {} });
  }

  isInFlow(connectionId: string): boolean {
    const flow = this.getFlow(connectionId);
    return flow.type !== FlowType.NONE;
  }

  close(): void {
    this.flows.clear();
  }
}
