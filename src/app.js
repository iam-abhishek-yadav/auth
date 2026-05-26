import express from "express";
import morgan from "morgan";
import authRouter from "./routes/auth.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.use("/api/v1/auth", authRouter);

export default app;
