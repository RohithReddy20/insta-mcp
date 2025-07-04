# MCP Instagram Server

This project implements an MCP (Model Context Protocol) server for interacting with Instagram. It allows AI models and other MCP clients to perform actions like generating authentication URLs and posting media (images, carousels, Reels) to Instagram.

## Features

The server exposes the following MCP tools:

1.  **`instagram-auth`**:

    - **Description**: Generates an Instagram OAuth URL for user authentication.
    - **Input**:
      - `redirectUri` (string, URL): The URI where the user will be redirected after successful authentication on Instagram.
    - **Output**:
      - `oauthUrl` (string, URL): The generated Instagram OAuth URL.
      - `state` (string): An opaque value used to maintain state between the request and callback (generated by the server).
    - **Note**: This tool uses the Instagram App ID configured in the server's environment variables (`INSTAGRAM_APP_ID`). The authentication flow is based on the Instagram Basic Display API or standalone app model.

2.  **`instagram-post-image`**:

    - **Description**: Posts a single image to an Instagram account.
    - **Input**:
      - `igUserId` (string): The Instagram User ID of the account to post to.
      - `imageUrl` (string, URL): The publicly accessible URL of the image to post. Must be HTTPS and JPEG format.
      - `caption` (string, optional): The caption for the image.
      - `userAccessToken` (string): The valid access token for the Instagram user.
    - **Output**:
      - `postId` (string): The ID of the created Instagram post.
      - `status` (string): A message indicating the outcome (e.g., "Image posted successfully.").
    - **API Used**: `https://graph.instagram.com/v19.0`

3.  **`instagram-post-carousel`**:

    - **Description**: Posts a carousel of multiple images/videos to an Instagram account.
    - **Input**:
      - `igUserId` (string): The Instagram User ID.
      - `mediaItems` (array): An array of 2-10 media items. Each item has:
        - `type` ("IMAGE" | "VIDEO"): The type of media.
        - `url` (string, URL): Publicly accessible URL for the media. Images must be JPEG and HTTPS. Videos must meet Instagram specifications.
      - `caption` (string, optional): The caption for the carousel.
      - `userAccessToken` (string): The user's access token.
    - **Output**:
      - `postId` (string): The ID of the created carousel post.
      - `status` (string): Success or failure message.
    - **API Used**: `https://graph.instagram.com/v19.0`

4.  **`instagram-post-reel`**:
    - **Description**: Posts a Reel to an Instagram account.
    - **Input**:
      - `igUserId` (string): The Instagram User ID.
      - `videoUrl` (string, URL): Publicly accessible URL of the video for the Reel.
      - `coverUrl` (string, URL, optional): Publicly accessible URL for the Reel's cover image.
      - `caption` (string, optional): The caption for the Reel.
      - `userAccessToken` (string): The user's access token.
      - `shareToFeed` (boolean, optional): Whether to also share the Reel to the main feed.
    - **Output**:
      - `postId` (string): The ID of the created Reel.
      - `status` (string): Success or failure message.
    - **API Used**: `https://graph.instagram.com/v19.0` (involves polling for video processing).

## Setup

1.  **Prerequisites**:

    - Node.js (v16 or higher recommended)
    - npm

2.  **Clone the repository (if applicable)**

    ```bash
    # git clone <repository-url>
    # cd mcp-instagram-server
    ```

3.  **Install Dependencies**:

    ```bash
    npm install
    ```

4.  **Environment Variables**:
    Create a `.env.local` file in the root of the project with your Instagram App credentials:

    ```env
    INSTAGRAM_APP_ID=YOUR_INSTAGRAM_APP_ID
    # INSTAGRAM_APP_SECRET=YOUR_INSTAGRAM_APP_SECRET (if needed by your auth callback server)

    # Optional: Port for the auxiliary HTTP server
    # PORT=3000
    ```

    Replace `YOUR_INSTAGRAM_APP_ID` with your actual Instagram App ID. The scopes used for authentication are:
    `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`. Ensure your app has these permissions.

    **Note on Authentication Flow**:
    The `instagram-auth` tool generates an OAuth URL for the Instagram standalone flow. The client application using this MCP server is responsible for:

    1.  Directing the user to the `oauthUrl`.
    2.  Handling the redirect from Instagram to the specified `redirectUri`.
    3.  Exchanging the authorization `code` (and potentially `code_verifier` if using PKCE) for an access token by calling Instagram's token endpoint. This step typically requires your `INSTAGRAM_APP_SECRET`.
    4.  Retrieving the `igUserId` (Instagram User ID) associated with the access token. This is often returned as part of the token exchange or by querying the `/me` endpoint.
    5.  Securely storing the `userAccessToken` and `igUserId` to be used with the posting tools.

## Running the Server

- **Development Mode (with Nodemon for auto-restarts):**
  ```bash
  npm start
  ```
- **Build for Production:**
  ```bash
  npm run build
  ```
- **Run Production Build:**
  ```bash
  npm run serve
  ```
  This will start the MCP server, typically listening on `stdio` for communication with an MCP client (like Claude Desktop). It also starts a basic Express HTTP server (default port 3000, or as specified by `PORT` env var) which currently just serves a confirmation message at `/`.

## Connecting to an MCP Client (e.g., Claude Desktop)

To use this server with an MCP client like Claude Desktop, you'll need to configure the client to launch this server. The command will typically be `node path/to/your/project/dist/index.js` or `npm run serve` from the project directory.

Example for Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "command": "node",
      "args": ["/absoulte/path/to/mcp-instagram-server/dist/index.js"],
      // Ensure .env.local is in the CWD where the command is run or manage env vars differently
      "cwd": "/absoulte/path/to/mcp-instagram-server/"
    }
  }
}
```

Make sure the `cwd` (current working directory) is set correctly if your server relies on `.env.local` in its root. Alternatively, manage environment variables through the client's configuration if supported.

## Code Structure

- `src/index.ts`: Main entry point, MCP server setup, tool registration, and basic Express server.
- `src/tools/`: Contains the logic for each MCP tool.
  - `instagramAuth.ts`: Generates Instagram OAuth URL.
  - `instagramPostImage.ts`: Handles single image posting.
  - `instagramPostCarousel.ts`: Handles carousel posting.
  - `instagramPostReel.ts`: Handles Reel posting.
- `src/utils/`: Utility functions (e.g., `makeId.ts`).
- `.env.local`: For storing environment variables (ignored by Git).
- `package.json`: Project dependencies and scripts.
- `tsconfig.json`: TypeScript configuration.
- `README.md`: This file.

## Error Handling

The tools are designed to catch errors from the Instagram API or internal validation and return them in a structured MCP error format:

```json
{
  "isError": true,
  "content": [{ "type": "text", "text": "Error message details" }]
}
```

This allows the MCP client or LLM to understand that an error occurred.

## Future Improvements / Considerations

- **Resumable Uploads for Reels**: For very large video files, implementing Instagram's resumable upload protocol would make Reel posting more robust.
- **More Granular Error Typing**: The `InstagramApiError` class in each tool file could be expanded or centralized for more specific error type handling if needed.
- **Advanced Instagram Features**: Support for tagging users, adding location, music for Reels/Stories, etc.
- **Unit Tests**: Currently skipped due to environment issues, but crucial for robust development.
- **Managing Multiple Accounts**: The current tools require an `igUserId`. A more advanced setup might involve tools to list available Instagram accounts associated with an access token.
