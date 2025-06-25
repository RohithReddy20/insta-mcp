require("dotenv").config({
  path: require("path").resolve(__dirname, "..", ".env"),
});

const https = require("https");
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Path to the JSON file for storing the single user's data in the project root
const USER_FILE = path.join(__dirname, "..", "..", "user.json");

// Instagram OAuth callback handler
app.get("/auth/callback/instagram-standalone", async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      console.error("Authorization code not provided in callback.", {
        query: req.query,
      });
      return res.status(400).json({ error: "Authorization code not provided" });
    }

    console.log("Received Instagram OAuth callback with code:", code);
    console.log("State:", state);

    // Authenticate and get user details
    const userDetails = await authenticate({
      code: code,
      codeVerifier: "", // Not using PKCE in this example
    });

    if (typeof userDetails === "string") {
      return res.status(400).json({ error: userDetails });
    }

    // Write the single user's details to user.json in the root folder, overwriting the file
    try {
      fs.writeFileSync(USER_FILE, JSON.stringify(userDetails, null, 2), "utf8");
      console.log(`User details successfully saved to ${USER_FILE}`);
    } catch (error) {
      console.error(`Error writing to ${USER_FILE}:`, error);
      // Decide if we should fail the request if the file can't be written
      // For now, we'll log the error and continue
    }

    console.log("User authenticated successfully:", {
      id: userDetails.id,
      username: userDetails.username,
      name: userDetails.name,
    });

    // Return success response
    res.json({
      success: true,
      message: "Authentication successful and user data saved.",
      user: {
        id: userDetails.id,
        username: userDetails.username,
        name: userDetails.name,
        picture: userDetails.picture,
      },
    });
  } catch (error) {
    console.error("Error during Instagram authentication:", error);
    res.status(500).json({
      error: "Authentication failed",
      details: error.message,
    });
  }
});

