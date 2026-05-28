# Authentication App - Complete Flow

This document outlines the complete flow of the authentication application using Mermaid diagrams.

## 1. System Architecture

```mermaid
graph TB
    Client["Client Application"]
    Server["Express Server<br/>Port 3000"]
    MongoDB["MongoDB<br/>Database"]
    Gmail["Gmail API<br/>Email Service"]

    Client -->|HTTP Requests| Server
    Server -->|Query/Store Data| MongoDB
    Server -->|Send OTP| Gmail
    Gmail -->|Email| Client
```

## 2. User Registration Flow

```mermaid
sequenceDiagram
    Client->>Server: POST /api/v1/auth/register<br/>{username, email, password}

    Server->>MongoDB: Check if user exists
    alt User Already Exists
        Server->>Client: 409 - Username/Email exists
    else New User
        Server->>Server: Hash password (SHA256)
        Server->>MongoDB: Create new User document

        Server->>Server: Generate OTP (6 digits)
        Server->>Server: Hash OTP (SHA256)
        Server->>MongoDB: Store OTP record

        Server->>Gmail: Send email with OTP
        Gmail->>Client: Email delivered

        Server->>Client: 201 - Registration successful
    end
```

## 3. Email Verification Flow

```mermaid
sequenceDiagram
    Client->>Server: GET /api/v1/auth/verify-email<br/>{email, otp}

    Server->>MongoDB: Find OTP record by email
    alt OTP Not Found or Expired
        Server->>Client: 404 - Invalid OTP
    else OTP Found
        Server->>Server: Hash provided OTP
        Server->>Server: Compare hash with stored hash
        alt Hash Mismatch
            Server->>Client: 400 - Invalid OTP
        else Hash Match
            Server->>MongoDB: Update user.verified = true
            Server->>MongoDB: Delete OTP record
            Server->>Client: 200 - Email verified successfully
        end
    end
```

## 4. User Login Flow

```mermaid
sequenceDiagram
    Client->>Server: POST /api/v1/auth/login<br/>{email, password}

    Server->>MongoDB: Find user by email
    alt User Not Found
        Server->>Client: 404 - User not found
    else User Found
        alt Email Not Verified
            Server->>Client: 403 - Email not verified
        else Email Verified
            Server->>Server: Hash provided password
            Server->>Server: Compare with stored hash
            alt Password Mismatch
                Server->>Client: 401 - Invalid credentials
            else Password Match
                Server->>Server: Generate JWT tokens<br/>accessToken: 15m<br/>refreshToken: 7d
                Server->>MongoDB: Create Session with<br/>refreshTokenHash

                Server->>Client: Set refreshToken cookie<br/>(httpOnly, secure)
                Server->>Client: 200 - Login successful<br/>+ accessToken
            end
        end
    end
```

## 5. Get User Profile Flow

```mermaid
sequenceDiagram
    Client->>Server: GET /api/v1/auth/get-me<br/>Authorization: Bearer {accessToken}

    Server->>Server: Extract token from header
    alt No Token
        Server->>Client: 401 - Unauthorized
    else Token Present
        Server->>Server: Verify JWT token
        alt Token Invalid/Expired
            Server->>Client: 401 - Invalid token
        else Token Valid
            Server->>Server: Extract user ID from token
            Server->>MongoDB: Find user by ID
            alt User Not Found
                Server->>Client: 404 - User not found
            else User Found
                Server->>Client: 200 - Return user details
            end
        end
    end
```

## 6. Token Refresh Flow

```mermaid
sequenceDiagram
    Client->>Server: GET /api/v1/auth/refresh-token<br/>(with refreshToken cookie)

    Server->>Server: Extract refreshToken from cookie
    alt No Token
        Server->>Client: 401 - Unauthorized
    else Token Present
        Server->>Server: Verify JWT token
        alt Token Invalid
            Server->>Client: 401 - Invalid token
        else Token Valid
            Server->>Server: Hash refreshToken
            Server->>MongoDB: Find Session with hash<br/>& revoked=false

            alt Session Not Found or Revoked
                Server->>Client: 401 - Invalid refresh token
            else Session Found & Active
                Server->>MongoDB: Find user by ID
                Server->>Server: Generate new tokens<br/>newAccessToken: 15m<br/>newRefreshToken: 7d
                Server->>Server: Hash new refreshToken
                Server->>MongoDB: Update Session with<br/>new refreshTokenHash

                Server->>Client: Set new refreshToken cookie
                Server->>Client: 200 - Return new accessToken
            end
        end
    end
```

