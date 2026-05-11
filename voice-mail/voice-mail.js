import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { readdirSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";
import open from "open";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sep = (char = "─", len = 60) => console.log(char.repeat(len));

// ── Auth ──────────────────────────────────────────────────────────────────────
function createSpeechConfig(endpoint, key) {
  return sdk.SpeechConfig.fromEndpoint(new URL(endpoint), key);
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ── 1. Record greeting (TTS → file) ──────────────────────────────────────────
async function recordGreeting(speechConfig, rl) {
  const greetingMessage = await ask(rl, "\n📝  Enter your greeting message: ");

  const outputFile  = join(__dirname, "greeting.wav");
  // save synthesized audio to a WAV file instead of playing through speaker
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputFile);

  // Serena neural voice — high quality US English female
  speechConfig.speechSynthesisVoiceName = "en-US-Serena:DragonHDLatestNeural";
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

  return new Promise((resolve, reject) => {
    // speakTextAsync converts the text and writes the audio to the file defined in audioConfig
    synthesizer.speakTextAsync(
      greetingMessage,
      (result) => {
        synthesizer.close();
        // SynthesizingAudioCompleted means the file was written successfully
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          console.log(`\n✅  Greeting saved to: ${outputFile}`);
          console.log("🔊  Opening audio player...\n");
          open(outputFile);
          resolve();
        } else {
          const details = sdk.CancellationDetails.fromResult(result);
          reject(new Error(`Synthesis failed: ${details.errorDetails}`));
        }
      },
      (err) => { synthesizer.close(); reject(err); }
    );
  });
}

// ── 2. Transcribe messages (audio file → text) ────────────────────────────────
async function transcribeMessages(speechConfig) {
  const messagesDir = join(__dirname, "messages");

  if (!existsSync(messagesDir)) {
    console.log("\n⚠️   messages/ folder not found.");
    return;
  }

  const files = readdirSync(messagesDir).filter((f) => f.endsWith(".wav")).sort();
  if (files.length === 0) {
    console.log("\n⚠️   No .wav files found in messages/ — add some and try again.\n");
    return;
  }

  for (const file of files) {
    const filePath = join(messagesDir, file);
    sep();
    console.log(`\n📨  Message: ${file}`);
    console.log("🔊  Playing message...");
    await open(filePath);

    // push stream lets us feed raw file bytes to the recognizer without fromWavFileInput
    const pushStream = sdk.AudioInputStream.createPushStream();
    const fileBuffer = readFileSync(filePath);
    // slice extracts the exact bytes of the WAV data from the Node.js Buffer
    pushStream.write(fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength));
    pushStream.close();
    // wrap the stream in an AudioConfig so the recognizer can consume it
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer  = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    await new Promise((resolve, reject) => {
      // recognizeOnceAsync listens until silence then returns one result
      recognizer.recognizeOnceAsync(
        (result) => {
          recognizer.close();
          // RecognizedSpeech means speech was detected and transcribed successfully
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            console.log(`\n📝  Transcription: ${result.text}`);
          } else {
            const details = sdk.CancellationDetails.fromResult(result);
            console.log(`\n⚠️   Could not transcribe: ${details.errorDetails}`);
          }
          resolve();
        },
        (err) => { recognizer.close(); reject(err); }
      );
    });

    console.log();
  }

  sep();
  console.log("✅  All messages transcribed.\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT;
  const key      = process.env.AZURE_SPEECH_KEY;

  if (!endpoint) throw new Error("AZURE_SPEECH_ENDPOINT is not set in .env");
  if (!key)      throw new Error("AZURE_SPEECH_KEY is not set in .env");

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  sep("═");
  console.log("\n📬  Azure AI Speech — Voice Mail Assistant");
  sep("═");

  let running = true;

  while (running) {
    console.log("\n   1. Record a voice greeting");
    console.log("   2. Transcribe messages");
    console.log("   3. Exit\n");

    const choice = await ask(rl, "   Choose an option: ");

    switch (choice.trim()) {
      case "1":
        await recordGreeting(createSpeechConfig(endpoint, key), rl);
        break;
      case "2":
        await transcribeMessages(createSpeechConfig(endpoint, key));
        break;
      case "3":
        running = false;
        break;
      default:
        console.log("\n   ⚠️  Invalid option. Enter 1, 2, or 3.");
    }
  }

  rl.close();
  sep("═");
  console.log("\n👋  Goodbye!\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