// Instagram authentication function (adapted from your provided code)
async function authenticate(params, clientInformation, frontendUrl) {
  // Using the exact implementation provided by the user. My apologies for the previous errors.
  const formData = new FormData();
  formData.append("client_id", process.env.INSTAGRAM_APP_ID);
  formData.append("client_secret", process.env.INSTAGRAM_APP_SECRET);
  formData.append("grant_type", "authorization_code");

  const redirectUri =
    "https://localhost:6001/auth/callback/instagram-standalone";
  formData.append("redirect_uri", redirectUri);
  formData.append("code", params.code);

  console.log("\n--- STEP 1: Exchanging code for access token ---");
  console.log(" > Request URL: https://api.instagram.com/oauth/access_token");
  console.log(" > Request Body (FormData):", {
    client_id: process.env.INSTAGRAM_APP_ID,
    client_secret: "********",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: params.code,
  });

  const getAccessTokenResponse = await fetch(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      body: formData,
    }
  );

  const getAccessTokenText = await getAccessTokenResponse.text();
  console.log(" > Response Status:", getAccessTokenResponse.status);
  console.log(" > Response Body:", getAccessTokenText);

  if (!getAccessTokenResponse.ok) {
    throw new Error(
      `Instagram API Error during token exchange: ${getAccessTokenText}`
    );
  }
  let getAccessToken;
  try {
    getAccessToken = JSON.parse(getAccessTokenText);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from token exchange response: ${getAccessTokenText}`
    );
  }

  if (getAccessToken.error) {
    throw new Error(
      `Instagram API Error: ${
        getAccessToken.error.message ||
        getAccessToken.error_description ||
        JSON.stringify(getAccessToken)
      }`
    );
  }

  console.log(" > Short-lived token received successfully.");

  console.log(
    "\n--- STEP 2: Exchanging short-lived token for long-lived token ---"
  );

  const longLivedTokenUrl = new URL("https://graph.instagram.com/access_token");
  longLivedTokenUrl.searchParams.append("grant_type", "ig_exchange_token");
  longLivedTokenUrl.searchParams.append(
    "client_id",
    process.env.INSTAGRAM_APP_ID
  );
  longLivedTokenUrl.searchParams.append(
    "client_secret",
    process.env.INSTAGRAM_APP_SECRET
  );
  longLivedTokenUrl.searchParams.append(
    "access_token",
    getAccessToken.access_token
  );

  console.log(" > Request URL:", longLivedTokenUrl.toString());

  const longLivedTokenResponse = await fetch(longLivedTokenUrl.toString());
  const longLivedTokenText = await longLivedTokenResponse.text();
  console.log(" > Response Status:", longLivedTokenResponse.status);
  console.log(" > Response Body:", longLivedTokenText);

  let longLivedTokenData;
  try {
    longLivedTokenData = JSON.parse(longLivedTokenText);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from long-lived token response: ${longLivedTokenText}`
    );
  }

  if (longLivedTokenData.error) {
    throw new Error(
      `Failed to exchange for long-lived token: ${longLivedTokenData.error.message}`
    );
  }
  const { access_token } = longLivedTokenData;
  if (!access_token) {
    throw new Error("Failed to get long-lived access token");
  }

  console.log(" > Long-lived token received successfully.");

  console.log("\n--- STEP 3: Fetching user profile ---");

  const userProfileUrl = new URL("https://graph.instagram.com/v21.0/me");
  userProfileUrl.searchParams.append(
    "fields",
    "user_id,username,name,profile_picture_url"
  );
  userProfileUrl.searchParams.append("access_token", access_token);

  console.log(" > Request URL:", userProfileUrl.toString());

  const userProfileResponse = await fetch(userProfileUrl.toString());
  const userProfileText = await userProfileResponse.text();
  console.log(" > Response Status:", userProfileResponse.status);
  console.log(" > Response Body:", userProfileText);

  let userProfile;
  try {
    userProfile = JSON.parse(userProfileText);
  } catch (e) {
    throw new Error(
      `Failed to parse JSON from user profile response: ${userProfileText}`
    );
  }

  if (userProfile.error) {
    throw new Error(
      `Failed to fetch user profile: ${userProfile.error.message}`
    );
  }

  const { user_id, name, username, profile_picture_url } = userProfile;
  console.log(" > User profile fetched successfully:", {
    user_id,
    name,
    username,
  });

  return {
    id: user_id,
    name,
    accessToken: access_token,
    refreshToken: access_token,
    expiresIn:
      longLivedTokenData.expires_in ||
      dayjs().add(59, "days").unix() - dayjs().unix(),
    picture: profile_picture_url,
    username,
  };
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Create HTTPS server
const PORT = 6001;

// Check if certificates exist
if (
  !fs.existsSync(path.join(__dirname, "..", "server.key")) ||
  !fs.existsSync(path.join(__dirname, "..", "server.cert"))
) {
  console.error(
    "SSL certificates not found in instagram-auth-server/. Please generate them using:"
  );
  console.error("cd instagram-auth-server && npm run generate-certs");
  process.exit(1);
}

const options = {
  key: fs.readFileSync(path.join(__dirname, "..", "server.key")),
  cert: fs.readFileSync(path.join(__dirname, "..", "server.cert")),
};

https.createServer(options, app).listen(PORT, () => {
  console.log(
    `🚀 Instagram Auth HTTPS Server running on https://localhost:${PORT}`
  );
  console.log(
    `📋 Callback URL: https://localhost:${PORT}/auth/callback/instagram-standalone`
  );
  console.log(`💾 Saving user data to: ${USER_FILE}`);
  console.log("📊 Endpoints available:");
  console.log(`   - GET /health - Health check`);
  console.log("");
  console.log("⚠️  Make sure to set these environment variables:");
  console.log("   - INSTAGRAM_APP_ID", process.env.INSTAGRAM_APP_ID);
  console.log("   - INSTAGRAM_APP_SECRET", process.env.INSTAGRAM_APP_SECRET);
});
