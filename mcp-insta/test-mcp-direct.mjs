import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

async function testMCPAuth() {
  console.log("Testing MCP Auth Tool directly...");

  try {
    // Set environment variable for the server
    process.env.INSTAGRAM_APP_ID = "1441498837282246";

    const serverParams = {
      command: "node",
      args: ["../server/build/index.js"],
      env: process.env,
    };

    const transport = new StdioClientTransport(serverParams);
    const session = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    console.log("Connecting to server...");
    await session.connect(transport);

    console.log("Listing tools...");
    const response = await session.listTools();
    console.log(
      "Available tools:",
      response.tools.map((t) => t.name)
    );

    // Test the auth tool with empty arguments
    console.log("Calling instagram-auth tool with empty args...");
    const result = await session.callTool("instagram-auth", {});
    console.log("Tool result:", result);

    // Test the auth tool with a redirect URI
    console.log("Calling instagram-auth tool with redirect URI...");
    const result2 = await session.callTool("instagram-auth", {
      redirectUri: "https://example.com/callback",
    });
    console.log("Tool result with redirect URI:", result2);

    await transport.close();
    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error:", error);
  }
}

testMCPAuth();
