# AWS Setup for RetailPulse AI

This guide is written for your current setup:

- Windows PowerShell and VS Code
- AWS CLI v2 is installed
- Your CLI is already logged in as your IAM user
- Your CLI output showed the default Region as `us-east-1`
- You are creating the FastAPI backend yourself and will use Amazon Bedrock instead of Azure OpenAI

The goal here is to find the AWS settings your backend needs. You do **not** need to copy AWS access keys into `.env`.

## Important difference from Azure OpenAI

The tutorial's Azure settings look like this:

```dotenv
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT_NAME=...
AZURE_OPENAI_API_VERSION=...
```

Amazon Bedrock does not use this same endpoint/key/deployment pattern for the normal AWS SDK setup:

- **AWS Region** tells the AWS SDK where to call Bedrock.
- **Bedrock model ID** tells Bedrock which foundation model to invoke.
- **AWS credentials** come from your existing AWS CLI login while developing locally.
- When deployed to EC2, credentials should come from the EC2 IAM role.

So, the application `.env` will eventually contain configuration like Region and model ID, but **not** an AWS access key, secret key, or session token.

## Step 1 — Confirm the current AWS login

Open the VS Code terminal or PowerShell. Run:

```powershell
aws configure list
aws sts get-caller-identity
```

Your earlier output showed:

- `profile: <not set>` — the CLI is using its default login, not a named profile.
- Access key type `login` — AWS CLI's browser-based `aws login` session supplies temporary credentials.
- Region `us-east-1` — this is the current default Region.
- The identity ARN is an IAM user, not the root user.

The `aws configure list` output masks the key values. Continue to keep credentials private. Avoid sharing the full `get-caller-identity` output publicly because it contains your account ID and username.

If these commands still work, **do not run `aws configure` again and do not create another login profile just for the application**. The AWS SDK for Python can use the current AWS CLI login credentials. The login session is temporary and the CLI refreshes it for a limited session; if it expires, sign in again using:

```powershell
aws login
```

Complete the browser sign-in as your IAM user, then verify again with:

```powershell
aws sts get-caller-identity
```

This uses your current local IAM-user login. Do not use root credentials or create root access keys. Do not place the IAM user's access keys in the project.

## Step 2 — Confirm the Region you will use

Check the Region configured for the current CLI:

```powershell
aws configure get region
```

Your current setting is `us-east-1`. You can keep it for the first setup, as long as Bedrock offers the model you choose in that Region. The console and backend must use the same Region for model discovery and invocation.

The `Python/3.14.6` text in `aws --version` is part of the AWS CLI installation. It is not the Python version used by your FastAPI application. Your backend continues to use its own UV environment.

## Step 3 — Find a Bedrock model ID in the AWS console

1. Sign in to the AWS console using the same account as your CLI identity.
2. Select **US East (N. Virginia) / `us-east-1`** in the Region selector, or use the Region you confirmed in Step 2.
3. Search for **Amazon Bedrock**, then open the Bedrock console.
4. Open **Model catalog**. Browse models that are available in your selected Region.
5. Choose a model suitable for a small project demo. Before using it, read its model details, input/output pricing, supported features, and any provider terms.
6. Note the exact **Model ID** shown by AWS. The model ID is a configuration value, not a password. Do not guess it from a tutorial or copy an Azure deployment name.
7. Check whether the account requires extra model access or a first-use form. Requirements vary by model and account. A model appearing in the catalog does not necessarily mean every invocation will succeed.
8. If the console provides a playground, you may use it for a small non-sensitive test after reviewing the price. You do not need to configure your application yet.

If the model catalog or invocation is denied, stop and check the account permissions, selected Region, model prerequisites, and course account limitations. Do not try to solve an access-denied error by attaching unrestricted administrator access.

## Step 4 — Record the values your backend will need

For local development, the values to record are:

| Setting | Value to use | Where it comes from |
|---|---|---|
| `AWS_DEFAULT_REGION` | `us-east-1` if you keep the current Region | Your CLI configuration / AWS console Region |
| `BEDROCK_MODEL_ID` | The exact model ID you selected | Amazon Bedrock Model catalog |
| AWS login credentials | Do not put these in `.env` | Already supplied locally by AWS CLI login |
| `AWS_PROFILE` | Not required for your current default login | Only set this if you later create and intentionally use a named profile |

You do **not** need to add the AWS account ID to `.env` for normal SDK calls. The SDK gets the active account from its credentials.

## Step 5 — Create/update the local `.env` safely

Create `.env` in the **Backend project directory**, beside its `pyproject.toml`. Use VS Code to edit it. For now, add only non-secret settings:

```dotenv
# AWS settings for local development
AWS_DEFAULT_REGION=us-east-1
BEDROCK_MODEL_ID=replace-with-the-exact-model-id-from-the-bedrock-console
```

Replace the model placeholder with the exact ID you found. If you choose another Region, change `AWS_DEFAULT_REGION` to match it.

Do not add any of these to `.env`:

```dotenv
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_SESSION_TOKEN=
```

Your existing AWS CLI login supplies temporary credentials outside the project. The `.env` file contains application configuration, not AWS login credentials.

