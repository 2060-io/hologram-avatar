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
/new: flow - creates a new avatar. The flow proceeds as follows:

  1. **Request name**: Ask user for the avatar name. Validate it starts with `@`, contains no other `@` characters, doesn't already exist, and its length matches the schema minLength+1 and maxLength.
  2. **Confirm name**: Send a `menu-display` question: `Avatar name: <name>. Confirm?` with two items: `Yes` and `No`. If `No`, go back to step 1 (request name again). If `Yes`, proceed.
  3. **Request avatar image**: Send a text message asking the user to send an image for their avatar (preferably squared, minimum 128×128). Along with this, send a `menu-display` question: `Or you can skip` with a single item: `Skip`. The user can either:
     - **Send an image** (received as a `media` message with `mimeType` = `image/*`): The chatbot downloads the image, crops it to a square (intelligent center crop) and resizes it to at most 512×512. The processed image is sent back to the user as a `media` message, followed by a `menu-display` question: `Confirm this avatar?` with items `Yes` / `No`. If `Yes`, issue the credential with the `avatar` attribute set to a base64 data URI (e.g. `data:image/png;base64,<base64>`). If `No`, go back to step 3 (request image again).
     - **Select `Skip`**: Issue the credential with the `avatar` attribute set to `""` (empty string).
  4. **Persist and issue**: Persist the avatar in db, associate to the account with this connectionId and if no error, issue the credential.
/delete: flow - delete an avatar with its name. User executing this action must do it through the connectionId (account) currently associated to the avatar (owner of the avatar), else abort.
/issue <name>: reissue credential of a given avatar. <name> must be an avatar controlled by this connectionId. Since the avatar image is not persisted in the database, the flow re-prompts for an avatar image (same as `/new` step 3: request image, process, confirm, or skip). The credential is then reissued with the new image or `""` if skipped.
/restore: flow - used to restore user avatars. Flow requests an avatar name, and then propose to the user enabled recovery methods by sending a question message. If no recovery method is available, send a message explaining recovery is not possible. User chooses one of the available recovery method and user is challenged. If he/she passes the challenge, then all avatars linked to the old account entry (of the old connectionId) are updated for the new (current) account entry of the connected user, and the list of avatars (like with /list) is returned. Else, show an error message.
/auth: flow - authenticate. Send a menu message to user with enabled authentication methods. User authenticate with one of the methods. When user is authenticated, he/she can change it password with /password or reconfigure the authenticator with /authenticator. Persist authentication timestamp (general) and individually (password and authenticator). No auth timeout.
/password: flow - setup or change password. If a password and/or an authenticator configuration already exists for this connectionId, user must authenticated first (see /auth). After this step, request password, confirmation, and if match, save it to the account table.
/authenticator: flow - setup an authenticator app (otp). If a password and/or an authenticator configuration already exists for this connectionId, user must be authenticated first (see /auth). After this step, request authenticator code, confirm validating an otp, and if match, save it to the account table.
/setup: flow - can be used only if current connectionId has no authentication method configured in account row. Offer 2 options to user: Restore Avatar(s), New Account. If user selects Restore Avatar(s), execute the /restore flow. if New Account, /config_auth.
/config_auth: flow - ask the user which authentication method they want to use. They can choose between Password or Authenticator. Execute the corresponding flow.
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

## Media Storage (MinIO)

### Problem

During the `/new` flow (step 3), the chatbot needs to send a processed avatar image back to the user as a `media` message. The VS Agent `media` message type requires a `uri` field pointing to a URL that the Hologram mobile app can download from. This means the processed image must be hosted at a **publicly accessible URL**.

The chatbot itself has no public-facing HTTP endpoint — it only communicates with the VS Agent via its internal admin API. A dedicated object storage is needed to temporarily host processed images.

### Solution: MinIO sidecar

