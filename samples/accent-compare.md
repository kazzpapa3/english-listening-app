同じ英文を、アメリカ英語（Joanna/Matthew）とインド英語（Kajal など）で読み分けたサンプルmp3をローカルに生成します。まず、今のアカウントでインド英語（en-IN）のニューラル音声として何が使えるか実データで確認します。

en-IN のニューラル音声は **Kajal**（女性、neural/generative対応）が使えます。Raveena/Aditi は standard のみです。

比較サンプルを作ります。同一英文2つを、以下の話者で読み分けます。
- **米国英語**: Joanna（女）, Matthew（男） … neural
- **インド英語**: Kajal（女） … neural

male のインド英語ニューラルは無いので、比較は「同一文を Joanna / Matthew / Kajal」で出す形にします。サンプル文は、AWSカンファレンス的な文と日常文を各1つ使います。生成スクリプトを一時的に作ります。

6ファイル生成できました。ファイルを確認します。

比較サンプルをローカルに生成しました。 macOSなので、そのまま再生して聴き比べられます。

## 生成した比較サンプル

`accent-compare/` に、**同一の英文**を米国英語とインド英語で読み分けた6ファイルです。

| ファイル | 文 | アクセント | 音声 |
|---|---|---|---|
| `aws__US-female__Joanna.mp3` | AWS（Bedrock紹介） | 米国英語・女 | Joanna |
| `aws__US-male__Matthew.mp3` | AWS（Bedrock紹介） | 米国英語・男 | Matthew |
| `aws__IN-female__Kajal.mp3` | AWS（Bedrock紹介） | **インド英語・女** | Kajal |
| `daily__US-female__Joanna.mp3` | 登壇開始の挨拶 | 米国英語・女 | Joanna |
| `daily__US-male__Matthew.mp3` | 登壇開始の挨拶 | 米国英語・男 | Matthew |
| `daily__IN-female__Kajal.mp3` | 登壇開始の挨拶 | **インド英語・女** | Kajal |

いずれも Neural エンジンで、同じ文なのでアクセント差が直接比較できます。

補足として今回わかったこと:
- インド英語のニューラル音声は **Kajal（女性）** が使えます（Raveena/Aditi は standard のみ）。**男性のインド英語ニューラルは今のところ無し**なので、男性で比較したい場合は standard 音声になります（品質は neural より落ちます）。必要なら standard 版も出せます。
- Kajal は **generative エンジン**にも対応していました。generative の方がより自然・表現豊かな傾向があるので、聴き比べたければ Kajal の generative 版サンプルも追加生成できます。
