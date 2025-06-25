"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const instagramAuth_1 = require("./tools/instagramAuth");
const instagramPostImage_1 = require("./tools/instagramPostImage");
const instagramPostCarousel_1 = require("./tools/instagramPostCarousel");
const instagramPostReel_1 = require("./tools/instagramPostReel");
// Load environment variables from .env.local
dotenv_1.default.config({ path: ".env.local" });
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// Create MCP server instance
const mcpServer = new mcp_js_1.McpServer({
    name: "instagram-server",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Register Instagram Authentication Tool
mcpServer.registerTool("instagram-auth", {
    title: "Instagram Authentication",
    description: "Generates an Instagram OAuth URL for authentication.",
    inputSchema: {
        redirectUri: zod_1.z
            .string()
            .url()
            .describe("The redirect URI for OAuth callback."),
    },
}, async ({ redirectUri }) => {
    try {
        const result = (0, instagramAuth_1.getInstagramAuthUrl)({ redirectUri });
        return {
            content: [
                {
                    type: "text",
                    text: `Instagram OAuth URL: ${result.oauthUrl}. State: ${result.state}`,
                },
            ],
            output: result,
        };
    }
    catch (error) {
        return {
            isError: true,
            content: [
                { type: "text", text: `Error generating auth URL: ${error.message}` },
            ],
        };
    }
});
// Register Post Image Tool
mcpServer.registerTool("instagram-post-image", {
    title: "Post Image to Instagram",
    description: "Posts an image to Instagram.",
    inputSchema: {
        igUserId: zod_1.z
            .string()
            .describe("The Instagram User ID of the account to post to."),
        imageUrl: zod_1.z
            .string()
            .url()
            .describe("The public URL of the image to post (must be JPEG and HTTPS)."),
        caption: zod_1.z
            .string()
            .optional()
            .describe("The caption for the image post."),
        userAccessToken: zod_1.z
            .string()
            .describe("The access token of the Instagram user."),
    },
}, async ({ igUserId, imageUrl, caption, userAccessToken, }) => {
    try {
        const result = await (0, instagramPostImage_1.postImageToInstagram)({
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
    }
    catch (error) {
        return {
            isError: true,
            content: [
                { type: "text", text: `Error posting image: ${error.message}` },
            ],
            // output: { errorType: error.type, statusCode: error.statusCode } // Example structured error
        };
    }
});
// Register Post Carousel Tool
mcpServer.registerTool("instagram-post-carousel", {
    title: "Post Carousel to Instagram",
    description: "Posts a carousel of images/videos to Instagram.",
    inputSchema: {
        igUserId: zod_1.z
            .string()
            .describe("The Instagram User ID of the account to post to."),
        mediaItems: zod_1.z
            .array(zod_1.z.object({
            type: zod_1.z
                .enum(["IMAGE", "VIDEO"])
                .describe("Type of media: IMAGE or VIDEO."),
            url: zod_1.z
                .string()
                .url()
                .describe("Public URL of the image or video (HTTPS required for images, must be JPEG)."),
        }))
            .min(2)
            .max(10)
            .describe("Array of media items (2-10 items). IMPORTANT: For videos, ensure they meet Instagram's specifications."),
        caption: zod_1.z
            .string()
            .optional()
            .describe("The caption for the carousel post."),
        userAccessToken: zod_1.z
            .string()
            .describe("The access token of the Instagram user."),
    },
}, async ({ igUserId, userAccessToken, mediaItems, caption, }) => {
    try {
        const result = await (0, instagramPostCarousel_1.postCarouselToInstagram)({
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
    }
    catch (error) {
        return {
            isError: true,
            content: [
                { type: "text", text: `Error posting carousel: ${error.message}` },
            ],
        };
    }
});
// Register Post Reel Tool
mcpServer.registerTool("instagram-post-reel", {
    title: "Post Reel to Instagram",
    description: "Posts a Reel to Instagram.",
    inputSchema: {
        igUserId: zod_1.z
            .string()
            .describe("The Instagram User ID of the account to post to."),
        videoUrl: zod_1.z
            .string()
            .url()
            .describe("Public URL of the video to post as a Reel."),
        coverUrl: zod_1.z
            .string()
            .url()
            .optional()
            .describe("Public URL of the cover image for the Reel. If not provided, Instagram will use the first frame."),
        caption: zod_1.z.string().optional().describe("The caption for the Reel."),
        userAccessToken: zod_1.z
            .string()
            .describe("The access token of the Instagram user."),
        shareToFeed: zod_1.z
            .boolean()
            .optional()
            .describe("Whether to also share the Reel to the main feed (default: true if not specified by IG). Check API docs for current default behavior if not explicitly set."),
    },
}, async ({ igUserId, userAccessToken, videoUrl, caption, coverUrl, shareToFeed, }) => {
    try {
        const result = await (0, instagramPostReel_1.postReelToInstagram)({
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
    }
    catch (error) {
        return {
            isError: true,
            content: [
                { type: "text", text: `Error posting Reel: ${error.message}` },
            ],
        };
    }
});
app.get("/", (req, res) => {
    res.send("MCP Instagram Server is running!");
});
async function main() {
    // Start the Express server (optional, if you need HTTP endpoints)
    app.listen(port, () => {
        console.log(`HTTP server is listening on port ${port}`);
    });
    // Connect MCP server to StdioTransport
    const transport = new stdio_js_1.StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("Instagram MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
