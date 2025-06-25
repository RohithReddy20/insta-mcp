import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import readline from "readline";
import path from "path";
import os from "os";
import OpenAI from "openai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
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
    if (
      !serverScriptPath.endsWith(".ts") &&
      !serverScriptPath.endsWith(".js")
    ) {
      throw new Error("Server script must be a .ts or .js file");
    }

    const isTypeScript = serverScriptPath.endsWith(".ts");
    const serverParams = {
      command: "node",
      args: isTypeScript
        ? ["--loader", "ts-node/esm", serverScriptPath]
        : [serverScriptPath],
      env: process.env,
    };
    const transport = new StdioClientTransport(serverParams);

    this.session = new Client({
      name: "mcp-insta-client",
      version: "1.0.0",
    });
    this.exitStack.push(async () => await transport.close());

    await this.session.connect(transport);
    const response = await this.session.listTools();
    const tools = response.tools;
    console.log(
      "\\nConnected to server with tools:",
      tools.map((tool) => tool.name)
    );
  }

  async processQuery(query) {
    const llmMessages = [
      {
        role: "system",
        content:
          "You are a helpful assistant. When a user asks a question that can be answered by one of your available tools, you must use the tool. After receiving the tool's output, provide a response to the user based on that output. If the question cannot be answered by a tool, or if you are unsure, answer to the best of your ability without using tools.",
      },
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
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      },
    }));

    // Loop to handle tool calls until a final text response is generated
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const openAIResponse = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: llmMessages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: availableTools.length > 0 ? "auto" : undefined,
      });

      const responseMessage = openAIResponse.choices[0].message;

      if (responseMessage.tool_calls) {
        // Add the assistant's decision to call tools to the history
        llmMessages.push(responseMessage);

        // Execute all tool calls
        for (const toolCall of responseMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(
            `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`
          );
          const result = await this.session.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          const toolResultContent = result.isError
            ? `Error: ${result.content.map((c) => c.text).join("\\n")}`
            : result.content.map((c) => c.text).join("\\n");

          // Add the tool's result to the history
          llmMessages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: toolName,
            content: toolResultContent,
          });
        }
        // Go back to the start of the loop to let the model process the tool results
        continue;
      } else {
        // No tool calls, we have a final text response
        return responseMessage.content;
      }
    }
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
