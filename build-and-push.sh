#!/bin/bash

set -e

# Default values
REPO_NAME="mcip"

# Parse arguments
if [ $# -eq 0 ]; then
    print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }
    print_error "Username is required!"
    echo ""
    echo "Usage: ./build-and-push.sh [username] [tag]"
    echo ""
    echo "Examples:"
    echo "  ./build-and-push.sh opanchuk"
    echo "  ./build-and-push.sh opanchuk v1.0.0"
    exit 1
fi

USERNAME="$1"
TAG="${2:-latest}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker."
    exit 1
fi

# Construct image name
IMAGE_NAME="${USERNAME}/${REPO_NAME}:${TAG}"

echo ""
print_info "Starting Docker build and push..."
echo ""
echo "Configuration:"
echo "  Docker Hub User: ${USERNAME}"
echo "  Repository:      ${REPO_NAME}"
echo "  Tag:             ${TAG}"
echo "  Full Image Name: ${IMAGE_NAME}"
echo ""

# Build the Docker image
print_info "Building Docker image..."
docker build \
    --tag "${IMAGE_NAME}" \
    --file Dockerfile \
    .

if [ $? -eq 0 ]; then
    print_success "Docker image built successfully!"
else
    print_error "Docker build failed"
    exit 1
fi

# Push to Docker Hub
echo ""
print_info "Pushing image to Docker Hub..."

docker push "${IMAGE_NAME}"

if [ $? -eq 0 ]; then
    print_success "Image pushed successfully to Docker Hub!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Pull command:"
    echo -e "  ${GREEN}docker pull ${IMAGE_NAME}${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    print_error "Failed to push image to Docker Hub"
    exit 1
fi

echo ""
print_success "Done!"

