import { z } from "zod";
import { makeId } from "../utils/makeId"; // Assuming makeId is moved to a utils directory

// Define the schema for the tool input
export const instagramAuthInputSchema = z.object({
  redirectUri: z
    .string()
    .url()
    .describe("The redirect URI for OAuth callback."),
  // state: z.string().optional().describe("An opaque value used to maintain state between the request and callback.") // State will be generated internally
});

// Define the schema for the tool output
export const instagramAuthOutputSchema = z.object({
  oauthUrl: z
    .string()
    .url()
    .describe("The Instagram OAuth URL for authentication."),
  state: z.string().describe("The state parameter used in the OAuth URL."),
  // codeVerifier: z.string().optional().describe("PKCE code verifier, if used by client for added security."), // Not strictly needed from standalone provider example for this tool's output
});

// Function to generate Instagram OAuth URL based on instagram-standalone.provider.ts
export function getInstagramAuthUrl(
  input: z.infer<typeof instagramAuthInputSchema>
): z.infer<typeof instagramAuthOutputSchema> {
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
