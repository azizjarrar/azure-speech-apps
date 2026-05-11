# Voice Mail — Azure AI Speech

Interactive voice mail assistant using the Azure Cognitive Services Speech SDK.  
Supports **text-to-speech** (record a greeting) and **speech-to-text** (transcribe messages).

---

## Azure Setup

### 1. Create the resource
1. Go to [portal.azure.com](https://portal.azure.com)
2. Click **Create a resource**
3. Search for **Azure AI Services** and select it from the Marketplace
4. Fill in:
   - **Region**: Sweden Central (or any available)
   - **Pricing tier**: Standard S0
5. Click **Review + Create** → **Create**

### 2. Get your credentials
1. Open your new Azure AI Services resource
2. In the left menu click **Keys and Endpoint**
3. Copy **Key 1** and the **Endpoint**

### 3. Configure the app
Update `voice-mail/.env`:
```
AZURE_SPEECH_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
AZURE_SPEECH_KEY=your-key-1
```

---

## Run

```bash
npm install
az login
node voice-mail.js
```

---

## Options

| Option | What it does |
|---|---|
| 1 | Type a message → synthesized to `greeting.wav` and played back |
| 2 | Reads all `.wav` files from `messages/` → prints transcription for each |
| 3 | Exit |

To test option 2, copy any `.wav` file into the `messages/` folder first.
