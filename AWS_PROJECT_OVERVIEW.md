# Market Pulse - AWS Architecture & Code-Level Justifications

This document explains **why each AWS service is required based directly on the actual codebase** (`CampaignsPage`, `ProductsPage`, `CustomersPage`, `InteractionsPage`, `AnalyticsPage`, and relational tables in `supabase/migrations`).

---

## 1. What This Project Is & Why It Exists

### Core Purpose
**Market Pulse** is a centralized **Omnichannel Marketing Intelligence & Campaign ROI Tracking Platform**. 

In modern businesses, marketing happens across fragmented platforms (Google Ads, Social Media, Email, Retail In-store events). Businesses struggle to answer one fundamental question:
> *"Which specific marketing campaign and channel actually drove this customer to buy our product, and are we making or losing money on our advertising budget?"*

**Market Pulse solves this by connecting marketing expenditure to actual customer revenue.**

---

### Key Capabilities & Real-World Workflow

- **1. Centralized Product Catalog (`ProductsPage.tsx`):**
  - Manages the company's offerings across categories (Software, Hardware, Subscriptions).
  - Tracks unit prices, status (active/inactive), and creation dates.
  - Allows bulk operations and instant CSV data export.

- **2. Campaign Budget & Expense Management (`CampaignsPage.tsx`):**
  - Marketing teams create campaigns tied to specific products with strict budget limits and scheduled run dates.
  - Tracks real-time **Budget vs. Spent** with interactive progress bars.
  - Visual indicators show campaign operational state (`active`, `paused`, `completed`).

- **3. Omnichannel Marketing Channels (`ChannelsPage.tsx`):**
  - Tracks marketing touchpoints categorized as:
    - **Online Channels:** Google Ads, Email Newsletters, Social Media, Search SEO.
    - **Offline Channels:** Billboard Ads, Print Media, Retail In-store Promotions.

- **4. Customer Directory & Segmentation (`CustomersPage.tsx`):**
  - Maintains customer profiles including contact details, multiple phone numbers, physical locations, and registration dates.
  - Acts as the single source of truth for customer identity across all channels.

- **5. Revenue Attribution & Interaction Logging (`InteractionsPage.tsx`):**
  - The heartbeat of the database: records every single touchpoint (`click`, `visit`, `purchase`).
  - **Relational Attribution:** Every interaction joins **5 key dimensions**:
    $$\text{Customer} \xrightarrow{\text{interacted via}} \text{Channel} \xrightarrow{\text{as part of}} \text{Campaign} \xrightarrow{\text{for}} \text{Product} \xrightarrow{\text{resulting in}} \text{Revenue (\$) }$$
  - Provides instant filtering by event type and one-click audit CSV export.

- **6. Executive Dashboard & Analytical Intelligence (`DashboardPage.tsx`, `AnalyticsPage.tsx`):**
  - **Live Executive KPIs:** Total Revenue, Active Campaigns Count, Total Customer Reach, Total Touchpoints.
  - **Revenue Over Time:** Interactive area graphs showing monthly revenue trends.
  - **Channel Effectiveness:** Breakdown charts illustrating which channel produces the highest conversion rate (e.g., Email at 4.75% vs. Social at 1.8%).
  - **Campaign Performance:** Compares historical campaign returns to optimize upcoming ad spend.

---

## 2. Exact Code-Level Reason for Each AWS Service

