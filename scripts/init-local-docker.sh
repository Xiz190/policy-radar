#!/usr/bin/env bash
# ============================================================
# 本地 Docker 环境初始化脚本
#
# 用途：快速在本地验证 Docker 部署流程
# 功能：
#   1. 检查 Docker daemon 状态
#   2. 检查端口占用
#   3. 清理旧环境（可选）
#   4. 初始化配置
#   5. 构建并启动
#   6. 注入 mock 数据（可选）
#   7. 自动打开浏览器验证
#
# 用法：
#   ./scripts/init-local-docker.sh          # 完整初始化
#   ./scripts/init-local-docker.sh --clean  # 先清理再初始化
#   ./scripts/init-local-docker.sh --quick  # 快速模式（跳过构建，直接启动）
#   ./scripts/init-local-docker.sh --no-mock # 不注入 mock 数据
#
# ============================================================

set -euo pipefail

# ============================================================
# 颜色输出
# ============================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# ============================================================
# 配置变量
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
ENV_EXAMPLE="${PROJECT_DIR}/.env.docker.example"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
APP_PORT=3000
DB_PORT=5432

# 标志位
CLEAN_MODE=false
QUICK_MODE=false
MOCK_DATA=true

# ============================================================
# 日志函数
# ============================================================
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_step()    { echo -e "\n${CYAN}====== $1 ======${NC}"; }
log_highlight() { echo -e "\n${MAGENTA}>>> $1 <<<${NC}"; }

# ============================================================
# 工具函数
# ============================================================

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查端口是否被占用
port_in_use() {
    local port="$1"
    if command_exists lsof; then
        lsof -ti:"$port" >/dev/null 2>&1
    elif command_exists netstat; then
        netstat -tlnp 2>/dev/null | grep -q ":${port} "
    else
        # 回退方案：尝试连接
        (echo >/dev/tcp/localhost/"$port") 2>/dev/null
    fi
}

# 生成随机字符串
generate_random() {
    local length="${1:-32}"
    if command_exists openssl; then
        openssl rand -hex "$length" 2>/dev/null || \
        head -c "$length" /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$length"
    else
        head -c "$length" /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$length"
    fi
}

# 等待 HTTP 服务就绪
wait_for_http() {
    local url="$1"
    local max_attempts="${2:-30}"
    local wait_seconds="${3:-2}"
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            return 0
        fi
        log_info "  等待中... ($attempt/$max_attempts) $url"
        sleep "$wait_seconds"
        ((attempt++))
    done

    return 1
}

# ============================================================
# 检查 Docker daemon
# ============================================================
check_docker_daemon() {
    log_step "检查 Docker Daemon"

    if ! command_exists docker; then
        log_error "Docker 未安装！"
        log_info "请先安装 Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi

    log_info "检查 Docker daemon 是否运行..."

    local max_attempts=5
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        if docker info >/dev/null 2>&1; then
            log_success "Docker daemon 运行正常"
            local docker_version
            docker_version=$(docker --version 2>/dev/null || echo "unknown")
            log_info "  版本: $docker_version"
            return 0
        fi
        log_warn "  Docker daemon 未响应，等待中... ($attempt/$max_attempts)"
        sleep 3
        ((attempt++))
    done

    log_error "Docker daemon 未启动！"
    log_info "请启动 Docker Desktop 后重新运行此脚本"
    exit 1
}

# ============================================================
# 检查端口占用
# ============================================================
check_ports() {
    log_step "检查端口占用"

    local has_conflict=0

    if port_in_use "$APP_PORT"; then
        log_warn "端口 $APP_PORT 已被占用"
        if command_exists lsof; then
            local pid
            pid=$(lsof -ti:"$APP_PORT" | head -1)
            if [[ -n "$pid" ]]; then
                local proc_name
                proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                log_info "  占用进程: PID=$pid, 名称=$proc_name"
            fi
        fi
        has_conflict=1
    else
        log_success "端口 $APP_PORT 可用"
    fi

    if port_in_use "$DB_PORT"; then
        log_warn "端口 $DB_PORT 已被占用"
        if command_exists lsof; then
            local pid
            pid=$(lsof -ti:"$DB_PORT" | head -1)
            if [[ -n "$pid" ]]; then
                local proc_name
                proc_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
                log_info "  占用进程: PID=$pid, 名称=$proc_name"
            fi
        fi
        has_conflict=1
    else
        log_success "端口 $DB_PORT 可用"
    fi

    if [[ $has_conflict -eq 1 ]]; then
        log_warn "检测到端口冲突！"
        log_info "  解决方案:"
        log_info "    1. 修改 .env 文件中的端口配置"
        log_info "    2. 停止占用端口的进程"
        log_info "    3. 使用 --clean 选项清理旧容器"
        echo ""
        read -r -p "是否继续？[y/N] " answer
        if [[ ! "$answer" =~ ^[Yy]$ ]]; then
            log_info "已取消"
            exit 0
        fi
    fi
}

