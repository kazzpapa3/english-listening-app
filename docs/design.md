# 設計書 — 英語リスニングアプリ

本書は `docs/requirements.md` を実現するための設計を定義する。

## 1. 全体アーキテクチャ

```
                                 ┌─────────────────────────────────────────┐
   ユーザー (ブラウザ)            │  AWS アカウント <APP_ACCOUNT_ID> (アプリ側)   │
       │                         │                                           │
       │ HTTPS                   │   ┌──────────────┐   OAC    ┌──────────┐ │
       ▼                         │   │  CloudFront  │─────────▶│  S3       │ │
 listening.example.com ───────────▶ Distribution │          │ (private) │ │
                                 │   │  + ACM(us-e1)│          │ SPA + mp3 │ │
                                 │   └──────────────┘          └──────────┘ │
                                 │          ▲                                │
                                 │          │ Alias (A/AAAA)                 │
                                 │   ┌───────────────────────────────────┐  │
                                 │   │ Route53 HostedZone                 │  │
                                 │   │  listening.example.com (子ゾーン) │  │
                                 │   └───────────────────────────────────┘  │
                                 └──────────────────┬────────────────────────┘
                                                    │ NS 委譲 (初回のみ)
                                 ┌──────────────────▼────────────────────────┐
                                 │ AWS アカウント <PARENT_ACCOUNT_ID> (親DNS側)       │
                                 │  Route53 HostedZone example.com          │
                                 │   └─ listening  NS  → 子ゾーンのNS 4本      │
                                 └────────────────────────────────────────────┘
```

- 実行時に呼び出す AWS API はなし（音声 mp3 も S3 上の静的ファイル）。
- 将来のバックエンド（学習履歴・認証・SNS）は別スタックとして後付けする（本リリースでは作らない）。

## 2. AWS リソース設計

同一アカウントに別プロダクトの本番が同居するため、全リソース名 / 論理 ID を `listening-app-` プレフィックスで分離する。

### 2.1 配信スタック（メイン、リージョン: ap-northeast-1）
| リソース | 説明 |
|---|---|
| S3 バケット `listening-app-site-<accountId>` | SPA と mp3 を格納。パブリックアクセス全ブロック。バケットポリシーで CloudFront(OAC) の `s3:GetObject` のみ許可 |
| CloudFront Distribution | 既定ルート `index.html`。OAC で S3 にアクセス。カスタムドメイン `listening.example.com`、ACM 証明書を関連付け。HTTP→HTTPS リダイレクト |
| CloudFront Function または CustomErrorResponse | SPA ルーティング用に 403/404 を `/index.html`（200）へフォールバック |
| Route53 HostedZone `listening.example.com` | アプリ側アカウントの子ゾーン |
| Route53 RecordSet (A / AAAA Alias) | `listening.example.com` → CloudFront |

### 2.2 証明書スタック（リージョン: us-east-1）
| リソース | 説明 |
|---|---|
| ACM Certificate `listening.example.com` | CloudFront 用のため us-east-1。DNS 検証。検証用 CNAME は子ゾーン（2.1 の HostedZone）に作成 |

> CloudFront は us-east-1 の証明書のみ受け付けるため、証明書は別スタック（別リージョン）で管理する。HostedZone は 2.1 側（グローバル）で作成し、証明書スタックは HostedZoneId を受け取って検証レコードを作成する。

### 2.3 スタック分割方針
1. `dns` : Route53 HostedZone（子ゾーン）。出力: HostedZoneId, NameServers
2. `cert`（us-east-1）: ACM 証明書 + DNS 検証。入力: HostedZoneId。出力: CertificateArn
3. `site`（ap-northeast-1）: S3 + CloudFront + Alias レコード。入力: HostedZoneId, CertificateArn
4. （将来）`backend` : API Gateway + Lambda + DynamoDB + Cognito。ディレクトリだけ用意し中身は空

> 親ゾーン（<PARENT_ACCOUNT_ID>）への NS レコード登録は手動または別途 CLI で 1 回行う（クロスアカウントのため同一スタックには含めない）。`dns` スタックの NameServers 出力を用いる。

### 2.4 デプロイ順序
```
1. dns スタック作成 (ap-northeast-1) → NameServers を取得
2. 親アカウント(<PARENT_ACCOUNT_ID>)で listening.example.com の NS レコードを登録
3. cert スタック作成 (us-east-1) → DNS検証完了を待つ (子ゾーンが委譲済みである必要)
4. site スタック作成 (ap-northeast-1)
5. フロントの build 成果物と mp3 を S3 に同期 → CloudFront キャッシュ無効化
```

## 3. データモデル（コンテンツ）

問題データはフロントにバンドルする静的 JSON。将来 DB 化する場合も同スキーマを踏襲する。

### 3.1 ディレクトリ / 命名
- コンテンツ定義: `content/daily.json`, `content/conference.json`
- 音声: `public/audio/{mode}/{id}.mp3`（例: `public/audio/daily/daily-01.mp3`）

### 3.2 スキーマ（1 問）
```jsonc
{
  "id": "daily-01",          // モード内で一意
  "mode": "daily",           // "daily" | "conference"
  "order": 1,                // 1..20 表示順（難易度順）
  "en": "Hello. How are you today?",
  "ja": "こんにちは。今日は元気ですか？",
  "voice": "Joanna",         // "Joanna" | "Matthew"
  "rate": 90,                // Polly prosody rate (%) 音声生成時の速度
  "audio": "audio/daily/daily-01.mp3"  // S3/公開ルートからの相対パス
}
```

