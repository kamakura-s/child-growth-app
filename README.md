# すくすくノート（子どもの成長記録アプリ）

ローカル（HTML / CSS / JavaScript）だけで動く、子どもの成長記録アプリです。  
データはブラウザの `localStorage` に保存されます。

## 主な機能

- **SPAタブUI**（プロフィール / 成長記録 / 日記 / グラフ / 設定）
- 初回オンボーディング（3ステップ、初回のみ表示）
- 保存ステータス表示（保存中 / 保存済み / エラー）
- 表示テーマ切替（ライト / ダーク、設定で保存）
- 子どもプロフィール登録（名前・生年月日・メモ）
- 身長 / 体重の記録（日時・カテゴリ・体調選択・タグ候補チップ・メモ）
- 写真付き日記メモ（カテゴリ・タグ対応）
- **検索・絞り込み**（成長記録/日記）
  - 日付範囲（開始日・終了日）
  - カテゴリ
  - キーワード（本文/メモ/タグ）
  - タグ指定
- **タグ機能**（記録と日記にタグ追加・表示・フィルタ）
- グラフ（Canvas）
  - 身長 / 体重推移（3件移動平均線つき）
  - 月別記録件数バー
  - カテゴリ比率可視化
- 分析カード（月次増減 / 平均変化 / 直近トレンド）
- **月次レポート自動生成**
  - 対象月の成長記録件数 / 日記件数
  - 平均身長 / 平均体重
  - 最近のハイライト（最新最大5件）
- 空状態ガイド、個別削除・全データ削除
- 設定画面からの **JSONエクスポート / インポート**

## データ仕様

`localStorage` の保存キー:

- 本体データ: `childGrowthMvpData`
- オンボーディング既読フラグ: `childGrowthOnboardingSeen`

保存データ形式（schemaVersion 3）:

```json
{
  "schemaVersion": 2,
  "profile": { "name": "...", "birthDate": "YYYY-MM-DD", "note": "..." },
  "growthRecords": [
    {
      "id": "...",
      "date": "YYYY-MM-DD",
      "category": "health",
      "condition": "good",
      "height": 92.4,
      "weight": 13.6,
      "tags": ["発熱", "病院"],
      "memo": "..."
    }
  ],
  "diaries": [
    {
      "id": "...",
      "date": "YYYY-MM-DD",
      "title": "...",
      "category": "event",
      "tags": ["公園", "友だち"],
      "text": "...",
      "photoDataUrl": "data:image/..."
    }
  ],
  "ui": {
    "continuousGrowthInput": false,
    "largeText": false,
    "theme": "light"
  }
}
```

### 旧データ互換（重要）

- `schemaVersion` がない旧データ（v1/v2）も読み込み可能
- 読み込み時に `category` / `condition` / `tags` が無い項目へデフォルト値を補完
- 既存の `profile`, `growthRecords`, `diaries`, `ui` 構造は維持

## 使い方

1. `index.html` をブラウザで開く
2. 初回はオンボーディングを確認して開始
3. 成長記録/日記にカテゴリ・タグを付けて保存
4. 検索フォームで絞り込み
5. グラフタブで月次レポートを確認
6. 設定タブからJSONバックアップ/復元

## 注意

- ブラウザを変えるとデータは共有されません
- localStorage容量を超えると画像保存に失敗する場合があります
- MVPのため、認証・クラウド同期は未実装です
