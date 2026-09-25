# ============================================================
# Stage 1: 安装依赖
# ============================================================
FROM node:20-alpine AS deps
WORKDIR /app

# 复制 package 文件
COPY package.json package-lock.json* ./

# 安装依赖（使用 --ci 确保完全按照 lockfile 安装）
RUN if [ -f package-lock.json ]; then npm ci; \
  else echo "package-lock.json not found, running npm install"; npm install; fi

# ============================================================
# Stage 2: 构建
# ============================================================
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源代码
COPY . .

# 构建参数（可在构建时传入）
ARG DATABASE_URL
ARG ADMIN_TOKEN
ARG LLM_API_KEY
ARG LLM_BASE_URL
ARG LLM_MODEL
ARG LLM_TEMPERATURE
ARG LLM_MAX_TOKENS
ARG NEXT_TELEMETRY_DISABLED=1

# 设置环境变量（构建时可用）
ENV DATABASE_URL=${DATABASE_URL}
ENV ADMIN_TOKEN=${ADMIN_TOKEN}
ENV LLM_API_KEY=${LLM_API_KEY}
ENV LLM_BASE_URL=${LLM_BASE_URL}
ENV LLM_MODEL=${LLM_MODEL}
ENV LLM_TEMPERATURE=${LLM_TEMPERATURE}
ENV LLM_MAX_TOKENS=${LLM_MAX_TOKENS}
ENV NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED}

# 运行构建
RUN npm run build

# ============================================================
# Stage 3: 生产镜像
# ============================================================
FROM node:20-alpine AS runner
WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制静态资源
COPY --from=builder /app/public ./public

# 复制构建产物（Next.js standalone 模式）
# 自动利用 Next.js Output Tracing 特性减小镜像体积
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置端口环境变量
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/monitor/status', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动命令
CMD ["node", "server.js"]
