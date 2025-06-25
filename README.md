# MCP Instagram Client & Server

This project provides a Model Context Protocol (MCP) server for Instagram posting capabilities and a client to interact with it using natural language queries powered by OpenAI's GPT-4.

## Project Structure

```
insta-mcp-client/
├── server/                    # MCP Server (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Main server file
│   │   ├── tools/            # Instagram API tools
│   │   │   ├── instagramAuth.ts
│   │   │   ├── instagramPostImage.ts
│   │   │   ├── instagramPostCarousel.ts
│   │   │   └── instagramPostReel.ts
│   │   └── utils/
│   │       └── makeId.ts
│   ├── build/                # Compiled JavaScript files
│   ├── package.json
│   └── tsconfig.json
├── mcp-insta/                # MCP Client (JavaScript)
│   ├── client.js             # Main client file
│   └── package.json
├── instagram-auth-server/    # Instagram OAuth server
└── user.json               # User credentials file
```

## Prerequisites

- Node.js (v20+)
- npm
- OpenAI API key
- Instagram App credentials

## Setup Instructions

### 1. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../mcp-insta
npm install
```

### 2. Environment Configuration

Create environment files with your credentials:

#### Server Environment (.env.local in server/)

```bash
INSTAGRAM_APP_ID=your_instagram_app_id
PORT=3000
```

#### Client Environment (.env in mcp-insta/)

```bash
OPENAI_API_KEY=your_openai_api_key
```

### 3. User Credentials

Create/update `user.json` in the project root with your Instagram credentials:

```json
{
  "id": "your_instagram_user_id",
  "accessToken": "your_instagram_access_token"
}
```

**Note**: You can obtain these credentials using the Instagram auth server or Instagram's Graph API authentication flow.

### 4. Build the Server

```bash
cd server
npm run build
```

This compiles the TypeScript code to JavaScript in the `build/` directory.

## Running the Application

### Method 1: Using Built Files (Recommended)

1. **Start the MCP Client** (which connects to the server):

```bash
cd mcp-insta
node client.js ../server/build/index.js
```

### Method 2: Using TypeScript Directly (Development)

1. **Start the MCP Client** with TypeScript:

```bash
cd mcp-insta
node client.js ../server/src/index.ts
```

## Available Tools

The MCP server provides the following Instagram tools:

1. **instagram-auth** - Generate Instagram OAuth URL for authentication
2. **instagram-post-image** - Post a single image to Instagram
3. **instagram-post-carousel** - Post a carousel (2-10 images/videos) to Instagram
4. **instagram-post-reel** - Post a Reel video to Instagram

## Usage Examples

Once the client is running, you can interact with it using natural language:

```
Query: Generate an Instagram auth URL for redirect URI https://example.com/callback

Query: Post this image to Instagram: https://example.com/image.jpg with caption "Hello World!"

Query: Create a carousel post with these images: https://example.com/img1.jpg, https://example.com/img2.jpg

Query: Post a reel with this video: https://example.com/video.mp4

Query: quit
```

## Development Workflow

1. **Make changes** to TypeScript source files in `server/src/`
2. **Rebuild** the server: `cd server && npm run build`
3. **Test** with the client: `cd mcp-insta && node client.js ../server/build/index.js`

## Troubleshooting

### Common Issues

1. **Port 3000 already in use**: The server includes an optional Express server. If you get port conflicts, kill processes on port 3000:

   ```bash
   lsof -ti:3000 | xargs kill -9
   ```

2. **File watcher limit reached**: If using `npm start` (nodemon), you might hit system file watcher limits. Use the built files instead.

3. **Module not found errors**: Ensure all dependencies are installed and you're using the correct file paths.

4. **OpenAI API errors**: Check your OpenAI API key and ensure you have access to GPT-4.

### Environment Variables

| Variable           | Location          | Description                 |
| ------------------ | ----------------- | --------------------------- |
| `INSTAGRAM_APP_ID` | server/.env.local | Your Instagram App ID       |
| `PORT`             | server/.env.local | Server port (default: 3000) |
| `OPENAI_API_KEY`   | mcp-insta/.env    | OpenAI API key for GPT-4    |

### File Requirements

- **user.json**: Must contain valid Instagram user ID and access token
- **Image URLs**: Must be HTTPS and JPEG format
- **Video URLs**: Must meet Instagram's specifications for Reels

## Architecture

- **MCP Server**: Provides Instagram API tools via stdio communication
- **MCP Client**: Connects to server and uses OpenAI GPT-4 to process natural language queries
- **Communication**: Uses Model Context Protocol over stdio transport
- **Authentication**: Instagram credentials stored in user.json file

## License

[Add your license information here]

## Contributing

[Add contributing guidelines here]
