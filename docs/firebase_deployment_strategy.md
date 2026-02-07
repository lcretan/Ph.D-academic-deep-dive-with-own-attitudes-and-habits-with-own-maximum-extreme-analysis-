# Veo Studio Pro: Firebase & GCP Deployment Strategy

このドキュメントでは、Google Cloud Platform (GCP) の **Always Free (恒久的な無料枠)** の制約を正確に理解した上で、Veo Studio Pro を最も効率的かつ低コストで運用・公開するための戦略を定義します。

参照: [Google Cloud Free Tier Usage Limits](https://docs.cloud.google.com/free/docs/free-cloud-features?hl=ja#free-tier-usage-limits)

## 1. 訂正: 正確な無料枠クオータ (Always Free)

以前の想定よりも制約が厳しいため、アーキテクチャの工夫が必要です。

| サービス | 無料枠 (月間/恒久) | 制約と対策 |
| :--- | :--- | :--- |
| **Cloud Storage (GCS)** | **5 GB** (Standard) | **最大のボトルネック**。動画データは容量を消費しやすいため、ここを「永続的な倉庫」として使うとすぐに枯渇します。`us-central1` など特定リージョン必須。 |
| **Cloud Firestore** | **1 GB** (Storage) | テキスト/JSONデータなら約100万件以上格納可能で十分ですが、バイナリ(Blob)を入れると即座に溢れます。 |
| **BigQuery** | **10 GB** (Storage)<br>**1 TB** (Query) | JSONネイティブ型をサポート。ログや分析データ、あるいは「コールドデータ（アーカイブ）」の保存先として優秀です。 |
| **Cloud Run** | **200万** リクエスト | バックエンドAPIが必要な場合も、個人利用規模では事実上無制限です。 |
| **Firebase Hosting** | **10 GB** (Storage) | 静的アセット配信。ここが最も容量に余裕があります。 |

---

## 2. 最適化されたシステム設計: "Local-First" 戦略

クラウドの容量制限 (5GB) を回避しつつ、快適な保存・再開体験を提供するために、**「ローカルファースト（IndexedDB）」** を主軸としたハイブリッド構成を採用します。

### 2.1 データフローの定義

1.  **作業領域 (Workspace) = IndexedDB (Browser)**
    *   **役割**: プロジェクトの保存、編集、中断からの再開。
    *   **容量**: デバイスのディスク容量に依存（通常 10GB〜100GB以上）。クラウドの無料枠を気にする必要がありません。
    *   **実装**: 現在の `services/projectService.ts` がこれを担当。リロードしてもデータは消えません。

2.  **公開・共有領域 (Publishing) = Firebase Storage**
    *   **役割**: 完成した作品の公開、他デバイスへの転送。
    *   **戦略**: 全てを同期するのではなく、ユーザーが明示的に「クラウドに保存/共有」したデータのみをアップロードします。
    *   **ライフサイクル**: GCSのライフサイクル設定で「30日経過したファイルを自動削除」などのルールを適用し、5GBの枠を循環させます。

3.  **分析・アーカイブ領域 = Firestore + BigQuery**
    *   **役割**: プロンプトの履歴、生成パラメータの分析。
    *   **戦略**: 動画バイナリを含まない「軽量なプロジェクトメタデータ」のみをFirestoreに同期。これをBigQueryに流し込み、長期分析を行います。

### 2.2 推奨アーキテクチャ図

```mermaid
graph TD
    subgraph "Local Environment (User's Device)"
        Browser[Veo Studio App]
        IDB[(IndexedDB)]
        Browser <-->|Read/Write (Unlimited)| IDB
    end

    subgraph "Google Cloud / Firebase (Free Tier)"
        Hosting[Firebase Hosting] -->|Serves App| Browser
        
        Browser -->|Auth| Auth[Firebase Auth]
        
        Browser -.->|Upload Published Video| GCS[Cloud Storage]
        Note1[Limit: 5GB<br>Region: us-central1<br>Policy: Delete after 30 days] --- GCS
        
        Browser -->|Sync Metadata (JSON)| Firestore[(Firestore)]
        Note2[Limit: 1GB<br>No Binary Data] --- Firestore
        
        Firestore -->|Extension| BQ[BigQuery]
        Note3[Limit: 10GB Storage<br>1TB Query] --- BQ
    end
```

---

## 3. 実践的デプロイメントフロー

### Step 1: Firebase プロジェクトのセットアップ
1.  **プロジェクト作成**: [Firebase Console](https://console.firebase.google.com/) で新規作成。
2.  **プラン変更**: "Blaze" (従量課金) を選択。※無料枠内であれば請求は発生しませんが、GCS等の機能制限解除に必要です。
3.  **Storage設定**:
    *   **重要**: ロケーションは必ず **`us-central1`** (アイオワ) 等の [Free Tier対象リージョン](https://cloud.google.com/free/docs/free-cloud-features#storage) を選択してください。`asia-northeast1` (東京) は無料枠対象外です。

### Step 2: GCS ライフサイクルルールの設定 (容量爆発の防止)
Google Cloud Console から Cloud Storage バケットの設定を開き、以下のライフサイクルルールを追加します。
*   **Action**: Delete object
*   **Condition**: Age > 30 days (運用に合わせて調整)
*   これにより、古いデータが自動的に削除され、常に5GBの空き容量を確保する運用が可能になります。

### Step 3: デプロイ (GitHub Actions)
既存のリポジトリに対して以下を実行します。

```bash
# 1. ツールインストール
npm install -g firebase-tools

# 2. 初期化
firebase login
firebase init hosting
# - Use existing project
# - Public directory: "dist"
# - Single-page app: Yes
# - Setup GitHub Actions: Yes
```

これにより生成される `.github/workflows/firebase-hosting-merge.yml` によって、`main` ブランチへのプッシュ時に自動的に Firebase Hosting へデプロイされます。

---

## 4. プロジェクト分割 (Project Sharding) についての考察

ユーザー様より提案のあった「プロジェクトを分割して容量を稼ぐ」手法について検討しましたが、**「最もシンプルなフロー」** という観点からは、初期段階では非推奨とします。

*   **理由**: クライアントサイドでの動的なFirebase Configの切り替えは、認証状態の管理やセキュリティルールの複雑化を招きます。
*   **代替案**: まずは「ローカル(IndexedDB)主体」で運用し、どうしても5GBのクラウド容量が足りなくなった段階で、別プロジェクトを作成して手動で接続先を切り替える運用が現実的です。

## 5. 結論

1.  **データ消失対策**: 既に実装済みの **IndexedDB** が最適解です。ブラウザのリロードや再起動に対しても堅牢です。
2.  **公開**: **Firebase Hosting** を利用します。
3.  **クラウド保存**: **Cloud Storage (us-central1)** を利用しますが、あくまで「一時保管・共有用」と位置づけ、ローカル保存を正とします。

この構成により、GCPの強力な機能を活用しつつ、完全に無料でサービスを維持することが可能です。