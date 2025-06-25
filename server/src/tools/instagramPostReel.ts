import { z } from "zod";
import fetch, { Response } from "node-fetch";

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

// Define the schema for the tool input
export const instagramPostReelInputSchema = z.object({
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
});

// Define the schema for the tool output
export const instagramPostReelOutputSchema = z.object({
  postId: z.string().describe("The ID of the created Instagram Reel post."),
  status: z.string().describe("Status of the Reel post creation"),
});

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
  input: z.infer<typeof instagramPostReelInputSchema>
): Promise<z.infer<typeof instagramPostReelOutputSchema>> {
  const {
    igUserId,
    videoUrl,
    coverUrl,
    caption,
    userAccessToken,
    shareToFeed,
  } = input;

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

    return { postId: mediaId, status: "Reel posted successfully." };
  } catch (error: any) {
    if (error instanceof InstagramApiError) throw error;
    throw handleInstagramError(error);
  }
}