## 7. Logout Flow (Single Session)

```mermaid
sequenceDiagram
    Client->>Server: GET /api/v1/auth/logout<br/>(with refreshToken cookie)

    Server->>Server: Extract refreshToken from cookie
    alt No Token
        Server->>Client: 401 - Unauthorized
    else Token Present
        Server->>Server: Hash refreshToken
        Server->>MongoDB: Find Session with hash<br/>& revoked=false

        alt Session Not Found
            Server->>Client: 404 - Session not found
        else Session Found
            Server->>MongoDB: Update Session.revoked = true
            Server->>Client: Clear refreshToken cookie
            Server->>Client: 200 - Logged out successfully
        end
    end
```

## 8. Logout All Sessions Flow

```mermaid
sequenceDiagram
    Client->>Server: GET /api/v1/auth/logout-all<br/>Authorization: Bearer {accessToken}

    Server->>Server: Extract token from header
    alt No Token
        Server->>Client: 401 - Unauthorized
    else Token Present
        Server->>Server: Verify JWT token & extract user ID
        alt Token Invalid
            Server->>Client: 401 - Invalid token
        else Token Valid
            Server->>MongoDB: Find all active Sessions for user
            Server->>MongoDB: Update all Sessions<br/>revoked = true
            Server->>Client: Clear refreshToken cookie
            Server->>Client: 200 - All sessions logged out
        end
    end
```

## 9. Data Models

### User Model

```
{
  _id: ObjectId,
  username: String (unique, required),
  email: String (unique, required),
  password: String (SHA256 hashed, required),
  verified: Boolean (default: false),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### OTP Model

```
{
  _id: ObjectId,
  email: String (required),
  user: ObjectId (references User),
  otpHash: String (SHA256 hashed, required),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Session Model

```
{
  _id: ObjectId,
  user: ObjectId (references User),
  refreshTokenHash: String (SHA256 hashed),
  revoked: Boolean (default: false),
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

## 10. API Endpoints Summary

| Method | Endpoint                     | Description                    | Auth   |
| ------ | ---------------------------- | ------------------------------ | ------ |
| POST   | `/api/v1/auth/register`      | Register new user & send OTP   | ❌     |
| GET    | `/api/v1/auth/verify-email`  | Verify email with OTP          | ❌     |
| POST   | `/api/v1/auth/login`         | Authenticate user & get tokens | ❌     |
| GET    | `/api/v1/auth/get-me`        | Fetch current user profile     | ✅     |
| GET    | `/api/v1/auth/refresh-token` | Refresh access token           | Cookie |
| GET    | `/api/v1/auth/logout`        | Logout current session         | Cookie |
| GET    | `/api/v1/auth/logout-all`    | Logout all sessions            | ✅     |

## 11. Security Features

- ✅ **Password Hashing**: SHA256 algorithm
- ✅ **OTP Hashing**: 6-digit OTP hashed before storage
- ✅ **JWT Tokens**: 15-minute access token, 7-day refresh token
- ✅ **Refresh Token Hash**: Tokens hashed in database
- ✅ **HttpOnly Cookies**: Refresh token stored as httpOnly cookie
- ✅ **HTTPS Secure Cookies**: Secure flag enabled
- ✅ **CORS Protection**: SameSite strict cookie policy
- ✅ **Session Management**: Active session tracking with revocation
- ✅ **Email Verification**: OTP-based email verification

## 12. Tech Stack

- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT + Session Management
- **Email**: Gmail API
- **Logging**: Morgan
- **Hashing**: Node.js crypto module
