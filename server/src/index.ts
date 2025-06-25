import dotenv from "dotenv";
import express from "express";
import {
  McpServer,
  StdioServerTransport,
} from "@modelcontextprotocol/sdk/server";
import { z } from "zod";
import {
  getInstagramAuthUrl,
  instagramAuthInputSchema,
} from "./tools/instagramAuth";
import {
  postImageToInstagram,
  instagramPostImageInputSchema,
} from "./tools/instagramPostImage";
import {
  postCarouselToInstagram,
  instagramPostCarouselInputSchema,
} from "./tools/instagramPostCarousel";
import {
  postReelToInstagram,
  instagramPostReelInputSchema,
} from "./tools/instagramPostReel";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const app = express();
const port = process.env.PORT || 3000;

// Create MCP server instance
const mcpServer = new McpServer({
  name: "instagram-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Register Instagram Authentication Tool
mcpServer.tool(
  "instagram-auth",
  "Generates an Instagram OAuth URL for authentication.",
  instagramAuthInputSchema,
  async (input) => {
    try {
      const result = getInstagramAuthUrl(input);
      return {
        content: [
          {
            type: "text",
            text: `Instagram OAuth URL: ${result.oauthUrl}. State: ${result.state}`,
          },
        ],
        output: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          { type: "text", text: `Error generating auth URL: ${error.message}` },
        ],
      };
    }
  }
);

// Register Post Image Tool
mcpServer.tool(
  "instagram-post-image",
  "Posts an image to Instagram.",
  instagramPostImageInputSchema,
  async (input) => {
    try {
      const result = await postImageToInstagram(input);
      return {
        content: [
          {
            type: "text",
            text: `Image posted successfully! Post ID: ${result.postId}`,
          },
        ],
        output: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          { type: "text", text: `Error posting image: ${error.message}` },
        ],
        // output: { errorType: error.type, statusCode: error.statusCode } // Example structured error
      };
    }
  }
);

// Register Post Carousel Tool
mcpServer.tool(
  "instagram-post-carousel",
  "Posts a carousel of images/videos to Instagram.",
  instagramPostCarouselInputSchema,
  async (input) => {
    try {
      const result = await postCarouselToInstagram(input);
      return {
        content: [
          {
            type: "text",
            text: `Carousel posted successfully! Post ID: ${result.postId}`,
          },
        ],
        output: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          { type: "text", text: `Error posting carousel: ${error.message}` },
        ],
      };
    }
  }
);

// Register Post Reel Tool
mcpServer.tool(
  "instagram-post-reel",
  "Posts a Reel to Instagram.",
  instagramPostReelInputSchema,
  async (input) => {
    try {
      const result = await postReelToInstagram(input);
      return {
        content: [
          {
            type: "text",
            text: `Reel posted successfully! Post ID: ${result.postId}`,
          },
        ],
        output: result,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          { type: "text", text: `Error posting Reel: ${error.message}` },
        ],
      };
    }
  }
);

app.get("/", (req, res) => {
  res.send("MCP Instagram Server is running!");
});

async function main() {
  // Start the Express server (optional, if you need HTTP endpoints)
  app.listen(port, () => {
    console.log(`HTTP server is listening on port ${port}`);
  });

  // Connect MCP server to StdioTransport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("Instagram MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
