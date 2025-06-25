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

// Define the interface for individual media items in the carousel
export interface CarouselMediaItem {
  type: "IMAGE" | "VIDEO";
  url: string;
}

// Define the interface for the tool input
export interface InstagramPostCarouselInput {
  mediaItems: CarouselMediaItem[];
  caption?: string;
}

// Define the interface for the tool output
export interface InstagramPostCarouselOutput {
  postId: string;
  status: string;
}

interface MediaContainerResponse {
  id: string;
}
interface PublishResponse {
  id: string;
}

// Function to post a carousel to Instagram, adapted from instagram.service.ts
export async function postCarouselToInstagram(
  input: InstagramPostCarouselInput
): Promise<InstagramPostCarouselOutput> {
  const { mediaItems, caption } = input;
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

  if (mediaItems.length < 2 || mediaItems.length > 10) {
    throw new InstagramApiError(
      "Carousel must have between 2 and 10 media items.",
      InstagramErrorType.INVALID_REQUEST
    );
  }

  // Note: instagram.service.ts implies IMAGE and VIDEO types are handled for carousel items.
  // It's crucial that videos also adhere to Instagram's specs (duration, aspect ratio, etc.)
  // This tool, like the service, assumes valid media URLs are provided.
  // Image validation (like in postImage) could be added here for each image item if necessary.

  try {
    const itemContainerIds: string[] = [];

    // Step 1: Create individual media containers for each item
    for (const item of mediaItems) {
      const itemContainerParams = new URLSearchParams({
        [item.type === "IMAGE" ? "image_url" : "video_url"]: item.url,
        is_carousel_item: "true", // Important for carousel children
        access_token: userAccessToken,
      });
      // If item.type is VIDEO, the Instagram API might also require media_type=VIDEO
      // The provided service.ts code snippet for carousel does not explicitly add it for children,
      // but it's a common requirement. Assuming graph.instagram.com handles it based on *_url.
      // If not, `itemContainerParams.append('media_type', 'VIDEO');` would be needed for videos.

      const itemContainerUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media`;
      const itemResponse = await fetch(itemContainerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: itemContainerParams.toString(),
      });
      const itemResponseData = await itemResponse.json();

      if (!itemResponse.ok) {
        throw handleInstagramError(itemResponseData, itemResponse);
      }
      const { id: childContainerId } =
        itemResponseData as MediaContainerResponse;
      if (!childContainerId)
        throw new InstagramApiError(
          `Media container ID not found for item ${item.url}.`,
          InstagramErrorType.UNKNOWN_ERROR
        );
      itemContainerIds.push(childContainerId);

      // Polling for video children might be needed here if they are processed asynchronously
      // The provided service code for carousel doesn't show polling for children,
      // but it's a common pattern for videos. For simplicity here, we'll assume they are ready quickly
      // or that the main carousel container creation waits for them.
    }

    // Step 2: Create parent carousel container
    const carouselContainerParams = new URLSearchParams({
      media_type: "CAROUSEL",
      children: itemContainerIds.join(","),
      access_token: userAccessToken,
    });
    if (caption) {
      carouselContainerParams.append("caption", caption);
    }

    const carouselContainerUrl = `${GRAPH_API_BASE_URL}/${igUserId}/media`;
    let response = await fetch(carouselContainerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: carouselContainerParams.toString(),
    });
    let responseData = await response.json();

    if (!response.ok) {
      throw handleInstagramError(responseData, response);
    }
    const { id: mainContainerId } = responseData as MediaContainerResponse;
    if (!mainContainerId)
      throw new InstagramApiError(
        "Main carousel container ID not found.",
        InstagramErrorType.UNKNOWN_ERROR
      );

    // Step 3: Publish the carousel container
    const publishParams = new URLSearchParams({
      creation_id: mainContainerId,
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
        "Carousel post ID not found in publish response.",
        InstagramErrorType.UNKNOWN_ERROR
      );

    return {
      postId: mediaId,
      status: "Carousel posted successfully",
    };
  } catch (error) {
    throw handleInstagramError(error);
  }
}