# ============================================================
# 清理旧环境
# ============================================================
clean_environment() {
    log_step "清理旧环境"

    cd "$PROJECT_DIR"

    # 检查是否有正在运行的容器
    if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
        log_info "停止并移除旧容器..."
        docker compose -f "$COMPOSE_FILE" down -v
        log_success "旧容器已清理"
    else
        log_info "没有正在运行的容器"
    fi

    # 清理 dangling 镜像
    local dangling_count
    dangling_count=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$dangling_count" -gt 0 ]]; then
        log_info "清理 $dangling_count 个悬空镜像..."
        docker image prune -f >/dev/null 2>&1
        log_success "悬空镜像已清理"
    fi
}

# ============================================================
# 初始化配置
# ============================================================
init_config() {
    log_step "初始化配置"

    cd "$PROJECT_DIR"

    if [[ -f "$ENV_FILE" ]]; then
        log_info ".env 文件已存在"
        return 0
    fi

    if [[ ! -f "$ENV_EXAMPLE" ]]; then
        log_error ".env.docker.example 不存在！"
        exit 1
    fi

    log_info "生成 .env 配置文件..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    # 生成随机密码
    local db_password
    local admin_token
    db_password=$(generate_random 16)
    admin_token=$(generate_random 32)

    # 替换占位符
    if [[ "$(uname)" == "Darwin" ]]; then
        sed -i '' "s/your_strong_password_here/${db_password}/g" "$ENV_FILE"
        sed -i '' "s/please_change_this_to_a_secure_random_token/${admin_token}/g" "$ENV_FILE"
    else
        sed -i "s/your_strong_password_here/${db_password}/g" "$ENV_FILE"
        sed -i "s/please_change_this_to_a_secure_random_token/${admin_token}/g" "$ENV_FILE"
    fi

    # 设置文件权限
    chmod 600 "$ENV_FILE"

    log_success "配置文件已生成"
    log_info "  文件: $ENV_FILE"
    log_info "  权限: 600 (仅当前用户可读写)"
}

# ============================================================
# 构建镜像
# ============================================================
build_images() {
    if [[ "$QUICK_MODE" == "true" ]]; then
        log_step "快速模式 - 跳过构建"
        return 0
    fi

    log_step "构建 Docker 镜像"

    cd "$PROJECT_DIR"

    log_info "开始构建，这可能需要 2-5 分钟..."
    log_info "（首次构建需要下载基础镜像，请耐心等待）"

    local start_time
    start_time=$(date +%s)

    if docker compose -f "$COMPOSE_FILE" build app; then
        local end_time
        end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "构建完成，耗时 ${duration} 秒"
    else
        log_error "构建失败！"
        log_info "请检查构建日志，或运行 ./scripts/debug-deploy.sh 排查问题"
        exit 1
    fi
}

# ============================================================
# 启动服务
# ============================================================
start_services() {
    log_step "启动服务"

    cd "$PROJECT_DIR"

    log_info "启动容器..."
    docker compose -f "$COMPOSE_FILE" up -d

    log_success "容器已启动"
}

