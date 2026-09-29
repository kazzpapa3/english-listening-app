#!/usr/bin/env node
/**
 * generate-audio.mjs
 *
 * content/*.json の各問について Amazon Polly (Neural) で mp3 を事前生成する。
 *
 * 英語 (en):
 *   - LanguageCode: en-US, VoiceId: item.voice (Joanna | Matthew)
 *   - TextType: ssml, <speak><prosody rate="{rate}%">{en}</prosody></speak>
 *   - 出力: frontend/public/audio/{mode}/{id}.mp3
 * 日本語 (ja):
 *   - LanguageCode: ja-JP, VoiceId: item.jaVoice (Kazuha | Takumi)
 *   - TextType: text（等倍）
 *   - 出力: frontend/public/audio/{mode}-ja/{id}.mp3
 *
 * 冪等: 既存 mp3 はスキップ (--force で再生成)
 *
 * 実行前提:
 *   - アカウント <APP_ACCOUNT_ID> の認証情報 (Polly:SynthesizeSpeech 権限)
 *
 * 使い方:
 *   AWS_PROFILE=awslogin2 node scripts/generate-audio.mjs
 *   AWS_PROFILE=awslogin2 node scripts/generate-audio.mjs --force
 *   AWS_PROFILE=awslogin2 node scripts/generate-audio.mjs --mode daily
 *   AWS_PROFILE=awslogin2 node scripts/generate-audio.mjs --lang ja   （en|ja、既定は両方）
 */

import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Buffer } from "node:buffer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CONTENT_DIR = join(ROOT, "content");
const OUTPUT_ROOT = join(ROOT, "frontend", "public");

const REGION = process.env.AWS_REGION || "ap-northeast-1";
const CONTENT_FILES = [
  { mode: "daily", file: join(CONTENT_DIR, "daily.json") },
  { mode: "conference", file: join(CONTENT_DIR, "conference.json") },
];

const VALID_EN_VOICES = new Set(["Joanna", "Matthew"]);
const VALID_JA_VOICES = new Set(["Kazuha", "Takumi", "Tomoko"]);

function parseArgs(argv) {
  const args = { force: false, mode: null, lang: null };
  for (const a of argv.slice(2)) {
    if (a === "--force") args.force = true;
    else if (a.startsWith("--mode=")) args.mode = a.split("=")[1];
    else if (a.startsWith("--lang=")) args.lang = a.split("=")[1];
  }
  const mi = argv.indexOf("--mode");
  if (mi !== -1 && argv[mi + 1] && !argv[mi + 1].startsWith("--")) args.mode = argv[mi + 1];
  const li = argv.indexOf("--lang");
  if (li !== -1 && argv[li + 1] && !argv[li + 1].startsWith("--")) args.lang = argv[li + 1];
  return args;
}

async function fileExists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// 英語: SSML + prosody rate
async function synthesizeEn(client, item) {
  const cmd = new SynthesizeSpeechCommand({
    Engine: "neural",
    OutputFormat: "mp3",
    LanguageCode: "en-US",
    VoiceId: item.voice,
    TextType: "ssml",
    Text: `<speak><prosody rate="${item.rate}%">${escapeXml(item.en)}</prosody></speak>`,
  });
  const res = await client.send(cmd);
  return streamToBuffer(res.AudioStream);
}

// 日本語: プレーンテキスト（等倍）
async function synthesizeJa(client, item) {
  const cmd = new SynthesizeSpeechCommand({
    Engine: "neural",
    OutputFormat: "mp3",
    LanguageCode: "ja-JP",
    VoiceId: item.jaVoice,
    TextType: "text",
    Text: item.ja,
  });
  const res = await client.send(cmd);
  return streamToBuffer(res.AudioStream);
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new PollyClient({ region: REGION });

  // 生成対象の言語
  const langs = args.lang ? [args.lang] : ["en", "ja"];
  for (const l of langs) {
    if (l !== "en" && l !== "ja") {
      console.error(`[ERROR] invalid --lang "${l}" (use en|ja)`);
      process.exit(1);
    }
  }

  let total = 0;
  let generated = 0;
  let skipped = 0;
  const errors = [];

  for (const { mode, file } of CONTENT_FILES) {
    if (args.mode && args.mode !== mode) continue;

    let items;
    try {
      items = JSON.parse(await readFile(file, "utf-8"));
    } catch (e) {
      console.error(`[ERROR] cannot read/parse ${file}: ${e.message}`);
      process.exitCode = 1;
      continue;
    }

    for (const lang of langs) {
      const subDir = lang === "en" ? mode : `${mode}-ja`;
      const outDir = join(OUTPUT_ROOT, "audio", subDir);
      await mkdir(outDir, { recursive: true });

      console.log(`\n=== ${mode} / ${lang} (${items.length} items) ===`);

      for (const item of items) {
        total++;
        const outPath = join(outDir, `${item.id}.mp3`);

        // バリデーション
        if (lang === "en") {
          if (!VALID_EN_VOICES.has(item.voice)) {
            const msg = `${item.id}: invalid en voice "${item.voice}"`;
            console.error(`  [SKIP] ${msg}`);
            errors.push(msg);
            continue;
          }
          if (typeof item.rate !== "number") {
            const msg = `${item.id}: invalid rate "${item.rate}"`;
            console.error(`  [SKIP] ${msg}`);
            errors.push(msg);
            continue;
          }
        } else {
          if (!VALID_JA_VOICES.has(item.jaVoice)) {
            const msg = `${item.id}: invalid ja voice "${item.jaVoice}"`;
            console.error(`  [SKIP] ${msg}`);
            errors.push(msg);
            continue;
          }
          if (!item.ja) {
            const msg = `${item.id}: empty ja text`;
            console.error(`  [SKIP] ${msg}`);
            errors.push(msg);
            continue;
          }
        }

        if (!args.force && (await fileExists(outPath))) {
          skipped++;
          console.log(`  [skip] ${subDir}/${item.id}.mp3 (exists)`);
          continue;
        }

        try {
          const audio =
            lang === "en"
              ? await synthesizeEn(client, item)
              : await synthesizeJa(client, item);
          await writeFile(outPath, audio);
          generated++;
          const info =
            lang === "en"
              ? `voice=${item.voice} rate=${item.rate}%`
              : `voice=${item.jaVoice}`;
          console.log(`  [ok]   ${subDir}/${item.id}.mp3  ${info} (${audio.length} bytes)`);
        } catch (e) {
          const msg = `${subDir}/${item.id}: ${e.name || "Error"} - ${e.message}`;
          console.error(`  [FAIL] ${msg}`);
          errors.push(msg);
        }
      }
    }
  }

  console.log(
    `\nDone. total=${total} generated=${generated} skipped=${skipped} errors=${errors.length}`
  );
  if (errors.length) {
    console.error("\nErrors:");
    for (const e of errors) console.error("  - " + e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