### 3.3 難易度・速度・ボイスの割り当てルール
- **日常会話 (daily)**: `order` の進行に応じて `rate` を段階的に上げる。
  - 例: 1–5問=90%, 6–10問=100%, 11–15問=110%, 16–20問=120%
  - 英文の難易度も中学英語 → 一般日常会話へ段階的に上げる。
- **カンファレンス (conference)**: `rate` は 100% 固定（自然な聴講速度）。内容は AWS トピックに限定。
- **ボイス混在**: `order` の偶奇等で Joanna / Matthew を交互に割り当てる（会話の話者交代を演出）。
- UI 側の再生速度切替（x0.75/x1.0/x1.5）はこの生成時 `rate` とは独立に働く（`audio.playbackRate`）。

## 4. 音声生成（ビルド時バッチ）

### 4.1 スクリプト
- 配置: `scripts/generate-audio.mjs`（Node.js, AWS SDK v3 `@aws-sdk/client-polly`）
- 入力: `content/*.json`
- 処理: 各問について `SynthesizeSpeech` を呼ぶ。
  - `Engine: "neural"`, `OutputFormat: "mp3"`, `LanguageCode: "en-US"`
  - `VoiceId`: item.voice（Joanna / Matthew）
  - `TextType: "ssml"`, `Text`: `<speak><prosody rate="{rate}%">{en}</prosody></speak>`
  - 出力を `public/audio/{mode}/{id}.mp3` に保存
- 冪等性: 既存 mp3 があればスキップ（`--force` で再生成）。
- 実行アカウント: `<APP_ACCOUNT_ID>`（Polly 実行権限が必要）。一時認証情報を取得して実行。

### 4.2 コスト見積り
- 40 問 × 平均 ~200 文字 ≒ 8,000 文字程度の一度きりの合成。Neural の無料枠 / 従量でごく少額（事前生成は 1 回のみ）。

## 5. フロントエンド設計（React + Vite）

### 5.1 スタック
- React + TypeScript + Vite。状態管理は最小（React hooks / Context）。ルーティングは将来拡張に備え `react-router` を導入可（初期は 1 画面）。

### 5.2 コンポーネント構成
```
src/
  main.tsx
  App.tsx                 // モード state, 問題 index state を保持
  components/
    ModeTabs.tsx          // MODE1 / MODE2 切替
    TextPanel.tsx         // EN / JP 表示 (2 枚)
    AudioController.tsx   // <audio> 再生/一時停止/シーク/速度切替
    NavButtons.tsx        // prev / next
  data/
    daily.json            // content からコピー or import
    conference.json
  hooks/
    useAudio.ts           // playbackRate, play/pause, seek 管理
  types.ts                // Item 型
```

### 5.3 主な挙動
- モード切替時: 問題 index を 0 にリセットし、その問題の英文/和訳/音声を表示。
- prev/next: index を移動（0..19 の範囲でクランプ、端は無効化）。
- 音声: `<audio src={item.audio}>` を使用。速度切替ボタンで `audio.playbackRate` を 0.75 / 1.0 / 1.5 に設定。シークバーは `currentTime` / `duration` で制御。
- 問題切替時は音声を停止し先頭に戻す。
- レスポンシブ: スマホ縦を主とした 1 カラムレイアウト。

### 5.4 将来拡張の受け皿（今は未実装）
- 学習履歴: 回答/既読状態を保存する API 呼び出し口を `src/api/` に切れるよう、データ取得を関数経由にしておく。
- 認証: Cognito 導入時に App 上位に AuthProvider を差し込める構成。

## 6. IaC（CloudFormation / SAM）

### 6.1 ディレクトリ
```
infra/
  dns/template.yaml        # Route53 子ゾーン (ap-northeast-1)
  cert/template.yaml       # ACM (us-east-1)
  site/template.yaml       # S3 + CloudFront + Alias (ap-northeast-1)
  backend/                 # 将来用 (空/README のみ)
  README.md                # デプロイ手順・パラメータ
```
- SAM CLI（`sam deploy`）または `aws cloudformation deploy` を使用。SAM を基本とする。
- スタック名: `listening-app-dns`, `listening-app-cert`, `listening-app-site`。

### 6.2 site スタックの CloudFront ポイント
- `DefaultRootObject: index.html`
- `Origin`: S3 REST エンドポイント + OriginAccessControl（署名付き、SigV4）
- S3 バケットポリシー: `cloudfront.amazonaws.com` からの `s3:GetObject` を `AWS:SourceArn` = Distribution ARN で許可
- `ViewerProtocolPolicy: redirect-to-https`
- SPA フォールバック: `CustomErrorResponses` で 403/404 → `/index.html` (200)
- mp3 は `Content-Type: audio/mpeg` で配信（アップロード時に付与）

## 7. リポジトリ構成（全体）
```
EnglishListeningApp/
  docs/            requirements.md, design.md
  content/         daily.json, conference.json (マスターデータ)
  scripts/         generate-audio.mjs
  frontend/        React + Vite プロジェクト (public/audio に mp3 生成)
  infra/           dns / cert / site / backend
  requirement.md   (元の要望)
  image.PNG        (画面ラフ)
```

## 8. デプロイ / 運用フロー
1. `content/*.json` を作成・更新
2. `node scripts/generate-audio.mjs`（<APP_ACCOUNT_ID> 認証で Polly 実行、mp3 を frontend/public/audio へ）
3. `cd frontend && npm run build`（dist に SPA + audio）
4. IaC: dns → (親NS登録) → cert → site の順にデプロイ
5. `aws s3 sync frontend/dist s3://listening-app-site-... --delete` + CloudFront invalidation
6. `https://listening.example.com` で受け入れ基準を確認

## 9. 未決事項 / 要確認
- （なし。合意後に実装着手）
