# infra — 英語リスニングアプリ IaC

CloudFormation で構成する。スタックは 3 つ（+ 将来の backend）。

| スタック | リージョン | 用途 | 依存 |
|---|---|---|---|
| `listening-app-dns` | ap-northeast-1 | Route53 子ゾーン (listening.example.com) | なし |
| `listening-app-cert` | **us-east-1** | ACM 証明書 (CloudFront 用, DNS 検証) | dns + 親ゾーンへの NS 委譲 |
| `listening-app-site` | ap-northeast-1 | S3 + CloudFront(OAC) + Alias レコード | dns, cert |

すべて **アプリ側アカウント <APP_ACCOUNT_ID>** にデプロイする。
親ゾーン `example.com`（アカウント <PARENT_ACCOUNT_ID>）へは NS レコードを 1 回登録するのみ。

前提: AWS CLI に <APP_ACCOUNT_ID> の認証情報（例 `AWS_PROFILE=awslogin2`）。

---

## 手順

### 1. dns スタック（ap-northeast-1）

```bash
aws cloudformation deploy \
  --region ap-northeast-1 \
  --stack-name listening-app-dns \
  --template-file infra/dns/template.yaml \
  --profile awslogin2

# NameServers を取得（親ゾーンに登録する 4 本）
aws cloudformation describe-stacks \
  --region ap-northeast-1 \
  --stack-name listening-app-dns \
  --query "Stacks[0].Outputs" --output table \
  --profile awslogin2
```

### 2. 親ゾーンに NS 委譲（アカウント <PARENT_ACCOUNT_ID> で 1 回のみ）

`listening.example.com` の NS レコードを親ゾーン `example.com` に作成する。
値は手順 1 の `NameServers` 出力（カンマ区切り 4 本）。TTL は 300 程度。

> このアカウントは別途認証情報を取得して作業する。委譲が反映されると
> `dig NS listening.example.com` で子ゾーンの NS が引けるようになる。

### 3. cert スタック（us-east-1）

委譲反映後に実行（DNS 検証が通る必要があるため）。

```bash
HOSTED_ZONE_ID=$(aws cloudformation describe-stacks \
  --region ap-northeast-1 --stack-name listening-app-dns \
  --query "Stacks[0].Outputs[?OutputKey=='HostedZoneId'].OutputValue" \
  --output text --profile awslogin2)

aws cloudformation deploy \
  --region us-east-1 \
  --stack-name listening-app-cert \
  --template-file infra/cert/template.yaml \
  --parameter-overrides HostedZoneId=$HOSTED_ZONE_ID \
  --profile awslogin2
# 証明書の DNS 検証完了まで数分待つ（ISSUED になるまで）
```

### 4. site スタック（ap-northeast-1）

```bash
CERT_ARN=$(aws cloudformation describe-stacks \
  --region us-east-1 --stack-name listening-app-cert \
  --query "Stacks[0].Outputs[?OutputKey=='CertificateArn'].OutputValue" \
  --output text --profile awslogin2)

aws cloudformation deploy \
  --region ap-northeast-1 \
  --stack-name listening-app-site \
  --template-file infra/site/template.yaml \
  --parameter-overrides HostedZoneId=$HOSTED_ZONE_ID CertificateArn=$CERT_ARN \
  --profile awslogin2
```

### 5. コンテンツのデプロイ（フロント build 成果物 + 音声）

```bash
# ビルド
( cd frontend && npm ci && npm run build )

# バケット名と Distribution ID を取得
BUCKET=$(aws cloudformation describe-stacks \
  --region ap-northeast-1 --stack-name listening-app-site \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" \
  --output text --profile awslogin2)
DIST_ID=$(aws cloudformation describe-stacks \
  --region ap-northeast-1 --stack-name listening-app-site \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
  --output text --profile awslogin2)

# 同期（mp3 の Content-Type は拡張子から自動判定される）
aws s3 sync frontend/dist "s3://$BUCKET/" --delete --profile awslogin2

# キャッシュ無効化
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" --paths "/*" --profile awslogin2
```

### 6. 確認

```bash
curl -I https://listening.example.com/
```

---

## 削除（撤去）順

1. S3 バケットを空にする（`aws s3 rm s3://$BUCKET --recursive`）
2. `listening-app-site` を削除
3. `listening-app-cert` を削除（us-east-1）
4. `listening-app-dns` を削除
5. 親ゾーンの NS 委譲レコードを削除（<PARENT_ACCOUNT_ID>）
