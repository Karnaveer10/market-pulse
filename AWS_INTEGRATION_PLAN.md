# MarketPulse AWS Integration Plan & Real-Time Metrics Pipeline

This plan outlines the architecture, end-to-end data flow, and implementation steps for connecting **MarketPulse** to AWS services. It covers two distinct ingestion pipelines:
1. **Online Real-Time Pipeline**: Capturing live click/visit/purchase events with sub-second metric recalculation.
2. **Offline Batch Pipeline**: Uploading Excel/CSV spreadsheets of offline interactions (retail POS, print ads, event leads) with automated S3-triggered processing.

---

## 1. High-Level Architecture Overview

```mermaid
flowchart TD
    subgraph Client_Layer ["Client & Frontend (React/Vite)"]
        UI_Online["Online User Action (Click / Visit / Purchase)"]
        UI_Upload["Offline File Upload (Excel / CSV)"]
        UI_Dashboard["Live Analytics Dashboard & Metric Cards"]
    end

    subgraph AWS_Online_Stream ["Online Ingestion & Streaming Flow"]
        APIGW["Amazon API Gateway (REST / HTTP API)"]
        SQS["Amazon SQS (Event Buffer Queue)"]
        Lambda_Stream["AWS Lambda (Metric Worker & Attribution Engine)"]
        Dynamo_Cache["Amazon DynamoDB / ElastiCache (Live Counter Cache)"]
        SNS["Amazon SNS (Budget Exhaustion / Milestone Alerts)"]
    end

    subgraph AWS_Offline_Batch ["Offline Batch Ingestion Flow"]
        S3_Bucket["Amazon S3 Bucket (raw-offline-imports/)"]
        EventBridge["Amazon EventBridge / S3 Notification"]
        Lambda_Batch["AWS Lambda (Excel Parser & Batch Inserter)"]
    end

    subgraph AWS_Storage_Layer ["Unified Database & Storage Layer"]
        RDS_PG["Amazon RDS / Aurora PostgreSQL (Core Relational DBMS)"]
        CloudWatch["Amazon CloudWatch (Logs & Metric Alarms)"]
    end

    %% Online connections
    UI_Online -->|POST /api/v1/events| APIGW
    APIGW -->|Enqueue| SQS
    SQS -->|Batch triggers| Lambda_Stream
    Lambda_Stream -->|ACID Insert/Upsert| RDS_PG
    Lambda_Stream -->|Atomic Increment (O(1))| Dynamo_Cache
    Lambda_Stream -->|Check budget >= 90%| SNS
    Dynamo_Cache -.->|Real-time Poll / WebSocket / SSE| UI_Dashboard

    %% Offline connections
    UI_Upload -->|Pre-signed URL PUT| S3_Bucket
    S3_Bucket -->|ObjectCreated event| EventBridge
    EventBridge -->|Invoke| Lambda_Batch
    Lambda_Batch -->|Parse & bulk insert| RDS_PG
    Lambda_Batch -->|Recalculate aggregated metrics| Dynamo_Cache
    Dynamo_Cache -.->|Updated stats| UI_Dashboard
```

---

## 2. Ingestion Pipelines: Step-by-Step

### A. Online Real-Time Ingestion (Web / E-Commerce / Ads)
1. **Event Trigger**: A customer clicks a link, visits a landing page, or completes a purchase in your store or campaign channel.
2. **Ingestion Endpoint**: Frontend triggers `POST /api/v1/interactions` to **Amazon API Gateway**.
3. **Queue Buffering (Amazon SQS)**:
   - Instead of writing directly to PostgreSQL (which creates connection bottlenecks under ad traffic spikes), API Gateway forwards messages directly to an **Amazon SQS FIFO/Standard queue**.
4. **Stream Processing (AWS Lambda)**:
   - Lambda consumes batches (e.g., 20 events per batch).
   - Joins `Customer`, `Channel`, `Campaign`, and `Product`.
   - Performs database write to **Amazon Aurora / RDS PostgreSQL** (the permanent relational system of record).
   - Atomically updates live aggregations in **Amazon DynamoDB** (e.g., `campaign_spent`, `channel_revenue`, `today_conversions`).
5. **Alerts & Thresholds (Amazon SNS)**:
   - If `campaign_spent >= campaign_budget`, Lambda immediately publishes to an **Amazon SNS Topic**, sending email/SMS alerts to marketing managers.
6. **Real-Time Client Reflection**:
   - The dashboard updates live counters via periodic short-polling or WebSocket/SSE, showing immediate visual progress bars moving and KPIs bumping.

---

### B. Offline Batch Ingestion (In-Store POS / Excel / Billboards)
1. **File Upload**: A retail manager selects an Excel file (`.xlsx` or `.csv`) on the **Data Import** screen.
2. **Direct to Amazon S3**:
   - The browser requests a temporary **S3 Pre-signed URL** via API Gateway, keeping file streams off the app server.
   - The browser uploads the Excel directly to `s3://marketpulse-imports/raw/`.
3. **Automated Event (EventBridge / S3 Trigger)**:
   - S3 fires an `ObjectCreated` event triggering **AWS Lambda (Batch Ingestion Worker)**.
4. **Excel Processing & Normalization**:
   - Lambda reads the spreadsheet using `xlsx`/`exceljs`.
   - Validates required columns: `Customer Identifier`, `Store/Channel Name`, `Campaign Tag`, `Product SKU`, `Revenue`, `Date`.
   - Maps offline retail data to existing relational IDs.
5. **Bulk Insert & Metric Refresh**:
   - Executes an SQL `COPY` or parameterized batch `INSERT` into RDS PostgreSQL.
   - Refreshes cached metrics for all affected campaigns and channels.
   - Creates an upload audit log (`filename`, `rows_imported`, `total_revenue`, `status: completed`).

---

## 3. Real-Time Metric Calculation Logic

### Key Metrics & Update Mechanics
| Metric | Calculation Formula | Online Trigger | Offline Update Mode |
|---|---|---|---|
| **Total Revenue** | $\sum \text{interaction.revenue}$ | Immediate atomic increment ($+\$X$) | Batch sum upon spreadsheet commit |
| **Campaign ROI** | $\frac{\text{Revenue Generated} - \text{Campaign Budget}}{\text{Campaign Budget}} \times 100\%$ | Recalculated on purchase event | Recalculated after bulk import |
| **Budget Burn Rate** | $\frac{\text{Spent}}{\text{Budget}} \times 100\%$ | Incremented with every paid click/ad impression | Updated if offline media expenses are loaded |
| **Channel Conversion Rate** | $\frac{\text{Purchases}}{\text{Visits} + \text{Clicks}} \times 100\%$ | Recalculated in real time per channel | Aggregated with POS offline sales |

---

## 4. Implementation Phases

### Phase 1: Interactive UI Simulator & Offline Uploader
- Implement an interactive **"Live Traffic Simulator / Stream"** toolbar right inside the UI to let you and your evaluators click "Simulate Purchase" or "Simulate Click Stream" and watch metrics flash, charts increment, and logs update in real time.
- Implement an **"Upload Offline Excel / CSV"** modal dialog with downloadable templates, immediate client parsing preview, and database/store ingestion.

### Phase 2: AWS Backend Templates & Scripts
- Provide ready-to-deploy Infrastructure-as-Code (Terraform / AWS CDK or Serverless framework) and Lambda handlers (`stream-processor.js`, `excel-importer.js`, `presigned-url.js`).

### Phase 3: Real-Time Sync & WebSocket/Polling
- Wire up automatic state updates so that every incoming stream event pushes updates directly to the Dashboard and Analytics pages.
