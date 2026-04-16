// 加载环境变量
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({ path: ".env.production" });

module.exports = {
  apps: [
    {
      name: "next-ai-blog-cms",
      // 直接启动 Next，避免 npm 子进程导致 PM2 监控/内存显示异常
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: process.cwd(),
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 15,
      restart_delay: 4000,
      kill_timeout: 5000,
      // 勿开 wait_ready：Next.js 不会向 PM2 发 process.send('ready')，会导致一直未就绪、反复重启与 502
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        DATABASE_URL: process.env.DATABASE_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        CHAT_API_KEY: process.env.CHAT_API_KEY,
        CHAT_BASE_URL: process.env.CHAT_BASE_URL,
        CHAT_MODEL: process.env.CHAT_MODEL,
        OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
        OLLAMA_EMBEDDING_MODEL: process.env.OLLAMA_EMBEDDING_MODEL,
        EMBEDDING_MODEL: process.env.EMBEDDING_MODEL,
        EMBEDDING_API_KEY: process.env.EMBEDDING_API_KEY,
        EMBEDDING_BASE_URL: process.env.EMBEDDING_BASE_URL,
        EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,
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
