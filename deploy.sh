#!/usr/bin/env bash
# ============================================================
# 政策监测系统 - 一键部署脚本
#
# 功能：
#   1. 环境检查（Docker、docker compose）
#   2. 配置文件初始化
#   3. 镜像构建
#   4. 服务启动
#   5. 健康检查
#
# 用法：
#   ./deploy.sh              # 交互式部署
#   ./deploy.sh -y           # 自动确认，使用默认配置
#   ./deploy.sh --stop       # 停止服务
#   ./deploy.sh --restart    # 重启服务
#   ./deploy.sh --logs       # 查看日志
#   ./deploy.sh --status     # 查看状态
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
NC='\033[0m' # No Color

# ============================================================
# 配置变量
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"
ENV_EXAMPLE="${SCRIPT_DIR}/.env.docker.example"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
PROJECT_NAME="public-info-sync"

# ============================================================
# 日志函数
# ============================================================
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_step() {
    echo -e "\n${CYAN}====== $1 ======${NC}"
}

# ============================================================
# 工具函数
# ============================================================

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 生成随机字符串
generate_random() {
    local length="${1:-32}"
    if command_exists openssl; then
        openssl rand -hex "$length" 2>/dev/null || head -c "$length" /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$length"
    else
        head -c "$length" /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "$length"
    fi
}

# 交互式确认
confirm() {
    if [[ "${AUTO_YES:-false}" == "true" ]]; then
        return 0
    fi
    local prompt="$1"
    local default="${2:-y}"
    local yn
    if [[ "$default" == "y" ]]; then
        read -r -p "$prompt [Y/n] " yn
        [[ -z "$yn" || "$yn" =~ ^[Yy]$ ]] && return 0 || return 1
    else
        read -r -p "$prompt [y/N] " yn
        [[ "$yn" =~ ^[Yy]$ ]] && return 0 || return 1
    fi
}

# ============================================================
# 环境检查
# ============================================================
check_environment() {
    log_step "环境检查"

    local has_error=0

    # 检查 Docker
    if command_exists docker; then
        local docker_version
        docker_version=$(docker --version 2>/dev/null || echo "unknown")
        log_success "Docker 已安装: $docker_version"
    else
        log_error "Docker 未安装！请先安装 Docker: https://docs.docker.com/get-docker/"
        has_error=1
    fi

    # 检查 docker compose（v2 插件模式）
    if docker compose version >/dev/null 2>&1; then
        local compose_version
        compose_version=$(docker compose version 2>/dev/null || echo "unknown")
        log_success "Docker Compose 已安装: $compose_version"
    elif command_exists docker-compose; then
        log_success "Docker Compose 已安装 (docker-compose v1)"
    else
        log_error "Docker Compose 未安装！请先安装 Docker Compose"
        has_error=1
    fi

    # 检查 docker-compose.yml
    if [[ -f "$COMPOSE_FILE" ]]; then
        log_success "docker-compose.yml 存在"
    else
        log_error "docker-compose.yml 不存在！"
        has_error=1
    fi

    if [[ $has_error -eq 1 ]]; then
        log_error "环境检查失败，请先解决上述问题后再运行部署脚本"
        exit 1
    fi

    log_success "环境检查通过"
}

# ============================================================
# 配置初始化
# ============================================================
init_config() {
    log_step "配置初始化"

    if [[ -f "$ENV_FILE" ]]; then
        log_info ".env 文件已存在，跳过初始化"
        return 0
    fi

    if [[ ! -f "$ENV_EXAMPLE" ]]; then
        log_error ".env.docker.example 文件不存在！"
        exit 1
    fi

    log_info "正在初始化配置文件..."

    # 复制示例配置
    cp "$ENV_EXAMPLE" "$ENV_FILE"

    # 生成随机密码和 token
    local db_password
    local admin_token
    db_password=$(generate_random 16)
    admin_token=$(generate_random 32)

    # 替换占位符
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS sed
        sed -i '' "s/your_strong_password_here/${db_password}/g" "$ENV_FILE"
        sed -i '' "s/please_change_this_to_a_secure_random_token/${admin_token}/g" "$ENV_FILE"
    else
        # Linux sed
        sed -i "s/your_strong_password_here/${db_password}/g" "$ENV_FILE"
        sed -i "s/please_change_this_to_a_secure_random_token/${admin_token}/g" "$ENV_FILE"
    fi

    log_success "配置文件已生成: $ENV_FILE"
    log_info "  - 数据库密码: ${db_password:0:4}****"
    log_info "  - Admin Token: ${admin_token:0:4}****"

    if [[ "${AUTO_YES:-false}" != "true" ]]; then
        if confirm "是否需要修改配置？" "n"; then
            log_info "请编辑 $ENV_FILE 修改配置后重新运行部署脚本"
            exit 0
        fi
    fi
}

# ============================================================
# 构建镜像
# ============================================================
build_images() {
    log_step "构建镜像"

    log_info "开始构建 Docker 镜像，这可能需要几分钟..."

    if docker compose -f "$COMPOSE_FILE" build; then
        log_success "镜像构建成功"
    else
        log_error "镜像构建失败！"
        exit 1
    fi
}

# ============================================================
# 启动服务
# ============================================================
start_services() {
    log_step "启动服务"

    # 先停止旧服务（如果存在）
    if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
        log_info "检测到正在运行的服务，先停止..."
        docker compose -f "$COMPOSE_FILE" down
    fi

    log_info "启动服务..."
    docker compose -f "$COMPOSE_FILE" up -d

    log_success "服务已启动"
}

