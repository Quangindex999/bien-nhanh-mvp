import "dotenv/config";
import express from "express";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import apiRoutes from "./src/routes/apiRoutes.js";

/* ── Resolve __dirname for ESM ── */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/* ── App bootstrap ── */
const app = express();
const PORT = process.env.PORT ?? 3000;

/* ── Middleware ── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Static files ── */
app.use(express.static(join(__dirname, "public")));

/* ── API routes ── */
app.use("/api", apiRoutes);

/* ── Serve Vite production build ── */
const distPath = join(__dirname, "dist");
const distExists = fs.existsSync(distPath);

if (distExists) {
  app.use(express.static(distPath));
} else {
  console.warn("Thư mục dist chưa tồn tại, vui lòng chạy npm run build");
}

/* ── SPA catch-all: trả về index.html cho mọi route không phải API ── */
app.get("*", (_req, res) => {
  if (distExists) {
    res.sendFile(join(distPath, "index.html"));
    return;
  }

  res.status(404).send("Frontend build chưa tồn tại.");
});

/* ── Global error handler ── */
app.use((err, _req, res, _next) => {
  console.error("[Server Error]", err?.message ?? err);
  res.status(err?.status ?? 500).json({
    success: false,
    message: err?.message ?? "Internal Server Error",
  });
});

/* ── Start ── */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Biến Nhanh server running → http://0.0.0.0:${PORT}\n`);
});
