# CloudClass — AWS Deployment Manual

This guide walks you through deploying **CloudClass** on **Amazon Web Services (AWS)** using standard AWS services:
- **Compute**: AWS Elastic Beanstalk, AWS App Runner, or AWS EC2
- **File Storage**: Amazon S3 (for student assignment uploads & presigned downloads)
- **Database**: Amazon RDS (Oracle / PostgreSQL) running the [PL/SQL schema](file:///d:/cloudclass_realtime/database/schema.sql)
- **Identity & Security**: JSON Web Tokens (JWT) & AWS IAM Role Policies

---

## 1. Prerequisites & AWS S3 Bucket Setup

### Step 1: Create an S3 Bucket
1. Open the [AWS S3 Console](https://s3.console.aws.amazon.com/).
2. Click **Create bucket**.
3. Choose a globally unique name (e.g., `cloudclass-submissions-yourname`).
4. Select your preferred AWS Region (e.g., `us-east-1`).
5. Keep **Block all public access** checked (files are accessed securely via backend presigned URLs).
6. Click **Create bucket**.

### Step 2: Configure S3 CORS (Cross-Origin Resource Sharing)
Under the **Permissions** tab of your bucket, scroll to **Cross-origin resource sharing (CORS)** and paste:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### Step 3: Create an IAM Policy / Access Keys
If deploying on a local server or external host, create an IAM User with this policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::cloudclass-submissions-yourname/*"
    }
  ]
}
```
*(If hosting inside AWS EC2, Elastic Beanstalk, or ECS, assign this policy directly to the instance's IAM Role — no hardcoded API keys needed!)*

---

## 2. Deployment Options

### Option A: AWS Elastic Beanstalk (Recommended & Fastest)

AWS Elastic Beanstalk manages capacity provisioning, load balancing, and scaling automatically.

1. Install the Elastic Beanstalk CLI:
   ```bash
   pip install awsebcli
   ```
2. Initialize your Beanstalk application in the project root:
   ```bash
   eb init -p node.js cloudclass-app --region us-east-1
   ```
3. Create an environment and deploy:
   ```bash
   eb create cloudclass-env
   ```
4. Set your environment variables:
   ```bash
   eb setenv PORT=8000 JWT_SECRET="your-secure-secret-key" AWS_REGION="us-east-1" AWS_S3_BUCKET="cloudclass-submissions-yourname"
   ```
5. Open your live application:
   ```bash
   eb open
   ```

---

### Option B: AWS App Runner (Serverless Container)

AWS App Runner provides automated container builds directly from GitHub or Docker:

1. Push your repository to GitHub.
2. Go to the [AWS App Runner Console](https://console.aws.amazon.com/apprunner/).
3. Click **Create an App Runner service**.
4. Choose **Source code repository** and connect your GitHub repo.
5. Configure build settings:
   - **Runtime**: `Nodejs 20` (or choose Docker using our provided [`Dockerfile`](file:///d:/cloudclass_realtime/Dockerfile))
   - **Build command**: `npm install`
   - **Start command**: `node server.js`
   - **Port**: `8000`
6. Add Environment Variables:
   - `AWS_REGION`: `us-east-1`
   - `AWS_S3_BUCKET`: `cloudclass-submissions-yourname`
   - `JWT_SECRET`: `your-random-production-secret`
7. Click **Create & Deploy**. AWS App Runner will provide a secure HTTPS URL with automated SSL certificates!

---

### Option C: AWS EC2 (Virtual Machine) with PM2 & NGINX

1. Launch an Ubuntu 22.04 LTS instance (t3.micro or t3.small).
2. SSH into your instance:
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-public-ip
   ```
3. Install Node.js 20 & Git:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
4. Clone and set up CloudClass:
   ```bash
   git clone <your-repo-url> cloudclass
   cd cloudclass
   npm install
   ```
5. Configure `.env`:
   ```bash
   cp .env.example .env
   nano .env
   ```
6. Start with PM2 Process Manager:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name cloudclass
   pm2 startup
   pm2 save
   ```
7. Configure NGINX reverse proxy to route port 80/443 to `http://localhost:8000`.

---

## 3. Database Deployment: Amazon RDS (Oracle Database)

CloudClass includes a complete PL/SQL relational database designed for Oracle.

1. In the [AWS RDS Console](https://console.aws.amazon.com/rds/), click **Create database**.
2. Select **Oracle** (Oracle Database Standard Edition Two or Free Tier compatible).
3. Set your DB Instance identifier (e.g. `cloudclass-db`).
4. Set Master username (e.g. `admin`) and master password.
5. In Connectivity, choose your VPC and allow inbound port `1521` from your EC2 / Beanstalk security group.
6. Once provisioned, connect using **Oracle SQL Developer**:
   - **Host Name**: RDS Endpoint (e.g., `cloudclass-db.cxxxx.us-east-1.rds.amazonaws.com`)
   - **Port**: `1521`
   - **SID / Service Name**: `ORCL`
7. Run the master script:
   ```sql
   @@database/init_all.sql
   ```
8. All 9 tables, packages (`PKG_AUTH`, `PKG_ASSIGNMENT`, `PKG_SUBMISSION`), triggers, views, and seed data will be compiled on your AWS RDS instance.

---

## 4. Local Development & Testing

Run locally before deploying to AWS:

```bash
# 1. Install dependencies
npm install

# 2. Run the AWS server
npm start
```

Visit `http://localhost:8000` in your web browser.

*Even without AWS credentials, the server will gracefully save uploads to local `./uploads` until AWS S3 keys are populated!*
