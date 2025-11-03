#!/bin/bash

# Deployment script for Fullstack Application
# This script handles building and deploying the application using Docker Compose

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="fullstack-app"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log_success "Dependencies check passed"
}

# Create backup of current deployment
create_backup() {
    log_info "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    if [ -f "docker-compose.yml" ]; then
        cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.$TIMESTAMP.bak"
        log_success "Docker Compose configuration backed up"
    fi

    if [ -d "backend/uploads" ]; then
        tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C backend/uploads .
        log_success "Uploads directory backed up"
    fi
}

# Validate environment files
validate_env() {
    log_info "Validating environment configuration..."

    if [ ! -f "backend/.env" ]; then
        log_warning "backend/.env not found. Copying from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example backend/.env
            log_error "Please edit backend/.env with your actual configuration values"
            exit 1
        else
            log_error "Neither backend/.env nor .env.example found"
            exit 1
        fi
    fi

    # Check for required environment variables
    if ! grep -q "OPENROUTER_API_KEY=your_openrouter_api_key_here" backend/.env; then
        log_success "Environment configuration appears to be set"
    else
        log_error "Please set your OPENROUTER_API_KEY in backend/.env"
        exit 1
    fi
}

# Build and start services
deploy_services() {
    log_info "Building and deploying services..."

    # Use docker compose (newer syntax) if available, fallback to docker-compose
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Stop existing services
    log_info "Stopping existing services..."
    $COMPOSE_CMD down || true

    # Build services
    log_info "Building services..."
    $COMPOSE_CMD build --no-cache

    # Start services
    log_info "Starting services..."
    $COMPOSE_CMD up -d

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    $COMPOSE_CMD ps

    log_success "Services deployed successfully"
}

# Run database migrations (if any)
run_migrations() {
    log_info "Running database migrations..."
    # Add migration commands here if needed in the future
    log_success "Migrations completed"
}

# Health check
health_check() {
    log_info "Performing health checks..."

    # Wait for frontend to be ready
    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost/ > /dev/null 2>&1; then
            log_success "Frontend is healthy"
            break
        fi

        log_info "Waiting for frontend... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Frontend health check failed"
        exit 1
    fi

    # Check backend health
    if curl -f -s http://localhost/api/ > /dev/null 2>&1; then
        log_success "Backend is healthy"
    else
        log_error "Backend health check failed"
        exit 1
    fi
}

# Show deployment info
show_info() {
    log_success "Deployment completed successfully!"
    echo ""
    echo "Application URLs:"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost/api/"
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "To stop services:"
    echo "  docker-compose down"
    echo ""
    echo "To restart services:"
    echo "  docker-compose restart"
}

# Main deployment process
main() {
    log_info "Starting deployment of $PROJECT_NAME"

    check_dependencies
    create_backup
    validate_env
    deploy_services
    run_migrations
    health_check
    show_info

    log_success "Deployment completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    "stop")
        log_info "Stopping services..."
        docker compose down 2>/dev/null || docker-compose down
        log_success "Services stopped"
        ;;
    "restart")
        log_info "Restarting services..."
        docker compose restart 2>/dev/null || docker-compose restart
        log_success "Services restarted"
        ;;
    "logs")
        log_info "Showing logs..."
        docker compose logs -f "${2:-}" 2>/dev/null || docker-compose logs -f "${2:-}"
        ;;
    "backup")
        create_backup
        ;;
    *)
        main
        ;;
esac