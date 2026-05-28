import UserModel from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import Session from "../models/session.model.js";
import OTP from "../models/otp.models.js";
import { sendEmail } from "../service/email.service.js";
import { generateOTP, generateOtpHtml } from "../utils/utils.js";

export async function register(req, res) {
  const { username, email, password } = req.body;

  const isAlreadyRegistered = await UserModel.findOne({
    $or: [{ username }, { email }],
  });

  if (isAlreadyRegistered) {
    return res.status(409).json({
      message: "Username or email already exists.",
    });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  const user = await UserModel.create({
    username,
    email,
    password: hashedPassword,
  });

  const otp = generateOTP();
  const html = generateOtpHtml(otp);

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  await OTP.create({
    email,
    user: user._id,
    otpHash,
  });

  await sendEmail(
    email,
    "Your OTP for Email Verification",
    `Your OTP is: ${otp}`,
    html,
  );

  res.status(201).json({
    message: "User registered successfully.",
    user: {
      username: user.username,
      email: user.email,
      verified: user.verified,
    },
  });
}

export async function getMe(req, res) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized. No token provided.",
    });
  }

  const decoded = jwt.verify(token, config.JWT_SECRET);

  const user = await UserModel.findById(decoded.id);

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
    });
  }

  res.status(200).json({
    message: "User details fetched successfully.",
    user: {
      username: user.username,
      email: user.email,
    },
  });
}

export async function refreshToken(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Unauthorized. No refresh token provided.",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await Session.findOne({
      refreshTokenHash,
      revoked: false,
    });

    if (!session) {
      return res.status(401).json({
        message: "Invalid refresh token.",
      });
    }

    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const newAccessToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
      expiresIn: "15m",
    });

    const newRefreshToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
      expiresIn: "7d",
    });

    const newRefreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    session.refreshTokenHash = newRefreshTokenHash;
    await session.save();

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true, // Prevents JavaScript access to the cookie
      secure: true, // Ensures the cookie is sent only over HTTPS
      sameSite: "strict", // Prevents the cookie from being sent with cross-site requests
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: "Access token refreshed successfully.",
      accessToken: newAccessToken,
    });
  } catch (error) {
    res.status(401).json({
      message: "Invalid refresh token.",
    });
  }
}

export async function logout(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Unauthorized. No refresh token provided.",
    });
  }

  try {
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const session = await Session.findOne({
      refreshTokenHash,
      revoked: false,
    });

    if (!session) {
      return res.status(404).json({
        message: "Session not found.",
      });
    }

    session.revoked = true;
    await session.save();

    res.clearCookie("refreshToken");

    res.status(200).json({
      message: "User logged out successfully.",
    });
  } catch (error) {
    res.status(401).json({
      message: "Invalid refresh token.",
    });
  }
}

export async function logoutAll(req, res) {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({
      message: "Unauthorized. No refresh token provided.",
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);

    await Session.updateMany(
      { userId: decoded.id, revoked: false },
      { revoked: true },
    );

    res.clearCookie("refreshToken");

    res.status(200).json({
      message: "User logged out from all sessions successfully.",
    });
  } catch (error) {
    res.status(401).json({
      message: "Invalid refresh token.",
    });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials.",
    });
  }

  if (!user.verified) {
    return res.status(403).json({
      message:
        "Email not verified. Please verify your email before logging in.",
    });
  }

  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");

  if (hashedPassword !== user.password) {
    return res.status(401).json({
      message: "Invalid credentials.",
    });
  }

  const refreshToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  const refreshTokenHash = crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  const session = await Session.create({
    userId: user._id,
    refreshTokenHash,
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "Unknown",
  });

  const accessToken = jwt.sign(
    { id: user._id, sessionId: session._id },
    config.JWT_SECRET,
    {
      expiresIn: "15m",
    },
  );

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevents JavaScript access to the cookie
    secure: true, // Ensures the cookie is sent only over HTTPS
    sameSite: "strict", // Prevents the cookie from being sent with cross-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json({
    message: "User logged in successfully.",
    user: {
      username: user.username,
      email: user.email,
    },
    accessToken,
  });
}

export async function verifyEmail(req, res) {
  const { email, otp } = req.body;

  const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

  const otpRecord = await OTP.findOne({ email, otpHash });

  if (!otpRecord) {
    return res.status(400).json({
      message: "Invalid OTP.",
    });
  }

  const user = await UserModel.findById(otpRecord.user);

  if (!user) {
    return res.status(404).json({
      message: "User not found.",
    });
  }

  user.verified = true;
  await user.save();

  await OTP.deleteMany({ email });

  res.status(200).json({
    message: "Email verified successfully.",
  });
}
