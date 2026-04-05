// 加载环境变量
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.production" });

module.exports = {
  apps: [
    {
      name: "next-ai-blog-cms",
      script: "npm",
      args: "start",
      cwd: process.cwd(),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 5,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        KIMI_API_KEY: process.env.KIMI_API_KEY,
        KIMI_BASE_URL: process.env.KIMI_BASE_URL,
        KIMI_MODEL: process.env.KIMI_MODEL,
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
        OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
        CHROMADB_HOST: process.env.CHROMADB_HOST,
        CHROMADB_PORT: process.env.CHROMADB_PORT,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
    },
  ],
};
