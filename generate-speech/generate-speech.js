import { AzureOpenAI } from "openai";
import { DefaultAzureCredential, getBearerTokenProvider } from "@azure/identity";
import { writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import open from "open";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sep = (char = "─", len = 60) => console.log(char.repeat(len));

async function main() {
  const endpoint       = process.env.AZURE_OPENAI_ENDPOINT;
  const tenantId       = process.env.AZURE_TENANT_ID;
  const modelDeployment = process.env.MODEL_DEPLOYMENT ?? "tts-hd";

  if (!endpoint) throw new Error("AZURE_OPENAI_ENDPOINT is not set in .env");

  // Entra ID auth — works with `az login` locally, managed identity in Azure
  const credential         = new DefaultAzureCredential({ tenantId });
  const azureADTokenProvider = getBearerTokenProvider(
    credential,
    "https://ai.azure.com/.default"
  );

  const client = new AzureOpenAI({
    endpoint,
    azureADTokenProvider,
    apiVersion: "2025-03-01-preview",
  });

  const speechFilePath = join(__dirname, "speech.mp3");

  sep("═");
  console.log("\n🎙️  Azure AI Foundry — Speech Generation (TTS)");
  sep("═");
  console.log(`\n   Model   : ${modelDeployment}`);
  console.log(`   Voice   : alloy`);
  console.log(`   Text    : "My voice is my passport!"`);
  console.log(`   Tone    : serious\n`);

  sep();
  console.log("⏳  Generating speech...\n");

  const response = await client.audio.speech.create({
    model: modelDeployment,
    voice: "alloy",
    input: "My voice is my passport!",
    instructions: "Speak in a serious tone.",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(speechFilePath, buffer);

  sep();
  console.log(`✅  Saved  : ${speechFilePath}`);
  console.log("🔊  Opening audio player...\n");

  await open(speechFilePath);
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
