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
  const formData = new FormData();
  formData.append("client_id", process.env.INSTAGRAM_APP_ID);
  formData.append("client_secret", process.env.INSTAGRAM_APP_SECRET);
  formData.append("grant_type", "authorization_code");

  const redirectUri =
    "https://localhost:6001/auth/callback/instagram-standalone";
  formData.append("redirect_uri", redirectUri);
  formData.append("code", params.code);

  console.log("Exchanging code for access token...");

  const getAccessToken = await (
    await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: formData,
    })
  ).json();

  if (getAccessToken.error) {
    throw new Error(
      `Instagram API Error: ${
        getAccessToken.error.message ||
        getAccessToken.error_description ||
        JSON.stringify(getAccessToken)
      }`
    );
  }

  console.log("Short-lived token received, exchanging for long-lived token...");

  const { access_token } = await (
    await fetch(
      "https://graph.instagram.com/access_token" +
        "?grant_type=ig_exchange_token" +
        `&client_id=${process.env.INSTAGRAM_APP_ID}` +
        `&client_secret=${process.env.INSTAGRAM_APP_SECRET}` +
        `&access_token=${getAccessToken.access_token}`
    )
  ).json();

  if (!access_token) {
    throw new Error("Failed to get long-lived access token");
  }

  console.log("Long-lived token received, fetching user profile...");

  const userProfile = await (
    await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url&access_token=${access_token}`
    )
  ).json();

  if (userProfile.error) {
    throw new Error(
      `Failed to fetch user profile: ${userProfile.error.message}`
    );
  }

  const { user_id, name, username, profile_picture_url } = userProfile;

  return {
    id: user_id,
    name,
    accessToken: access_token,
    refreshToken: access_token,
    expiresIn: dayjs().add(59, "days").unix() - dayjs().unix(),
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
  console.log("   - INSTAGRAM_APP_ID");
  console.log("   - INSTAGRAM_APP_SECRET");
});
