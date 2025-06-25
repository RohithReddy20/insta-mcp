import fetch, { Response } from "node-fetch"; // Assuming node-fetch for making HTTP requests in Node.js
import * as fs from "fs";
import * as path from "path";

// Based on instagram.service.ts
const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Enhanced logging utility
function logError(context: string, error: any) {
  console.error(`[ERROR] InstagramPostImage - ${context}:`, {
    message: error.message,
    stack: error.stack,
    type: error.type || "Unknown",
    statusCode: error.statusCode,
    fbTraceId: error.fbTraceId,
    originalError: error.originalError,
  });
}

function logInfo(context: string, data: any) {
  console.error(`[INFO] InstagramPostImage - ${context}:`, data);
}

function logDebug(context: string, data: any) {
  console.error(`[DEBUG] InstagramPostImage - ${context}:`, data);
}

// Error types and handler (simplified for direct use in tool, full version in service.ts)
enum InstagramErrorType {
  EXPIRED_TOKEN = "EXPIRED_TOKEN",
  INVALID_TOKEN = "INVALID_TOKEN",
  INSUFFICIENT_SCOPE = "INSUFFICIENT_SCOPE",
  RATE_LIMIT = "RATE_LIMIT",
  INVALID_REQUEST = "INVALID_REQUEST",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

class InstagramApiError extends Error {
  constructor(
    message: string,
    public type: InstagramErrorType,
    public statusCode?: number,
    public fbTraceId?: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "InstagramApiError";
  }
}

// Simplified error handler for use within this tool
// In a real scenario, this might be imported from a shared service module
function handleInstagramError(
  error: any,
  response?: Response
): InstagramApiError {
  if (error instanceof InstagramApiError) {
    return error;
  }
  if (error.error && typeof error.error === "object") {
    // Likely an Instagram API error structure
    const igError = error.error;
    let errorType = InstagramErrorType.INVALID_REQUEST;
    if (igError.code === 190) errorType = InstagramErrorType.EXPIRED_TOKEN;
    else if (igError.code === 100 || igError.code === 200)
      errorType = InstagramErrorType.INSUFFICIENT_SCOPE;
    else if (igError.code === 4 || igError.code === 17)
      errorType = InstagramErrorType.RATE_LIMIT;
    return new InstagramApiError(
      igError.message || "Instagram API error",
      errorType,
      igError.code,
      igError.fbtrace_id,
      error
    );
  }
  if (response && !response.ok) {
    return new InstagramApiError(
      error.message || `HTTP error ${response.status}`,
      InstagramErrorType.NETWORK_ERROR,
      response.status,
      undefined,
      error
    );
  }
  return new InstagramApiError(
    error.message || "Unknown error",
    InstagramErrorType.UNKNOWN_ERROR,
    undefined,
    undefined,
    error
  );
}

// Define the interface for the tool input
export interface InstagramPostImageInput {
  imageUrl: string;
  caption?: string;
}

// Define the interface for the tool output
export interface InstagramPostImageOutput {
  postId: string;
  status: string;
}

// Re-implementing based on the provided instagram.service.ts structure

async function validateImageUrlForTool(imageUrl: string): Promise<void> {
  logDebug(
    "Image Validation",
    `Validating URL: ${imageUrl.substring(0, 100)}...`
  );

  if (!imageUrl.startsWith("https://")) {
    logError("Image Validation", "Image URL must use HTTPS");
    throw new InstagramApiError(
      "Image URL must use HTTPS",
      InstagramErrorType.INVALID_REQUEST
    );
  }
  try {
    logDebug("Image Validation", "Checking image accessibility");
    const response = await fetch(imageUrl, { method: "HEAD" });
    logDebug("Image Validation", `Response status: ${response.status}`);

    if (!response.ok) {
      logError(
        "Image Validation",
        `Image URL not accessible: ${response.status}`
      );
      throw new InstagramApiError(
        `Image URL not accessible: ${response.status}`,
        InstagramErrorType.INVALID_REQUEST
      );
    }
    const contentType = response.headers.get("content-type");
    logDebug("Image Validation", `Content type: ${contentType}`);

    if (
      !contentType ||
      (!contentType.includes("image/jpeg") &&
        !contentType.includes("image/jpg"))
    ) {
      logError("Image Validation", `Invalid content type: ${contentType}`);
      throw new InstagramApiError(
        "Image must be in JPEG format",
        InstagramErrorType.INVALID_REQUEST
      );
    }
    logInfo("Image Validation", "Image validation successful");
  } catch (error) {
    if (error instanceof InstagramApiError) throw error;
    logError("Image Validation", error);
    throw handleInstagramError(error, undefined);
  }
}

interface MediaContainerResponse {
  id: string;
}
interface PublishResponse {
  id: string;
}

export async function postImageToInstagram(
  input: InstagramPostImageInput
): Promise<InstagramPostImageOutput> {
  const { imageUrl, caption } = input;

  logInfo("Post Start", {
    imageUrl: imageUrl.substring(0, 100) + "...",
    hasCaption: !!caption,
  });

  try {
    logDebug("User Data", "Loading user.json file");
    const userDataPath = path.resolve(process.cwd(), "../user.json");
    const userDataRaw = fs.readFileSync(userDataPath, "utf-8");
    const userData = JSON.parse(userDataRaw);
    const { id: igUserId, accessToken: userAccessToken } = userData;

    logDebug("User Data", {
      hasUserId: !!igUserId,
      hasAccessToken: !!userAccessToken,
      userIdLength: igUserId?.length || 0,
      tokenLength: userAccessToken?.length || 0,
    });

    if (!igUserId || !userAccessToken) {
      logError("User Data", "Missing user ID or access token");
      throw new InstagramApiError(
        "The user.json file must contain 'id' and 'accessToken' properties.",
        InstagramErrorType.INVALID_REQUEST
      );
    }

    // Step 1: Validate image URL (from instagram.service.ts)
    logInfo("Step 1", "Starting image validation");
    await validateImageUrlForTool(imageUrl);

    // Step 2: Create media container
    logInfo("Step 2", "Creating media container");
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      access_token: userAccessToken,
    });
    if (caption) {
      containerParams.append("caption", caption);
      logDebug("Step 2", `Added caption: ${caption.substring(0, 50)}...`);
    }