One important detail: Python does **not** automatically read a `.env` file just because the file exists. When you implement app settings, load these values through the settings library you choose (the tutorial already lists `python-dotenv`, or you can use Pydantic Settings). Then pass the loaded Region explicitly when creating the Boto3 client. Boto3 can discover credentials from your AWS CLI login, but it does not read arbitrary application `.env` files by itself.

### Confirm `.env` is ignored by Git

From the repository root, check whether Git ignores the Backend `.env`:

```powershell
git check-ignore Backend/.env
```

Your folder may appear as `backend` or `Backend`; use its actual name. If the command prints the path, it is ignored. If it prints nothing, add these patterns to the repository `.gitignore` before putting any sensitive value in `.env`:

```gitignore
.env
.env.*
!.env.example
.venv/
```

Then check again. Keep `.env.example` in Git only if it contains variable names and harmless placeholders—never credentials.

## Step 6 — Do not add a Bedrock key or endpoint

Unlike the Azure OpenAI configuration, your normal Bedrock setup does not require you to create an API key in the Bedrock console or place a fixed Bedrock endpoint in `.env`. The AWS SDK selects the Bedrock service endpoint using the Region.

When you implement the Bedrock feature:

1. Add the AWS SDK dependency to Backend with UV (for example, `uv add boto3`) when you are ready to write that code.
2. Load `AWS_DEFAULT_REGION` and `BEDROCK_MODEL_ID` from your app configuration.
3. Create a Boto3 Bedrock Runtime client for that Region.
4. Let Boto3 obtain local credentials from your current AWS CLI login.
5. Handle access-denied, throttling, timeout, and model errors explicitly; do not silently return a made-up answer.
6. Send only the relevant project facts to the model. Forecast and inventory calculations should remain in your own backend code.

Do not install Bedrock dependencies just to configure environment variables; add them when you begin the Bedrock implementation.

After adding Boto3, you can test that the Python SDK sees the same local identity without invoking a paid model:

```powershell
uv run python -c "import boto3; print(boto3.client('sts').get_caller_identity()['Arn'])"
```

This calls AWS STS to identify the current caller. Do not share the printed ARN or account details publicly. A successful identity check confirms authentication only; it does not prove that the user has permission to invoke a particular Bedrock model.

## Step 7 — Keep local development and EC2 credentials separate

For development on your own computer, the AWS SDK uses your current CLI login. For the future EC2 deployment, do **not** copy your local AWS credentials or `.aws` files to the server.

On EC2, the backend should receive AWS permissions through an **IAM role attached to the EC2 instance**. That role can later be granted only the required model invocation, S3, Parameter Store, and CloudWatch permissions. The app uses that role automatically through the AWS SDK credential provider.

Your IAM user can be used for your current CLI and console learning, but avoid using an IAM user's long-lived access keys inside the app, containers, GitHub, Jenkins, or EC2. If the user has broad admin permissions, be careful: the app itself still must not use that identity at runtime.

## Step 8 — Basic checks before writing Bedrock code

Run these checks from PowerShell:

```powershell
aws sts get-caller-identity
aws configure get region
```

Verify:

- The caller identity is the AWS account you intend to use.
- The Region is the same one selected in the Bedrock console.
- You recorded the exact model ID.
- `.env` has no AWS keys or tokens and is ignored by Git.
- No AWS resource is being created simply to test local FastAPI startup.

The backend health endpoint does not need AWS access. Keep building and testing the API locally even if Bedrock model access is delayed.

## Common questions

### Should I run `aws configure`?

Not for your current setup. Your CLI already reports credential type `login`, and `aws sts get-caller-identity` succeeds. `aws configure` is primarily used to set up a profile from access-key credentials and could change settings you already have working. Continue with the existing login.

### Should I set `AWS_PROFILE` in `.env`?

No. Your CLI output says the profile is not set, so the default login is being used. Leave `AWS_PROFILE` out for now. If you later create a named profile, select it deliberately and use that same profile for both CLI tests and local application execution.

### Is `us-east-1` definitely the right Region?

It is the Region currently configured in your CLI. Keep it if your chosen Bedrock model is available there and your other project services support it. If you change Region, update the AWS CLI/default application config and `.env` consistently. S3 buckets and service resources are Region-specific or have Region-dependent behavior.

### Where do MongoDB and Databricks credentials go?

They are separate from AWS CLI authentication. Add their application settings only when you implement those integrations, keep database secrets out of Git, and do not mix Databricks workspace credentials with AWS credentials. An Azure-hosted Databricks workspace remains hosted on Azure even if you use AWS for the application.

### What if I get `AccessDeniedException` from Bedrock?

Check the AWS account, Region, model ID, IAM permissions for invoking that model, and any model-specific prerequisites. Do not print or share secrets, and do not broaden permissions without first identifying the denied action.

## Official documentation

- [AWS CLI login with console credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html)
- [Boto3 credential providers](https://docs.aws.amazon.com/boto3/latest/guide/credentials.html)
- [Amazon Bedrock model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Amazon Bedrock model IDs and Regions](https://docs.aws.amazon.com/bedrock/latest/userguide/foundation-models-reference.html)
- [AWS IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
