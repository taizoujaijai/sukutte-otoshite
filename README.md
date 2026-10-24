# すくっておとしてスペシャル

ゲームセンターのお菓子すくい機を、ブラウザで遊べる3Dゲームにしたものです。スマホでもPCでも遊べます。

**▶ 遊ぶ：https://taizoujaijai.github.io/sukutte-otoshite/**

## 遊び方

1. 「はじめる」を押し、左右にスワイプして席をえらびます。
2. 「コインを入れる」（1回100円）。何枚か先に入れて、続けて遊べます。
3. 「すくう」：腕が伸びて、川を流れてくる景品を横向きにすくいます。腕が川に届くまで約2秒。流れてくる景品を見て、早めに押しましょう。
4. 「おとす」：すくった景品を、前後に動く台（上段）に落とします。
5. 上段に押された景品が下段から手前に落ちると、あなたのものです。宝箱からあふれるまで取れたらクリア。

お金がなくなったら「おねだり」で1000円もらえます。PCでは C（コイン）、スペース（すくう）、Enter（おとす）でも操作できます。

## 開発

```bash
npm install
npm run dev
```

- `npm run build`：`dist/index.html` に、JS・CSS・3Dモデルをすべて含んだ1つの HTML を作ります。
- `npm run artifact`：Claude の Artifact として公開できる形（`dist/artifact.html`）も作ります。
- main に push すると、GitHub Actions がビルドして GitHub Pages に公開します。

仕様は [SPEC.md](SPEC.md)、見た目などを決めたときの試作は `prototypes/` にあります（`試作を開く.bat` で開けます）。

## 使っている素材

3Dモデルの一部は CC0 のフリー素材です。出どころは [assets/models/CREDITS.md](assets/models/CREDITS.md) にまとめています。