    const containerUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media`;
    logDebug("Step 2", `Container URL: ${containerUrl}`);
    logDebug(
      "Step 2",
      `Container params: ${containerParams.toString().substring(0, 200)}...`
    );

    let response = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerParams.toString(),
    });

    logDebug(
      "Step 2",
      `Container response status: ${response.status} ${response.statusText}`
    );
    let responseData = await response.json();
    logDebug(
      "Step 2",
      `Container response data: ${JSON.stringify(responseData)}`
    );

    if (!response.ok) {
      logError("Step 2", "Failed to create media container");
      throw handleInstagramError(responseData, response);
    }
    const { id: containerId } = responseData as MediaContainerResponse;
    if (!containerId) {
      logError("Step 2", "Container ID not found in response");
      throw new InstagramApiError(
        "Media container ID not found in response.",
        InstagramErrorType.UNKNOWN_ERROR
      );
    }
    logInfo("Step 2", `Media container created successfully: ${containerId}`);

    // Step 3: Publish container
    logInfo("Step 3", "Publishing media container");
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: userAccessToken,
    });

    const publishUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media_publish`;
    logDebug("Step 3", `Publish URL: ${publishUrl}`);
    logDebug("Step 3", `Publish params: ${publishParams.toString()}`);

    response = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishParams.toString(),
    });

    logDebug(
      "Step 3",
      `Publish response status: ${response.status} ${response.statusText}`
    );
    responseData = await response.json();
    logDebug(
      "Step 3",
      `Publish response data: ${JSON.stringify(responseData)}`
    );

    if (!response.ok) {
      logError("Step 3", "Failed to publish media");
      throw handleInstagramError(responseData, response);
    }
    const { id: mediaId } = responseData as PublishResponse;
    if (!mediaId) {
      logError("Step 3", "Media ID not found in response");
      throw new InstagramApiError(
        "Post ID not found in publish response.",
        InstagramErrorType.UNKNOWN_ERROR
      );
    }

    logInfo("Post Success", `Image posted successfully with ID: ${mediaId}`);
    return {
      postId: mediaId,
      status: "Image posted successfully",
    };
  } catch (error) {
    logError("Post Failed", error);
    throw handleInstagramError(error, undefined);
  }
}