| # | AWS Service | File / Feature in Your Code | Concrete Reason in THIS Project (Code-Driven) |
|---|-------------|-----------------------------|-----------------------------------------------|
| **1** | **Amazon S3** | `package.json` (`vite build`) & `dist/` output | Your project is a Vite Single Page Application (SPA). S3 holds the compiled static bundle (`index.html`, chunked JS, assets) without paying for an idle EC2 server. |
| **2** | **Amazon CloudFront** | `src/App.tsx` (React Router `/products`, `/campaigns`, `/analytics`) | CloudFront routes global traffic to S3 with HTTPS and provides SPA fallback error routing (`404 -> /index.html`) so client-side React Router works cleanly on page refreshes. |
| **3** | **AWS Cognito** | `src/components/AppLayout.tsx`, User Sessions | Currently, anyone can add or delete products and campaigns (Row Level Security is open). Cognito provides JWT authentication for marketing managers so only authorized users can mutate campaign budgets or customer records. |
| **4** | **Amazon API Gateway** | `src/hooks/use-*.ts` (`useCampaigns`, `useProducts`, etc.) | Provides the unified REST API interface (`/api/v1/campaigns`, `/api/v1/analytics`, `/api/v1/interactions/export`) that the frontend calls, validating Cognito JWTs and routing to Lambda. |
| **5** | **AWS Lambda** | `handleAdd` in `CampaignsPage.tsx`, CSV export in `InteractionsPage.tsx` | Executes backend business logic: validating campaign budgets against product prices, aggregating revenue sums for Dashboard, and serverless background export triggers. |
| **6** | **Amazon Aurora Serverless / RDS PostgreSQL (or DynamoDB)** | `supabase/migrations/*.sql` (`products`, `campaigns`, `customers`, `channels`, `interactions`) | Your data model relies on foreign keys (`customer_id`, `product_id`, `campaign_id`, `channel_id`) and relational joins (`i.customers.name`, `i.products.name`). AWS RDS/Aurora PostgreSQL hosts these exact SQL schemas and triggers. |
| **7** | **Amazon SNS (Simple Notification Service)** | `src/pages/CampaignsPage.tsx` (`spent / budget * 100`) | In `CampaignsPage`, campaigns track budget vs. spent. When `spent >= budget` (or reaches 90%), Lambda publishes an event to an SNS Topic to instantly alert marketing managers via Email/SMS. |
| **8** | **Amazon SQS (Simple Queue Service)** | `src/pages/InteractionsPage.tsx` (`type: 'purchase' | 'click' | 'visit'`) | High-traffic click and visit telemetry would overwhelm the database if written synchronously. Telemetry calls are pushed to SQS as a buffer and processed in batches by Lambda. |
| **9** | **AWS Lambda EventBridge (Scheduled Crons)** | `src/pages/AnalyticsPage.tsx` (`Revenue Over Time`, `Monthly Metrics`) | Aggregating monthly revenue and best channel conversion over thousands of interaction rows is heavy. EventBridge runs a scheduled nightly Lambda to pre-compute analytics data. |
| **10** | **AWS IAM (Identity and Access Management)** | Backend execution & AWS SDK clients | Restricts the Lambda function running the export to only have write permissions to the export S3 bucket, and read-only access to the database credentials. |
| **11** | **AWS Systems Manager (SSM) Parameter Store** | `src/integrations/supabase/client.ts` (`VITE_SUPABASE_URL`, API Keys) | Replaces client-side exposed secrets with secure backend configuration storage, keeping database connection strings and sensitive credentials safe. |
| **12** | **Amazon CloudWatch** | All `useMutation` hooks (`useAddCampaign`, `useAddCustomer`, `useDeleteProduct`) | Logs API errors, tracks p95 latency on analytical endpoints, and fires an alert if database transaction failures exceed threshold. |
| **13** | **AWS X-Ray** | Dashboard aggregation in `DashboardPage.tsx` (`useInteractions` + `useCampaigns` + `useCustomers`) | `DashboardPage` fetches multiple hooks concurrently. X-Ray traces the call tree from API Gateway through Lambda down to the database to pinpoint query bottlenecks. |
| **14** | **AWS CodePipeline / GitHub Actions + CodeBuild** | `package.json` (`npm run lint`, `npm run test`, `npm run build`) | Automated CI/CD: runs Vitest unit tests, validates ESLint, builds the Vite production distribution, and syncs directly to the S3 bucket. |

---

## 3. Reviewer Defense: Why These Specific Services for Market Pulse?

### Q: Why did you include SQS and SNS in a marketing platform?
> *"In Market Pulse, `CampaignsPage` tracks budget exhaustion. When spent reaches budget limits, SNS pushes instant alerts to stakeholders. Simultaneously, `InteractionsPage` captures high-volume customer events (clicks, visits). We use SQS to decouple event ingestion from database writes so user clicks never experience UI lag."*

### Q: Why do you need S3 and CloudFront for a Vite React app?
> *"Vite builds static HTML, JavaScript chunks, and CSS assets. S3 provides zero-maintenance, high-availability object storage. CloudFront acts as the CDN to cache these assets globally and solve client-side SPA routing (`/analytics`, `/campaigns`) without 404 errors."*

### Q: Why not keep Supabase instead of AWS services?
> *"For a dedicated AWS deployment and cloud evaluation, replacing third-party managed services with native AWS services (RDS PostgreSQL / Aurora + Cognito + API Gateway) provides full visibility, custom VPC security controls, CloudWatch monitoring, and single-cloud governance."*
