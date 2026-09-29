import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { mkdir, writeFile } from "node:fs/promises";
import { Buffer } from "node:buffer";

const client = new PollyClient({ region: process.env.AWS_REGION || "ap-northeast-1" });

// 比較用サンプル文（AWSカンファレンス風＋日常）
const sentences = [
  {
    key: "aws",
    text: "Amazon Bedrock provides access to foundation models from leading AI companies through a single API, so you can build generative AI applications without managing any infrastructure.",
  },
  {
    key: "daily",
    text: "Thank you all for coming to my session today. Before we begin, please make sure your microphones are muted, and feel free to ask questions at the end.",
  },
];

// 読み分ける話者（VoiceId と LanguageCode）
const voices = [
  { id: "Joanna", lang: "en-US", label: "US-female" },
  { id: "Matthew", lang: "en-US", label: "US-male" },
  { id: "Kajal", lang: "en-IN", label: "IN-female" },
];

const OUT = "samples/accent-compare";
await mkdir(OUT, { recursive: true });

async function synth(voiceId, lang, text) {
  const res = await client.send(
    new SynthesizeSpeechCommand({
      Engine: "neural",
      OutputFormat: "mp3",
      LanguageCode: lang,
      VoiceId: voiceId,
      TextType: "text",
      Text: text,
    })
  );
  const chunks = [];
  for await (const c of res.AudioStream) chunks.push(c);
  return Buffer.concat(chunks);
}

for (const s of sentences) {
  for (const v of voices) {
    const file = `${OUT}/${s.key}__${v.label}__${v.id}.mp3`;
    const audio = await synth(v.id, v.lang, s.text);
    await writeFile(file, audio);
    console.log(`ok: ${file} (${audio.length} bytes)`);
  }
}
console.log("\nDone. Files in", OUT);
