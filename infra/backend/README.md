# backend (将来拡張用・未実装)

学習履歴・ユーザー認証・SNS 連携などを追加する場合のバックエンドスタックを配置する場所。

想定構成（設計書 NFR-4 参照）:

- Amazon API Gateway (HTTP API)
- AWS Lambda (履歴の記録/取得 API)
- Amazon DynamoDB (学習履歴テーブル)
- Amazon Cognito (ユーザー認証)

初期リリースでは作成しない。フロントエンドはデータ取得を `src/data/getItems()` 経由にしており、
API 化する際はこの関数を差し替えることで段階的に移行できる。
