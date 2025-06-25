import dotenv from "dotenv";
import express from "express";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getInstagramAuthUrl } from "./tools/instagramAuth.js";
import { postImageToInstagram } from "./tools/instagramPostImage.js";
import { postCarouselToInstagram } from "./tools/instagramPostCarousel.js";
import { postReelToInstagram } from "./tools/instagramPostReel.js";

// Enhanced logging utility
function logError(context: string, error: any) {
  console.error(`[ERROR] ${context}:`, {
    message: error.message,
    stack: error.stack,
    type: error.type || "Unknown",
    statusCode: error.statusCode,
    fbTraceId: error.fbTraceId,
    originalError: error.originalError,
  });
}

function logInfo(context: string, data: any) {
  console.error(`[INFO] ${context}:`, data);
}

function logDebug(context: string, data: any) {
  console.error(`[DEBUG] ${context}:`, data);
}

// Load environment variables from .env.local
// Try multiple paths: current directory, server directory, and parent directory
const envPaths = [
  ".env.local",
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "server/.env.local"),
  path.resolve(process.cwd(), "../server/.env.local"),
  path.resolve(process.cwd(), "../.env.local"),
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (result.parsed && !result.error) {
      envLoaded = true;
      break;
    }
  } catch (error) {
    // Continue to next path
  }
}

if (!envLoaded) {
  console.warn("Warning: Could not load .env.local from any expected location");
}

const app = express();
const port = process.env.PORT || 3000;

// Create MCP server instance
const server = new Server(
  {
    name: "instagram-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "instagram-auth",
        description: "Generates an Instagram OAuth URL for authentication.",
        inputSchema: {
          type: "object",
          properties: {
            redirectUri: {
              type: "string",
              format: "uri",
              description:
                "The redirect URI for OAuth callback (optional, defaults to localhost:6001)",
            },
          },
        },
      },
      {
        name: "instagram-post-image",
        description: "Posts an image to Instagram.",
        inputSchema: {
          type: "object",
          properties: {
            imageUrl: {
              type: "string",
              format: "uri",
              description:
                "The public URL of the image to post (must be JPEG and HTTPS).",
            },
            caption: {
              type: "string",
              description: "The caption for the image post.",
            },
          },
          required: ["imageUrl"],
        },
      },
      {
        name: "instagram-post-carousel",
        description: "Posts a carousel of images/videos to Instagram.",
        inputSchema: {
          type: "object",
          properties: {
            mediaItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: ["IMAGE", "VIDEO"],
                    description: "Type of media: IMAGE or VIDEO.",
                  },
                  url: {
                    type: "string",
                    format: "uri",
                    description:
                      "Public URL of the image or video (HTTPS required for images, must be JPEG).",
                  },
                },
                required: ["type", "url"],
              },
              minItems: 2,
              maxItems: 10,
              description:
                "Array of media items (2-10 items). IMPORTANT: For videos, ensure they meet Instagram's specifications.",
            },
            caption: {
              type: "string",
              description: "The caption for the carousel post.",
            },
          },
          required: ["mediaItems"],
        },
      },
      {
        name: "instagram-post-reel",
        description: "Posts a Reel to Instagram.",
        inputSchema: {
          type: "object",
          properties: {
            videoUrl: {
              type: "string",
              format: "uri",
              description: "Public URL of the video to post as a Reel.",
            },
            coverUrl: {
              type: "string",
              format: "uri",
              description:
                "Public URL of the cover image for the Reel. If not provided, Instagram will use the first frame.",
            },
            caption: {
              type: "string",
              description: "The caption for the Reel.",
            },
            shareToFeed: {
              type: "boolean",
              description:
                "Whether to also share the Reel to the main feed (default: true if not specified by IG). Check API docs for current default behavior if not explicitly set.",
            },
          },
          required: ["videoUrl"],
        },
      },
    ],
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logInfo("Tool Request", { tool: name, args });

  try {
    switch (name) {
      case "instagram-auth": {
        logDebug("Instagram Auth", "Processing auth request");
        const { redirectUri } = (args as any) || {};
        const result = getInstagramAuthUrl({
          redirectUri:
            (redirectUri as string) ||
            "https://localhost:6001/auth/callback/instagram-standalone",
        });

        logInfo("Instagram Auth Success", { state: result.state });
        return {
          content: [
            {
              type: "text",
              text: `Instagram OAuth URL: ${result.oauthUrl}. State: ${result.state}`,
            },
          ],
        };
      }

      case "instagram-post-image": {
        logDebug("Instagram Post Image", "Starting image post process");
        const { imageUrl, caption } = args as any;

        logInfo("Image Post Request", {
          imageUrl: imageUrl?.substring(0, 100) + "...",
          captionLength: caption?.length || 0,
        });

        const result = await postImageToInstagram({
          imageUrl,
          caption,
        });

        logInfo("Image Post Success", { postId: result.postId });
        return {
          content: [
            {
              type: "text",
              text: `Image posted successfully! Post ID: ${result.postId}`,
            },
          ],
        };
      }

      case "instagram-post-carousel": {
        logDebug("Instagram Post Carousel", "Starting carousel post process");
        const { mediaItems, caption } = args as any;

        logInfo("Carousel Post Request", {
          mediaCount: mediaItems?.length || 0,
          captionLength: caption?.length || 0,
        });

        const result = await postCarouselToInstagram({
          mediaItems,
          caption,
        });

        logInfo("Carousel Post Success", { postId: result.postId });
        return {
          content: [
            {
              type: "text",
              text: `Carousel posted successfully! Post ID: ${result.postId}`,
            },
          ],
        };
      }

      case "instagram-post-reel": {
        logDebug("Instagram Post Reel", "Starting reel post process");
        const { videoUrl, coverUrl, caption, shareToFeed } = args as any;

        logInfo("Reel Post Request", {
          hasVideo: !!videoUrl,
          hasCover: !!coverUrl,
          captionLength: caption?.length || 0,
          shareToFeed,
        });

        const result = await postReelToInstagram({
          videoUrl,
          caption,
          coverUrl,
          shareToFeed,
        });

        logInfo("Reel Post Success", { postId: result.postId });
        return {
          content: [
            {
              type: "text",
              text: `Reel posted successfully! Post ID: ${result.postId}`,
            },
          ],
        };
      }

      default:
        logError("Unknown Tool", `Tool not found: ${name}`);
        throw new Error(`Tool not found: ${name}`);
    }
  } catch (error: any) {
    logError(`Tool Execution (${name})`, error);

    // Return detailed error information
    const errorMessage = error.message || "Unknown error occurred";
    const errorType = error.type || "UNKNOWN_ERROR";
    const statusCode = error.statusCode;
    const fbTraceId = error.fbTraceId;

    let detailedError = `Error: ${errorMessage}`;
    if (errorType !== "UNKNOWN_ERROR") {
      detailedError += ` (Type: ${errorType})`;
    }
    if (statusCode) {
      detailedError += ` (Status: ${statusCode})`;
    }
    if (fbTraceId) {
      detailedError += ` (Trace ID: ${fbTraceId})`;
    }

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: detailedError,
        },
      ],
    };
  }
});

app.get("/", (req, res) => {
  res.send("MCP Instagram Server is running!");
});

async function main() {
  // Connect MCP server to StdioTransport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo("MCP Server", "Instagram MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
