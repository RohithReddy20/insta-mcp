const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");

async function getOAuthURL() {
  console.log("Getting Instagram OAuth URL...");

  try {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["../server/build/index.js"],
      env: process.env,
    });

    const client = new Client({
      name: "oauth-test",
      version: "1.0.0",
    });

    console.log("Connecting to server...");
    await client.connect(transport);

    console.log("Calling instagram-auth tool...");
    const result = await client.callTool("instagram-auth", {
      redirectUri: "https://localhost:6001/auth/callback/instagram-standalone",
    });

    console.log("\n=== OAUTH URL RESULT ===");
    console.log(result.content[0].text);
    console.log("========================\n");

    await transport.close();
    console.log("Done!");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

getOAuthURL();