Deploy [MinIO](https://min.io/) as a **sidecar container** in the existing avatar StatefulSet. MinIO provides S3-compatible object storage with native support for bucket lifecycle policies (automatic object expiration).

#### Architecture

```
┌─ StatefulSet: avatar ──────────────────────────┐
│                                                            │
│  ┌─────────────┐   admin API   ┌──────────────────────┐   │
│  │  VS Agent   │ ◄──────────── │  Issuer Chatbot      │   │
│  │  (port 3001)│               │  (internal only)      │   │
│  └─────────────┘               │                        │   │
│                                │  S3 PUT ──►┌─────────┐│   │
│                                │            │  MinIO   ││   │
│                                │            │ (port    ││   │
│                                │            │  9000)   ││   │
│                                └────────────┴─────────┘│   │
│                                                            │
└────────────────────────────────────────────────────────────┘
         │ public ingress                │ public ingress
         ▼                               ▼
  avatar.              media.avatar.
  vs.hologram.zone            vs.hologram.zone
```

#### Bucket and lifecycle

- **Bucket**: `avatar-previews`
- **Lifecycle rule**: expire (delete) all objects after **24 hours**
- The bucket does **not** need to be publicly readable — access is granted via **presigned URLs**

#### Presigned URLs

When the chatbot uploads a processed image to MinIO, it generates a **presigned GET URL** with a 24-hour TTL. This URL:

- Is self-contained (signature embedded as query parameters)
- Requires no authentication headers to download
- Expires automatically after 24h
- Points to the MinIO public ingress (`media.avatar.vs.hologram.zone`)

Combined with the lifecycle policy, objects are both inaccessible (expired URL) and deleted (lifecycle) after 24h.

#### Image processing flow

1. User sends an image → VS Agent receives `media` message → webhook to chatbot with media item containing `uri`, `mimeType`, `ciphering`
2. Chatbot **downloads** the image from the `uri` (internal VS Agent media relay URL)
3. Chatbot **processes** the image using `sharp`:
   - Center-crop to square (min dimension)
   - Resize to at most 512×512
   - Output as PNG
4. Chatbot **uploads** the processed PNG to MinIO bucket `avatar-previews` with a UUID filename (e.g. `<uuid>.png`)
5. Chatbot **generates a presigned GET URL** (24h TTL) via the MinIO S3 client
6. Chatbot **sends** a `media` message to the user with:
   - `uri`: the presigned URL
   - `mimeType`: `image/png`
   - `width` / `height`: actual dimensions after processing
7. Chatbot sends a `menu-display` question: `Confirm this avatar? Yes / No`
8. If user confirms → encode the processed image as `data:image/png;base64,<base64>` for the credential `avatar` attribute

#### Configuration (environment variables)

| Variable | Description | Example |
|---|---|---|
| `MINIO_ENDPOINT` | Internal MinIO host:port | `localhost:9000` (sidecar) |
| `MINIO_ACCESS_KEY` | MinIO root user | from K8s Secret |
| `MINIO_SECRET_KEY` | MinIO root password | from K8s Secret |
| `MINIO_BUCKET` | Bucket name | `avatar-previews` |
| `MINIO_PUBLIC_URL` | Public base URL for presigned URLs | `https://media.avatar.vs.hologram.zone` |
| `MINIO_USE_SSL` | Use SSL for internal connection | `false` (sidecar on localhost) |

#### Deployment additions

- **Sidecar container** in the StatefulSet: `minio/minio` image, minimal resources (64Mi–128Mi RAM)
- **PVC or emptyDir**: since objects are ephemeral (24h), an `emptyDir` volume is sufficient. If persistence across pod restarts is desired, a small PVC (e.g. 1Gi) can be used
- **Ingress**: `media.avatar.vs.hologram.zone` → MinIO port 9000, with TLS
- **K8s Secret**: `avatar-minio-secret` containing `MINIO_ACCESS_KEY` and `MINIO_SECRET_KEY`
- **Init or startup**: on chatbot startup, ensure the bucket exists and the lifecycle policy (24h expiry) is applied via the S3 API

#### Dependencies

- Node.js: `minio` npm package (S3-compatible client)
- Node.js: `sharp` npm package (image processing — crop, resize)