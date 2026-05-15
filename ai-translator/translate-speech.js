// translate-speech.js — Azure Speech: speech translation
//
// WHAT IT DOES:
//   1. Listens to your microphone (expects English speech)
//   2. Sends the audio to Azure Speech, which transcribes + translates it simultaneously
//   3. Prints the translations to French, Spanish, and Hindi
//   4. Speaks each translation aloud using Neural TTS voices
//
// HOW TO RUN:
//   npm run speech
//
// REQUIRES:
//   - az login (run once in terminal before starting)
//   - A working microphone and speakers
//   - The COGNITIVE_SERVICES_ENDPOINT in .env

import sdk         from "microsoft-cognitiveservices-speech-sdk";
import "dotenv/config";

// ── Config ────────────────────────────────────────────────────────────────────

const endpoint = process.env.COGNITIVE_SERVICES_ENDPOINT?.replace(/\/$/, "");
const apiKey   = process.env.COGNITIVE_SERVICES_KEY;

if (!endpoint || !apiKey) {
  console.error("Missing COGNITIVE_SERVICES_ENDPOINT or COGNITIVE_SERVICES_KEY in .env");
  process.exit(1);
}

// Neural TTS voice to use when SPEAKING each translated language
// Full list: https://learn.microsoft.com/azure/ai-services/speech-service/language-support
const voices = {
  fr: "fr-FR-HenriNeural",    // French (France), male voice
  es: "es-ES-ElviraNeural",   // Spanish (Spain), female voice
  hi: "hi-IN-MadhurNeural",   // Hindi (India), male voice
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n── Azure Speech Translator ───────────────────────────────────\n");

  // [1] Build the SpeechTranslationConfig using the API key from your Azure resource
  const translationConfig = sdk.SpeechTranslationConfig.fromEndpoint(
    new URL(endpoint),
    apiKey
  );
  translationConfig.speechRecognitionLanguage = "en-US"; // what language you'll SPEAK
  translationConfig.addTargetLanguage("fr");             // translate to French
  translationConfig.addTargetLanguage("es");             // translate to Spanish
  translationConfig.addTargetLanguage("hi");             // translate to Hindi

  // [3] Use the default system microphone as the audio input source
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();

  // TranslationRecognizer: combines speech recognition + translation in one step
  // Azure does both simultaneously — you don't get text first then translate it
  const recognizer = new sdk.TranslationRecognizer(translationConfig, audioConfig);

  console.log("Ready to translate from en-US → French, Spanish, Hindi");
  console.log("Speak now...\n");

  // [4] recognizeOnceAsync() records until it detects a pause (end of utterance)
  //     It fires the callback once with the full recognized+translated result
  const result = await new Promise((resolve, reject) => {
    recognizer.recognizeOnceAsync(resolve, reject);
  });

  // [5] Handle the result
  if (result.reason === sdk.ResultReason.TranslatedSpeech) {
    console.log(`Recognized: "${result.text}"\n`);

    // result.translations contains all three translations at once
    // .languages is an array of language codes ["fr", "es", "hi"]
    // .get(lang) returns the translated string for that language
    const languageCodes = result.translations.languages;

    for (const lang of languageCodes) {
      const translatedText = result.translations.get(lang);
      console.log(`${lang}: "${translatedText}"`);

      // [6] Speak the translation using the Neural TTS voice for that language
      //     We create a new SpeechConfig per language so we can swap the voice name
      const speechConfig = sdk.SpeechConfig.fromEndpoint(new URL(endpoint), apiKey);
      speechConfig.speechSynthesisVoiceName = voices[lang];

      const audioOut    = sdk.AudioConfig.fromDefaultSpeakerOutput();
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioOut);

      // speakTextAsync sends the text to Azure TTS and plays it through speakers
      await new Promise((resolve, reject) => {
        synthesizer.speakTextAsync(
          translatedText,
          speakResult => {
            synthesizer.close(); // release the synthesizer — do this for every utterance
            if (speakResult.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              resolve();
            } else {
              reject(new Error(`TTS failed for ${lang}: ${speakResult.errorDetails}`));
            }
          },
          reject
        );
      });
    }

  } else {
    // Recognition failed — print a useful diagnostic message
    console.log("Recognition did not succeed.");
    console.log("Reason:", sdk.ResultReason[result.reason]);

    if (result.reason === sdk.ResultReason.Canceled) {
      const details = sdk.CancellationDetails.fromResult(result);
      console.log("Cancellation reason:", sdk.CancellationReason[details.reason]);
      console.log("Error details:", details.errorDetails);
      // Most common cause: wrong endpoint, expired token, or mic not detected
    }
  }

  // Always close the recognizer so it releases the microphone
  recognizer.close();
  console.log("\nDone.");
}

main().catch(err => {
  console.error("\nFatal error:", err.message ?? err);
  process.exit(1);
});
