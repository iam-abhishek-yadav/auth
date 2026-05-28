import UserModel from "../models/user.model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

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

  const accessToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ id: user._id }, config.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Prevents JavaScript access to the cookie
    secure: true, // Ensures the cookie is sent only over HTTPS
    sameSite: "strict", // Prevents the cookie from being sent with cross-site requests
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    message: "User registered successfully.",
    user: {
      username: user.username,
      email: user.email,
    },
    accessToken,
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
