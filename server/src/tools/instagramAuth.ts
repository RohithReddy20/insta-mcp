import { makeId } from "../utils/makeId.js"; // Assuming makeId is moved to a utils directory

// Define the interface for the tool input
export interface InstagramAuthInput {
  redirectUri: string;
}

// Define the interface for the tool output
export interface InstagramAuthOutput {
  oauthUrl: string;
  state: string;
}

// Function to generate Instagram OAuth URL based on instagram-standalone.provider.ts
export function getInstagramAuthUrl(
  input: InstagramAuthInput
): InstagramAuthOutput {
  const { redirectUri } = input;
  const appId = process.env.INSTAGRAM_APP_ID;

  if (!appId) {
    // This error should be caught by the MCP server and returned as a structured error
    throw new Error(
      "Instagram App ID (INSTAGRAM_APP_ID) is not configured in environment variables."
    );
  }

  const state = makeId(6); // As per instagram-standalone.provider.ts
  const scopesArray = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_insights",
  ];
  const scopes = scopesArray.join(",");

  const oauthUrl =
    `https://www.instagram.com/oauth/authorize?enable_fb_login=0&client_id=${appId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`;

  return { oauthUrl, state };
}
