import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { createInterface } from "readline";
import { createReadStream, existsSync } from "fs";
import "dotenv/config";

const sep = (char = "─", len = 60) => console.log(char.repeat(len));

const AGENT_NAME = "test-mcp-speach";
const MODEL      = "gpt-4.1";
const VOICE      = "en-GB-SoniaNeural";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function buildPrompt(mode, input) {
  if (mode === "1") {
    return `Synthesize "${input}" as speech using the voice "${VOICE}".`;
  }
  return `Transcribe the audio file at this path and return the text: "${input}"`;
}

async function main() {
  const projectEndpoint = process.env.AZURE_AI_PROJECT_ENDPOINT;
  const openaiEndpoint  = process.env.AZURE_OPENAI_ENDPOINT;
  const whisperModel    = process.env.WHISPER_DEPLOYMENT ?? "whisper";
  const tenantId        = process.env.AZURE_TENANT_ID;

  if (!projectEndpoint) throw new Error("AZURE_AI_PROJECT_ENDPOINT is not set in .env");
  if (!openaiEndpoint)  throw new Error("AZURE_OPENAI_ENDPOINT is not set in .env");

  const credential          = new DefaultAzureCredential({ tenantId });
  const azureADTokenProvider = getBearerTokenProvider(
    credential,
    "https://ai.azure.com/.default"
  );

  // Agent client — project-scoped endpoint for Responses API + agent_reference
  const agentClient = new AzureOpenAI({
    endpoint: projectEndpoint,
    azureADTokenProvider,
    apiVersion: "2025-11-15-preview",
  });

  // Whisper client — root endpoint for local-file transcription
  const whisperClient = new AzureOpenAI({
    endpoint: openaiEndpoint,
    azureADTokenProvider,
    apiVersion: "2025-03-01-preview",
  });

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  sep("═");
  console.log("\n   Azure AI Foundry — Speech MCP Agent");
  sep("═");

  let running = true;

  while (running) {
    console.log("\n   1. Text  →  Speech");
    console.log("   2. Audio →  Text");
    console.log("   3. Exit\n");

    const mode = (await ask(rl, "   Choose: ")).trim();

    if (mode === "3") { running = false; break; }
    if (mode !== "1" && mode !== "2") { console.log("\n   Enter 1, 2, or 3."); continue; }

    const label = mode === "1" ? "Text to synthesize" : "Audio file path";
    const input = (await ask(rl, `   ${label}: `)).trim();
    if (!input) { console.log("\n   No input provided."); continue; }

    sep();

    try {
      if (mode === "1") {
        // TTS — route through the Speech MCP agent
        console.log("\n   Sending to agent...\n");
        const response = await agentClient.responses.create({
          model: MODEL,
          input: [{ role: "user", content: buildPrompt(mode, input) }],
          agent_reference: {
            type: "agent_reference",
            name: AGENT_NAME,
            version: "4",
          },
        });
        sep("═");
        console.log("\n   Agent response:\n");
        console.log(`   ${response.output_text}`);
        sep("═");
      } else {
        // STT — Whisper reads the local file directly
        if (!existsSync(input)) throw new Error(`File not found: ${input}`);
        console.log("\n   Transcribing audio...\n");
        const transcription = await whisperClient.audio.transcriptions.create({
          model: whisperModel,
          file: createReadStream(input),
          response_format: "text",
        });
        sep("═");
        console.log("\n   Transcription:\n");
        console.log(`   "${transcription}"`);
        sep("═");
      }
    } catch (err) {
      console.error(`\n   Error: ${err.message ?? err}`);
    }
  }

  rl.close();
  console.log("\n   Goodbye!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