# ============================================================
# 健康检查
# ============================================================
wait_for_health() {
    log_step "健康检查"

    local max_attempts=30
    local wait_seconds=5
    local attempt=1

    log_info "等待 PostgreSQL 启动..."
    while [[ $attempt -le $max_attempts ]]; do
        local pg_status
        pg_status=$(docker compose -f "$COMPOSE_FILE" ps --format json postgres 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

        if [[ "$pg_status" == "healthy" ]]; then
            log_success "PostgreSQL 已就绪 (尝试 $attempt 次)"
            break
        fi

        log_info "  等待中... ($attempt/$max_attempts) 当前状态: $pg_status"
        sleep "$wait_seconds"
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_warn "PostgreSQL 启动超时，请手动检查状态"
        return 1
    fi

    # 等待应用启动
    log_info "等待应用启动..."
    attempt=1
    while [[ $attempt -le $max_attempts ]]; do
        local app_status
        app_status=$(docker compose -f "$COMPOSE_FILE" ps --format json app 2>/dev/null | grep -o '"Health":"[^"]*"' | cut -d'"' -f4 || echo "unknown")

        if [[ "$app_status" == "healthy" ]]; then
            log_success "应用已就绪 (尝试 $attempt 次)"
            return 0
        fi

        log_info "  等待中... ($attempt/$max_attempts) 当前状态: $app_status"
        sleep "$wait_seconds"
        ((attempt++))
    done

    if [[ $attempt -gt $max_attempts ]]; then
        log_warn "应用启动超时，请查看日志排查问题"
        return 1
    fi
}

# ============================================================
# 显示部署信息
# ============================================================
show_deployment_info() {
    log_step "部署完成"

    local app_port
    app_port=$(grep -E '^APP_PORT=' "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "3000")

    echo ""
    echo -e "${GREEN}🎉  部署成功！${NC}"
    echo ""
    echo -e "🌐 访问地址: ${CYAN}http://localhost:${app_port}${NC}"
    echo ""
    echo -e "📋 常用命令:"
    echo -e "  查看状态:  ${CYAN}./deploy.sh --status${NC}"
    echo -e "  查看日志:  ${CYAN}./deploy.sh --logs${NC}"
    echo -e "  重启服务:  ${CYAN}./deploy.sh --restart${NC}"
    echo -e "  停止服务:  ${CYAN}./deploy.sh --stop${NC}"
    echo ""

    # 显示服务状态
    docker compose -f "$COMPOSE_FILE" ps
}

# ============================================================
# 子命令：停止服务
# ============================================================
stop_services() {
    log_step "停止服务"

    if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
        docker compose -f "$COMPOSE_FILE" down
        log_success "服务已停止"
    else
        log_info "没有正在运行的服务"
    fi
}

# ============================================================
# 子命令：重启服务
# ============================================================
restart_services() {
    log_step "重启服务"

    docker compose -f "$COMPOSE_FILE" restart
    log_success "服务已重启"
}

# ============================================================
# 子命令：查看日志
# ============================================================
show_logs() {
    log_step "查看日志"

    local service="${1:-app}"
    docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$service"
}

# ============================================================
# 子命令：查看状态
# ============================================================
show_status() {
    log_step "服务状态"

    docker compose -f "$COMPOSE_FILE" ps

    echo ""
    log_info "容器资源使用情况:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || log_warn "无法获取资源使用情况"
}

# ============================================================
# 主函数
# ============================================================
main() {
    local action="deploy"
    AUTO_YES=false

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -y|--yes)
                AUTO_YES=true
                shift
                ;;
            --stop)
                action="stop"
                shift
                ;;
            --restart)
                action="restart"
                shift
                ;;
            --logs)
                action="logs"
                LOGS_SERVICE="${2:-app}"
                shift 2
                ;;
            --status)
                action="status"
                shift
                ;;
            -h|--help)
                action="help"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助"
                exit 1
                ;;
        esac
    done

    # 执行对应操作
    case "$action" in
        deploy)
            echo ""
            echo -e "${CYAN}========================================${NC}"
            echo -e "${CYAN}  政策监测系统 - 一键部署${NC}"
            echo -e "${CYAN}========================================${NC}"
            echo ""

            check_environment
            init_config
            build_images
            start_services
            wait_for_health || true
            show_deployment_info
            ;;
        stop)
            check_environment
            stop_services
            ;;
        restart)
            check_environment
            restart_services
            ;;
        logs)
            check_environment
            show_logs "${LOGS_SERVICE:-app}"
            ;;
        status)
            check_environment
            show_status
            ;;
        help)
            echo "政策监测系统 - 一键部署脚本"
            echo ""
            echo "用法:"
            echo "  ./deploy.sh              交互式部署"
            echo "  ./deploy.sh -y           自动确认，使用默认配置"
            echo "  ./deploy.sh --stop       停止服务"
            echo "  ./deploy.sh --restart    重启服务"
            echo "  ./deploy.sh --logs [服务] 查看日志（默认 app）"
            echo "  ./deploy.sh --status     查看状态"
            echo "  ./deploy.sh --help       显示帮助"
            ;;
    esac
}

# 运行主函数
main "$@"
