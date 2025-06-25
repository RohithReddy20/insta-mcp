import fetch, { Response } from "node-fetch";
import * as fs from "fs";
import * as path from "path";

// Based on instagram.service.ts
const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

// Error types and handler (simplified for direct use in tool)
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

function handleInstagramError(
  error: any,
  response?: Response
): InstagramApiError {
  if (error instanceof InstagramApiError) return error;
  if (error.error && typeof error.error === "object") {
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
export interface InstagramPostReelInput {
  videoUrl: string;
  coverUrl?: string;
  caption?: string;
  shareToFeed?: boolean;
}

// Define the interface for the tool output
export interface InstagramPostReelOutput {
  postId: string;
  status: string;
}

interface MediaContainerResponse {
  id: string;
}
interface PublishResponse {
  id: string;
}
interface MediaContainerStatusResponse {
  status_code: string;
  id: string;
}

async function checkContainerStatus(
  accessToken: string,
  containerId: string
): Promise<MediaContainerStatusResponse> {
  const url = `${GRAPH_API_BASE_URL}/${containerId}?fields=status_code&access_token=${accessToken}`;
  const response = await fetch(url);
  const responseData = await response.json();
  if (!response.ok) {
    throw handleInstagramError(responseData, response);
  }
  return responseData as MediaContainerStatusResponse;
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  maxWaitTimeMs: number = 60000, // 60 seconds
  pollIntervalMs: number = 3000 // 3 seconds
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTimeMs) {
    try {
      const statusResult = await checkContainerStatus(accessToken, containerId);
      if (statusResult.status_code === "FINISHED") return true;
      if (
        statusResult.status_code === "ERROR" ||
        statusResult.status_code === "EXPIRED"
      ) {
        throw new InstagramApiError(
          `Reel container processing failed or expired. Status: ${statusResult.status_code}`,
          InstagramErrorType.INVALID_REQUEST
        );
      }
      // status_code === "IN_PROGRESS" or others, continue polling
    } catch (error) {
      // If checkContainerStatus itself throws (e.g. network), or if it's a definitive container error.
      if (
        error instanceof InstagramApiError &&
        error.type !== InstagramErrorType.NETWORK_ERROR
      ) {
        // Don't stop polling for transient network errors
        throw error;
      }
      console.error("Polling error, will retry:", error); // Log transient errors
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new InstagramApiError(
    "Reel container processing timed out.",
    InstagramErrorType.UNKNOWN_ERROR
  );
}

export async function postReelToInstagram(
  input: InstagramPostReelInput
): Promise<InstagramPostReelOutput> {
  const { videoUrl, coverUrl, caption, shareToFeed } = input;
  const userDataPath = path.resolve(process.cwd(), "../user.json");
  const userDataRaw = fs.readFileSync(userDataPath, "utf-8");
  const userData = JSON.parse(userDataRaw);
  const { id: igUserId, accessToken: userAccessToken } = userData;

  if (!igUserId || !userAccessToken) {
    throw new InstagramApiError(
      "The user.json file must contain 'id' and 'accessToken' properties.",
      InstagramErrorType.INVALID_REQUEST
    );
  }

  try {
    // Step 1: Create media container for the Reel video
    const containerParams = new URLSearchParams({
      media_type: "REELS",
      video_url: videoUrl,
      access_token: userAccessToken,
    });

    if (caption) containerParams.append("caption", caption);
    if (coverUrl) containerParams.append("cover_url", coverUrl);
    if (typeof shareToFeed === "boolean")
      containerParams.append("share_to_feed", String(shareToFeed));

    const containerUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media`;
    let response = await fetch(containerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerParams.toString(),
    });
    let responseData = await response.json();

    if (!response.ok) {
      throw handleInstagramError(responseData, response);
    }
    const { id: containerId } = responseData as MediaContainerResponse;
    if (!containerId)
      throw new InstagramApiError(
        "Reel media container ID not found.",
        InstagramErrorType.UNKNOWN_ERROR
      );

    // Step 2: Wait for video processing to complete
    const isReady = await waitForContainerReady(userAccessToken, containerId);
    if (!isReady) {
      // Should be caught by timeout in waitForContainerReady, but as a safeguard
      throw new InstagramApiError(
        "Reel processing timed out after container creation.",
        InstagramErrorType.UNKNOWN_ERROR
      );
    }

    // Step 3: Publish the container
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: userAccessToken,
    });

    const publishUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media_publish`;
    response = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishParams.toString(),
    });
    responseData = await response.json();

    if (!response.ok) {
      throw handleInstagramError(responseData, response);
    }
    const { id: mediaId } = responseData as PublishResponse;
    if (!mediaId)
      throw new InstagramApiError(
        "Post ID not found in Reel publish response.",
        InstagramErrorType.UNKNOWN_ERROR
      );

    return {
      postId: mediaId,
      status: "Reel posted successfully",
    };
  } catch (error) {
    throw handleInstagramError(error);
  }
}
