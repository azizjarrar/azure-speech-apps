import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { createReadStream, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import open from "open";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sep = (char = "─", len = 60) => console.log(char.repeat(len));

async function main() {
  const endpoint        = process.env.AZURE_OPENAI_ENDPOINT;
  const tenantId        = process.env.AZURE_TENANT_ID;
  const modelDeployment = process.env.MODEL_DEPLOYMENT ?? "whisper";

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set in .env");

  // CLI arg overrides default; default is the mp3 produced by generate-speech
  const audioFilePath = process.argv[2]
    ? resolve(process.argv[2])
    : join(__dirname, "..", "generate-speech", "speech.mp3");

  if (!existsSync(audioFilePath)) {
    throw new Error(
      `Audio file not found: ${audioFilePath}\n` +
      "Run generate-speech first, or pass a custom path as an argument:\n" +
      "  node transcribe-speech.js path/to/audio.mp3"
    );
  }

  // Entra ID auth — works with `az login` locally, managed identity in Azure
  const credential          = new DefaultAzureCredential({ tenantId });
  const azureADTokenProvider = getBearerTokenProvider(
    credential,
    "https://ai.azure.com/.default"
  );

  const client = new AzureOpenAI({
    endpoint,
    azureADTokenProvider,
    apiVersion: "2025-03-01-preview",
  });

  sep("═");
  console.log("\n🎧  Azure AI Foundry — Speech Transcription (STT)");
  sep("═");
  console.log(`\n   Model : ${modelDeployment}`);
  console.log(`   File  : ${audioFilePath}\n`);

  console.log("🔊  Opening audio player...");
  await open(audioFilePath);

  sep();
  console.log("\n⏳  Transcribing...\n");

  const transcription = await client.audio.transcriptions.create({
    model: modelDeployment,
    file: createReadStream(audioFilePath),
    response_format: "text",
  });

  sep();
  console.log("✅  Transcription:\n");
  console.log(`   "${transcription}"\n`);
  sep("═");
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
