// translate-text.js — Azure Translator: text translation
//
// WHAT IT DOES:
//   1. Connects to Azure Translator using your Entra ID (az login)
//   2. Fetches the list of all supported languages (~130 languages)
//   3. Asks you to pick a target language (e.g. "fr", "es", "ar", "ja")
//   4. Loops: you type any text, it translates it and auto-detects your source language
//   5. Type "quit" to exit
//
// HOW TO RUN:
//   npm run text
//
// REQUIRES: az login (run once in terminal before starting)

import readline                                from "readline/promises";
import { DefaultAzureCredential }             from "@azure/identity";
import TextTranslationClient, { isUnexpected } from "@azure-rest/ai-translation-text";
import "dotenv/config";

// ── Config ────────────────────────────────────────────────────────────────────

const endpoint = process.env.COGNITIVE_SERVICES_ENDPOINT;
const tenantId = process.env.AZURE_TENANT_ID;

if (!endpoint) {
  console.error("Missing COGNITIVE_SERVICES_ENDPOINT in .env");
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // readline/promises lets us use await on user input — cleaner than callbacks
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // [1] Authenticate using az login session (Entra ID)
  const credential = new DefaultAzureCredential({ tenantId });
  const client     = TextTranslationClient(endpoint, credential);

  console.log("\n── Azure Translator ─────────────────────────────────────────\n");

  // [2] GET /languages?scope=translation
  //     Returns an object whose keys are language codes ("fr", "es", "ar"…)
  //     and values contain the name, native name, and direction (ltr/rtl)
  const langResponse = await client.path("/languages").get({
    queryParameters: { scope: "translation" },
  });

  if (isUnexpected(langResponse)) {
    throw new Error("Failed to get languages: " + JSON.stringify(langResponse.body));
  }

  const languages = langResponse.body.translation;  // { fr: {...}, es: {...}, ... }
  const langCount = Object.keys(languages).length;

  console.log(`${langCount} languages supported.`);
  console.log("Reference: https://learn.microsoft.com/azure/ai-services/translator/language-support#translation\n");

  // [3] Keep asking until the user enters a valid language code
  //     languages["fr"] exists → French is supported; languages["xyz"] → undefined → loop again
  let targetLang = "";
  while (!languages[targetLang]) {
    targetLang = (await rl.question("Enter target language code (e.g. 'fr', 'es', 'ar', 'ja', 'zh-Hans'): ")).trim();
    if (!languages[targetLang]) {
      console.log(`  '${targetLang}' is not a supported language code. Try again.`);
    }
  }

  const langName = languages[targetLang]?.name ?? targetLang;
  console.log(`\nTranslating to: ${langName} (${targetLang})`);
  console.log("─────────────────────────────────────────────────────────────\n");

  // [4] Translation loop — Azure auto-detects the source language every time
  while (true) {
    const inputText = (await rl.question("Text to translate ('quit' to exit): ")).trim();
    if (inputText.toLowerCase() === "quit") break;
    if (!inputText) continue;

    // POST /translate?api-version=3.0&to=fr
    // Body is an array of { text } objects — you can send multiple at once
    const translateResponse = await client.path("/translate").post({
      queryParameters: { "api-version": "3.0", to: [targetLang] },
      body: [{ text: inputText }],
    });

    if (isUnexpected(translateResponse)) {
      console.log("  Translation error:", JSON.stringify(translateResponse.body));
      continue;
    }

    // Response: array of results — one per input text
    // Each result has detectedLanguage (with a confidence score) and translations[]
    const [result]   = translateResponse.body;
    const detected   = result.detectedLanguage;

    for (const t of result.translations) {
      console.log(
        `  '${inputText}'\n` +
        `  detected: ${detected?.language ?? "?"} (confidence: ${((detected?.score ?? 0) * 100).toFixed(0)}%)\n` +
        `  → ${t.to}: '${t.text}'\n`
      );
    }
  }

  rl.close();
  console.log("Goodbye!");
}

main().catch(err => {
  console.error("\nFatal error:", err.message ?? err);
  process.exit(1);
});
