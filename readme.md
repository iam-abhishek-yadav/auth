# Gmail OAuth2 Setup Guide

This guide walks you through setting up Gmail OAuth2 credentials for email authentication in your application.

## Step 1: Set Up Google Cloud Project

### 1.1 Create Project in Google API Console

1. Navigate to the [Google API Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one

### 1.2 Enable Gmail API

1. Go to the **Library** section
2. Search for **Gmail API** and enable it

### 1.3 Create OAuth2 Credentials

1. Navigate to the **Credentials** section
2. Click **Create Credentials** → **OAuth 2.0 Client IDs**
3. Set the application type to **Web application**
4. Under **Authorized redirect URIs**, add:
   - `http://localhost`
   - `https://developers.google.com/oauthplayground`
   - (or your application's URL)
5. Save your **ClientID** and **ClientSecret** for later use

## Step 2: Generate Refresh Token

### 2.1 Access OAuth 2.0 Playground

1. Open the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) in your browser

### 2.2 Configure Playground Settings

1. Click the gear icon (⚙️) in the top-right corner
2. Select **Use your own OAuth credentials** under OAuth 2.0 endpoints
3. Enter your **ClientID** and **ClientSecret**
4. Set **Access type** to **Offline** (to obtain a refresh token)

### 2.3 Select Gmail Scopes

1. In Step 1 on the left panel, select the appropriate scopes
2. For Gmail access, choose: `https://mail.google.com/`

### 2.4 Authorize & Exchange Tokens

1. Click **Authorize APIs** and grant permissions
2. After authorization, click **Exchange authorization code for tokens**
3. This generates your access token and refresh token

### 2.5 Save Refresh Token

1. Copy your refresh token from Step 2 response
2. Add it to your `.env` file
