# Issuer chatbot spec

## Avatar Persistence

We need a database to persist avatars (name only). We want to link avatar name to connectionId. additionally, we want to make sure that avatars are unique.

## Connection and Avatars

Avatars are associated to an account table. Account has a connectionId, password, and authenticator field

When a user connects, if this connectionId is new (not present in account table), it is created.

We want to add several option for protecting an avatar so that user can recover the avatar by using one of the methods below when they lose the connection to the service, reconnect, and their connectionId changes.

Protection is not mandatory: if a new connectionId creates an account row, user can create avatar and obtain credentials. It is responsibility of user to protects its avatars.

Methods that we want to enable:

- password: user protects the avatar with a password (persisted as a hash in the database)
- authenticator app

When users wants to recover, they will need to specify an avatar name and enter one of the recovery methods. If they pass the recovery, account connectionId of the account table is set to the new connectionId: that automatically restore all avatars for the new connection.

Note that for the account table, connectionId is unique. If user restores, and for the current connectionId there exists already an entry in the table, account entries must be merged (restored avatars must point to the current connectionId, and when all avatars are migrated, old account entry deleted). In this case, the configuration of the recovery methods is from the new connection. Older recovery method configuration is deleted by account entry deletion.

## Chatbot

### Commands

Here are the possible commands / flow and their behavior:

/abort: abort current flow.
/list: list my avatars. List avatars linked to this connectionId.
/new: flow - creates a new avatar. Request name of the avatar, verify it doesn't already exist, and that its size matches the schema minLength and maxLength. Persist the avatar in db, associate to the account with this connectionId and if no error, issue the credential.
/delete: flow - delete an avatar with its name. User executing this action must do it through the connectionId (account) currently associated to the avatar (owner of the avatar), else abort.
/issue <name>: reissue credential of a given avatar. <name> must be an avatar controlled by this connectionId.
/restore: flow - used to restore user avatars. Flow requests an avatar name, and then propose to the user enabled recovery methods by sending a question message. If no recovery method is available, send a message explaining recovery is not possible. User chooses one of the available recovery method and user is challenged. If he/she passes the challenge, then all avatars linked to the old account entry (of the old connectionId) are updated for the new (current) account entry of the connected user, and the list of avatars (like with /list) is returned. Else, show an error message.
/auth: flow - authenticate. Send a menu message to user with enabled authentication methods. User authenticate with one of the methods. When user is authenticated, he/she can change it password with /password or reconfigure the authenticator with /authenticator. Persist authentication timestamp (general) and individually (password and authenticator). No auth timeout.
/password: flow - setup or change password. If a password and/or an authenticator configuration already exists for this connectionId, user must authenticated first (see /auth). After this step, request password, confirmation, and if match, save it to the account table.
/authenticator: flow - setup an authenticator app (otp). If a password and/or an authenticator configuration already exists for this connectionId, user must be authenticated first (see /auth). After this step, request authenticator code, confirm validating an otp, and if match, save it to the account table.
/setup: flow - can be used only if current connectionId has no authentication method configured in account row. Offer 2 options to user: Restore Avatar(s), New Account. If user selects Restore Avatar(s), execute the /restore flow. Else, ask the user which authentication ,method they want to use. They can choose between Password or Authenticator. Execute the corresponding flow.
/logout: set current connectionId as not authenticated.

### Contextual Menu

- Title: Avatar Issuer
- Description: Authenticated / Not Authenticated
- Items:
  - show one of the following options: Authenticate (if not authenticated and an authentication method is configured) => /auth , Setup (if not authenticated and no authentication method is configured for this connectionId) => /setup, Logout (if authenticated) => /logout
  - New Avatar => /new
  - Restore Avatar(s) => /restore
  - List Avatars => /list
  - Password Setup (only if user is authenticated) => /password
  - Authenticator Setup (only if user is authenticated) => /authenticator

When a flow is currently in execution, menu item changes to:

- Items:
  - Abort current flow => /abort

> Note: because of a bug of Hologram, full menu must be sent to user after each message sent to user.