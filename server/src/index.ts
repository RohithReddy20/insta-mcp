import dotenv from "dotenv";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
mcpServer.registerTool(
  "instagram-auth",
  {
    title: "Instagram Authentication",
    description: "Generates an Instagram OAuth URL for authentication.",
    inputSchema: {
      redirectUri: z
        .string()
        .url()
        .describe("The redirect URI for OAuth callback."),
    },
  },
  async ({ redirectUri }: { redirectUri: string }) => {
    try {
      const result = getInstagramAuthUrl({ redirectUri });
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
mcpServer.registerTool(
  "instagram-post-image",
  {
    title: "Post Image to Instagram",
    description: "Posts an image to Instagram.",
    inputSchema: {
      igUserId: z
        .string()
        .describe("The Instagram User ID of the account to post to."),
      imageUrl: z
        .string()
        .url()
        .describe(
          "The public URL of the image to post (must be JPEG and HTTPS)."
        ),
      caption: z
        .string()
        .optional()
        .describe("The caption for the image post."),
      userAccessToken: z
        .string()
        .describe("The access token of the Instagram user."),
    },
  },
  async ({
    igUserId,
    imageUrl,
    caption,
    userAccessToken,
  }: {
    igUserId: string;
    imageUrl: string;
    caption?: string;
    userAccessToken: string;
  }) => {
    try {
      const result = await postImageToInstagram({
        igUserId,
        imageUrl,
        caption,
        userAccessToken,
      });
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
mcpServer.registerTool(
  "instagram-post-carousel",
  {
    title: "Post Carousel to Instagram",
    description: "Posts a carousel of images/videos to Instagram.",
    inputSchema: {
      igUserId: z
        .string()
        .describe("The Instagram User ID of the account to post to."),
      mediaItems: z
        .array(
          z.object({
            type: z
              .enum(["IMAGE", "VIDEO"])
              .describe("Type of media: IMAGE or VIDEO."),
            url: z
              .string()
              .url()
              .describe(
                "Public URL of the image or video (HTTPS required for images, must be JPEG)."
              ),
          })
        )
        .min(2)
        .max(10)
        .describe(
          "Array of media items (2-10 items). IMPORTANT: For videos, ensure they meet Instagram's specifications."
        ),
      caption: z
        .string()
        .optional()
        .describe("The caption for the carousel post."),
      userAccessToken: z
        .string()
        .describe("The access token of the Instagram user."),
    },
  },
  async ({
    igUserId,
    userAccessToken,
    mediaItems,
    caption,
  }: {
    igUserId: string;
    userAccessToken: string;
    mediaItems: Array<{ type: "IMAGE" | "VIDEO"; url: string }>;
    caption?: string;
  }) => {
    try {
      const result = await postCarouselToInstagram({
        igUserId,
        userAccessToken,
        mediaItems,
        caption,
      });
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
mcpServer.registerTool(
  "instagram-post-reel",
  {
    title: "Post Reel to Instagram",
    description: "Posts a Reel to Instagram.",
    inputSchema: {
      igUserId: z
        .string()
        .describe("The Instagram User ID of the account to post to."),
      videoUrl: z
        .string()
        .url()
        .describe("Public URL of the video to post as a Reel."),
      coverUrl: z
        .string()
        .url()
        .optional()
        .describe(
          "Public URL of the cover image for the Reel. If not provided, Instagram will use the first frame."
        ),
      caption: z.string().optional().describe("The caption for the Reel."),
      userAccessToken: z
        .string()
        .describe("The access token of the Instagram user."),
      shareToFeed: z
        .boolean()
        .optional()
        .describe(
          "Whether to also share the Reel to the main feed (default: true if not specified by IG). Check API docs for current default behavior if not explicitly set."
        ),
    },
  },
  async ({
    igUserId,
    userAccessToken,
    videoUrl,
    caption,
    coverUrl,
    shareToFeed,
  }: {
    igUserId: string;
    userAccessToken: string;
    videoUrl: string;
    caption?: string;
    coverUrl?: string;
    shareToFeed?: boolean;
  }) => {
    try {
      const result = await postReelToInstagram({
        igUserId,
        userAccessToken,
        videoUrl,
        caption,
        coverUrl,
        shareToFeed,
      });
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
