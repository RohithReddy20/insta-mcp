"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instagramPostImageOutputSchema = exports.instagramPostImageInputSchema = void 0;
exports.postImageToInstagram = postImageToInstagram;
const zod_1 = require("zod");
const node_fetch_1 = __importDefault(require("node-fetch")); // Assuming node-fetch for making HTTP requests in Node.js
// Based on instagram.service.ts
const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
// Error types and handler (simplified for direct use in tool, full version in service.ts)
var InstagramErrorType;
(function (InstagramErrorType) {
    InstagramErrorType["EXPIRED_TOKEN"] = "EXPIRED_TOKEN";
    InstagramErrorType["INVALID_TOKEN"] = "INVALID_TOKEN";
    InstagramErrorType["INSUFFICIENT_SCOPE"] = "INSUFFICIENT_SCOPE";
    InstagramErrorType["RATE_LIMIT"] = "RATE_LIMIT";
    InstagramErrorType["INVALID_REQUEST"] = "INVALID_REQUEST";
    InstagramErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    InstagramErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(InstagramErrorType || (InstagramErrorType = {}));
class InstagramApiError extends Error {
    type;
    statusCode;
    fbTraceId;
    originalError;
    constructor(message, type, statusCode, fbTraceId, originalError) {
        super(message);
        this.type = type;
        this.statusCode = statusCode;
        this.fbTraceId = fbTraceId;
        this.originalError = originalError;
        this.name = "InstagramApiError";
    }
}
// Simplified error handler for use within this tool
// In a real scenario, this might be imported from a shared service module
function handleInstagramError(error, response) {
    if (error instanceof InstagramApiError) {
        return error;
    }
    if (error.error && typeof error.error === "object") {
        // Likely an Instagram API error structure
        const igError = error.error;
        let errorType = InstagramErrorType.INVALID_REQUEST;
        if (igError.code === 190)
            errorType = InstagramErrorType.EXPIRED_TOKEN;
        else if (igError.code === 100 || igError.code === 200)
            errorType = InstagramErrorType.INSUFFICIENT_SCOPE;
        else if (igError.code === 4 || igError.code === 17)
            errorType = InstagramErrorType.RATE_LIMIT;
        return new InstagramApiError(igError.message || "Instagram API error", errorType, igError.code, igError.fbtrace_id, error);
    }
    if (response && !response.ok) {
        return new InstagramApiError(error.message || `HTTP error ${response.status}`, InstagramErrorType.NETWORK_ERROR, response.status, undefined, error);
    }
    return new InstagramApiError(error.message || "Unknown error", InstagramErrorType.UNKNOWN_ERROR, undefined, undefined, error);
}
// Define the schema for the tool input
exports.instagramPostImageInputSchema = zod_1.z.object({
    igUserId: zod_1.z
        .string()
        .describe("The Instagram User ID of the account to post to."),
    imageUrl: zod_1.z
        .string()
        .url()
        .describe("The public URL of the image to post (must be JPEG and HTTPS)."),
    caption: zod_1.z.string().optional().describe("The caption for the image post."),
    userAccessToken: zod_1.z
        .string()
        .describe("The access token of the Instagram user."),
});
// Define the schema for the tool output
exports.instagramPostImageOutputSchema = zod_1.z.object({
    postId: zod_1.z.string().describe("The ID of the created Instagram post."),
    status: zod_1.z.string().describe("Status of the post creation"),
});
// Re-implementing based on the provided instagram.service.ts structure
async function validateImageUrlForTool(imageUrl) {
    if (!imageUrl.startsWith("https://")) {
        throw new InstagramApiError("Image URL must use HTTPS", InstagramErrorType.INVALID_REQUEST);
    }
    try {
        const response = await (0, node_fetch_1.default)(imageUrl, { method: "HEAD" });
        if (!response.ok) {
            throw new InstagramApiError(`Image URL not accessible: ${response.status}`, InstagramErrorType.INVALID_REQUEST);
        }
        const contentType = response.headers.get("content-type");
        if (!contentType ||
            (!contentType.includes("image/jpeg") &&
                !contentType.includes("image/jpg"))) {
            throw new InstagramApiError("Image must be in JPEG format", InstagramErrorType.INVALID_REQUEST);
        }
    }
    catch (error) {
        if (error instanceof InstagramApiError)
            throw error;
        throw handleInstagramError(error);
    }
}
async function postImageToInstagram(input) {
    const { igUserId, imageUrl, caption, userAccessToken } = input;
    try {
        // Step 1: Validate image URL (from instagram.service.ts)
        await validateImageUrlForTool(imageUrl);
        // Step 2: Create media container
        const containerParams = new URLSearchParams({
            image_url: imageUrl,
            access_token: userAccessToken,
        });
        if (caption) {
            containerParams.append("caption", caption);
        }
        const containerUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media`;
        let response = await (0, node_fetch_1.default)(containerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: containerParams.toString(),
        });
        let responseData = await response.json();
        if (!response.ok) {
            throw handleInstagramError(responseData, response);
        }
        const { id: containerId } = responseData;
        if (!containerId)
            throw new InstagramApiError("Media container ID not found in response.", InstagramErrorType.UNKNOWN_ERROR);
        // Step 3: Publish container
        const publishParams = new URLSearchParams({
            creation_id: containerId,
            access_token: userAccessToken,
        });
        const publishUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media_publish`;
        response = await (0, node_fetch_1.default)(publishUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: publishParams.toString(),
        });
        responseData = await response.json();
        if (!response.ok) {
            throw handleInstagramError(responseData, response);
        }
        const { id: mediaId } = responseData;
        if (!mediaId)
            throw new InstagramApiError("Post ID not found in publish response.", InstagramErrorType.UNKNOWN_ERROR);
        return { postId: mediaId, status: "Image posted successfully." };
    }
    catch (error) {
        // The MCP server's tool handler should catch this and format it for the LLM
        if (error instanceof InstagramApiError)
            throw error;
        throw handleInstagramError(error);
    }
}
