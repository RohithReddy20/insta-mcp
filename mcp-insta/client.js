import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fileURLToPath } from "url";
import { z } from "zod";
import dotenv from "dotenv";
import readline from "readline";
import path from "path";
import os from "os";
import OpenAI from "openai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpClient } from "@modelcontextprotocol/sdk/client/mcp.js";
import { Readable, Writable } from "stream";
// Load environment variables from .env
dotenv.config();

class MCPClient {
  constructor() {
    this.session = null;
    this.openai = new OpenAI(); // Assumes OPENAI_API_KEY is set in environment
    this.exitStack = [];
  }

  async connectToServer(serverScriptPath) {
    if (!serverScriptPath.endsWith(".ts")) {
      throw new Error("Server script must be a .ts file");
    }

    const serverParams = {
      command: "node",
      args: ["--loader", "ts-node/esm", serverScriptPath],
      env: process.env,
    };
    const transport = new StdioClientTransport(serverParams);
    await transport.start();

    this.session = new McpClient(transport);
    this.exitStack.push(async () => await transport.stop());

    await this.session.initialize();
    const response = await this.session.listTools();
    const tools = response.tools;
    console.log(
      "\\nConnected to server with tools:",
      tools.map((tool) => tool.name)
    );
  }

  async processQuery(query) {
    const messages = [
      {
        role: "user",
        content: query,
      },
    ];

    const response = await this.session.listTools();
    const availableTools = response.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    // Initial OpenAI API call
    let openAIResponse = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: messages,
      tools: availableTools,
      tool_choice: "auto",
    });

    let responseMessage = openAIResponse.choices[0].message;
    messages.push(responseMessage); // Add assistant's response to messages

    // Process response and handle tool calls
    const final_text = [];

    if (responseMessage.tool_calls) {
      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        // Execute tool call
        final_text.push(
          `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
        );
        const result = await this.session.callTool(toolName, toolArgs);

        const toolResultContent = result.isError
          ? `Error: ${result.content.map((c) => c.text).join("\\n")}`
          : result.content.map((c) => c.text).join("\\n");

        messages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolName,
          content: toolResultContent,
        });
      }

      // Get next response from OpenAI
      const secondResponse = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: messages,
      });

      final_text.push(secondResponse.choices[0].message.content);
    } else {
      final_text.push(responseMessage.content);
    }

    return final_text.join("\\n");
  }

  async chatLoop() {
    console.log("\\nMCP Client Started!");
    console.log("Type your queries or 'quit' to exit.");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "\\nQuery: ",
    });

    rl.prompt();

    for await (const line of rl) {
      if (line.toLowerCase() === "quit") {
        break;
      }
      try {
        const response = await this.processQuery(line.trim());
        console.log("\\n" + response);
      } catch (e) {
        console.error(`\\nError: ${e.message}`);
      }
      rl.prompt();
    }
    rl.close();
  }

  async cleanup() {
    for (const close of this.exitStack.reverse()) {
      await close();
    }
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.log("Usage: node client.js <path_to_server_script>");
    process.exit(1);
  }

  // Handle cross-platform paths
  const serverPath = path.resolve(process.argv[2]);

  const client = new MCPClient();
  try {
    await client.connectToServer(serverPath);
    await client.chatLoop();
  } finally {
    await client.cleanup();
  }
}

main().catch(console.error);