# ============================================================
# 等待服务就绪
# ============================================================
wait_for_services() {
    log_step "等待服务就绪"

    local max_attempts=40
    local wait_seconds=3
    local attempt=1

    # 等待 PostgreSQL
    log_info "等待 PostgreSQL 就绪..."
    while [[ $attempt -le $max_attempts ]]; do
        if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            log_success "PostgreSQL 已就绪 (尝试 $attempt 次)"
            break
        fi
        log_info "  等待中... ($attempt/$max_attempts)"
        sleep "$wait_seconds"
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_error "PostgreSQL 启动超时！"
        return 1
    fi

    # 等待应用
    log_info "等待应用服务就绪..."
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:${APP_PORT}/api/monitor/status" >/dev/null 2>&1; then
            log_success "应用服务已就绪 (尝试 $attempt 次)"
            return 0
        fi
        log_info "  等待中... ($attempt/$max_attempts)"
        sleep "$wait_seconds"
        ((attempt++))
    done

    log_error "应用启动超时！"
    return 1
}

# ============================================================
# 注入 mock 数据
# ============================================================
inject_mock_data() {
    if [[ "$MOCK_DATA" != "true" ]]; then
        return 0
    fi

    log_step "注入 Mock 数据"

    log_info "调用种子数据接口..."

    local response
    response=$(curl -sf -X POST "http://localhost:${APP_PORT}/api/monitor/items/seed-demo" \
        -H "Content-Type: application/json" 2>&1 || echo "failed")

    if [[ "$response" != "failed" ]]; then
        log_success "Mock 数据注入成功"
    else
        log_warn "Mock 数据注入失败（可能是接口不存在或鉴权问题）"
        log_info "  你可以手动访问应用验证功能是否正常"
    fi
}

# ============================================================
# 打开浏览器
# ============================================================
open_browser() {
    log_step "打开浏览器"

    local url="http://localhost:${APP_PORT}"

    if command_exists open; then
        # macOS
        log_info "正在打开浏览器..."
        open "$url"
    elif command_exists xdg-open; then
        # Linux
        log_info "正在打开浏览器..."
        xdg-open "$url" 2>/dev/null
    else
        log_info "请手动访问: $url"
    fi
}

# ============================================================
# 显示部署摘要
# ============================================================
show_summary() {
    log_step "部署完成"

    local url="http://localhost:${APP_PORT}"

    echo ""
    echo -e "${GREEN}🎉  本地 Docker 环境初始化完成！${NC}"
    echo ""
    echo -e "🌐 访问地址:  ${CYAN}$url${NC}"
    echo -e "📊 状态接口:  ${CYAN}$url/api/monitor/status${NC}"
    echo ""
    echo -e "📋 常用命令:"
    echo -e "  查看状态:    ${CYAN}cd $PROJECT_DIR && docker compose ps${NC}"
    echo -e "  查看日志:    ${CYAN}cd $PROJECT_DIR && docker compose logs -f app${NC}"
    echo -e "  故障排查:    ${CYAN}./scripts/debug-deploy.sh${NC}"
    echo -e "  停止服务:    ${CYAN}cd $PROJECT_DIR && docker compose down${NC}"
    echo ""
    echo -e "${YELLOW}💡 提示: ${NC}如果遇到问题，运行 ${CYAN}./scripts/debug-deploy.sh${NC} 自动排查"
    echo ""
}

# ============================================================
# 主函数
# ============================================================
main() {
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --clean)
                CLEAN_MODE=true
                shift
                ;;
            --quick)
                QUICK_MODE=true
                shift
                ;;
            --no-mock)
                MOCK_DATA=false
                shift
                ;;
            -h|--help)
                echo "本地 Docker 环境初始化脚本"
                echo ""
                echo "用法:"
                echo "  ./scripts/init-local-docker.sh           完整初始化"
                echo "  ./scripts/init-local-docker.sh --clean   先清理再初始化"
                echo "  ./scripts/init-local-docker.sh --quick   快速模式（跳过构建）"
                echo "  ./scripts/init-local-docker.sh --no-mock 不注入 mock 数据"
                echo "  ./scripts/init-local-docker.sh --help    显示帮助"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  本地 Docker 环境初始化${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    # 执行流程
    check_docker_daemon
    check_ports

    if [[ "$CLEAN_MODE" == "true" ]]; then
        clean_environment
    fi

    init_config
    build_images
    start_services

    if wait_for_services; then
        inject_mock_data
        open_browser
        show_summary
    else
        log_error "服务启动失败！"
        echo ""
        log_info "请运行 ${CYAN}./scripts/debug-deploy.sh${NC} 进行故障排查"
        exit 1
    fi
}

# 运行主函数
main "$@"
