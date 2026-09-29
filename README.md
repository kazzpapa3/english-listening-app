# English Listening App

英語のリスニング学習を目的とした Web アプリケーションです。読み上げられる英文を聞き、英文と日本語訳を確認しながら学習します。2 つの学習モード（日常会話 / AWS 技術カンファレンス）を提供します。

Amazon Q Developer CLI（Kiro CLI）との Vibe コーディングで作成しました。

## 特徴

- 2 つの学習モード
  - **日常会話モード**: 中学英語レベルから始まり、問題が進むにつれて難易度（読み上げ速度）が段階的に上がります。
  - **カンファレンスモード**: AWS の技術カンファレンス（re:Invent 等）のセッション聴講に備える問題群。
- 各モード 20 問（初期リリース）。
- 音声は **Amazon Polly（Neural）で事前生成した mp3** を配信。ランタイムで AWS API を呼ばず、静的配信のみで完結します。
- 英文 / 日本語訳の表示、再生・一時停止、シーク、再生速度切替（x0.75 / x1.0 / x1.5）。
- スマートフォン縦画面を主要ターゲットにしたレスポンシブ対応。

## 技術スタック

- フロントエンド: React 18 + TypeScript + Vite（SPA）
- 音声生成: Amazon Polly（Neural, 米国英語）でバッチ事前生成
- インフラ: S3 + CloudFront（OAC）+ Route53 + ACM を CloudFormation で構成
- 配信: S3 静的ホスティング + CloudFront（HTTPS、独自ドメイン）

## ディレクトリ構成

```
.
├── frontend/          # React + Vite の SPA
│   ├── src/           # コンポーネント / hooks / データ (daily.json, conference.json)
│   └── public/audio/  # Polly で生成した mp3（ビルド成果物に同梱）
├── content/           # 問題データ（音声生成の入力元 JSON）
├── scripts/           # バッチスクリプト（Polly 音声生成など）
├── infra/             # CloudFormation テンプレート（dns / cert / site）
├── docs/              # 要件定義・設計
└── samples/           # アクセント比較などのサンプル音声
```

## セットアップ

### 前提

- Node.js 18 以降
- 音声生成・デプロイを行う場合は AWS CLI と対象アカウントの認証情報

### フロントエンドの起動（開発）

```bash
cd frontend
npm ci
npm run dev
```

ビルド:

```bash
cd frontend
npm run build      # 成果物は frontend/dist
npm run preview    # ビルド成果物のローカル確認
```

### 音声（mp3）の生成

`content/*.json` の各問について Amazon Polly で mp3 を事前生成し、`frontend/public/audio/` に出力します（既存 mp3 はスキップ、`--force` で再生成）。

```bash
npm ci
# 対象アカウントの認証情報で実行（Polly:SynthesizeSpeech 権限が必要）
AWS_PROFILE=<your-profile> npm run generate-audio
```

## デプロイ

インフラは CloudFormation の 3 スタック（dns / cert / site）で構成します。手順の詳細は [`infra/README.md`](infra/README.md) を参照してください。

> AWS アカウント ID・ドメイン名などの環境固有値は、テンプレートのパラメータとして渡す構成です（リポジトリにはプレースホルダのみ含まれます）。

## 環境変数

フロントエンドの環境変数は `frontend/.env.example` を参照してください。`.env` は Git 管理対象外です。

- `VITE_GA_ID`: Google Analytics 4 の測定 ID（未設定なら GA タグは読み込まれません）。

## ライセンス

[MIT License](LICENSE)
