// docker-bake.hcl - BuildKit HCL file for optimized Docker builds

// Define variables with default values
variable "TAG" {
  default = "latest"
}

variable "REGISTRY" {
  default = ""
}

variable "BUILDKIT_INLINE_CACHE" {
  default = "1"
}

variable "PYTHON_VERSION" {
  default = "3.11"
}

variable "DOCKERFILE" {
  default = "Dockerfile"
}

// Common settings for all targets
target "common" {
  context = "."
  dockerfile = "${DOCKERFILE}"
  pull = true
  args = {
    PYTHON_VERSION = "${PYTHON_VERSION}"
    BUILDKIT_INLINE_CACHE = "${BUILDKIT_INLINE_CACHE}"
  }
}

// Base target with common settings
target "docker-metadata-action" {
  tags = ["${REGISTRY}foreflight-dashboard:${TAG}"]
}

// Development target
target "dev" {
  inherits = ["common", "docker-metadata-action"]
  target = "development"
  tags = [
    "${REGISTRY}foreflight-dashboard:${TAG}-dev",
    "${REGISTRY}foreflight-dashboard:dev"
  ]
  output = ["type=docker"]
  args = {
    FLASK_DEBUG = "1"
    FLASK_ENV = "development"
  }
}

// Test target
target "test" {
  inherits = ["common"]
  target = "development"
  tags = ["${REGISTRY}foreflight-dashboard:test"]
  output = ["type=docker"]
  args = {
    FLASK_DEBUG = "0"
    FLASK_ENV = "testing"
  }
}

// Production target
target "prod" {
  inherits = ["common", "docker-metadata-action"]
  target = "production"
  tags = [
    "${REGISTRY}foreflight-dashboard:${TAG}",
    "${REGISTRY}foreflight-dashboard:prod"
  ]
  output = ["type=docker"]
  args = {
    FLASK_DEBUG = "0"
    FLASK_ENV = "production"
  }
}

// Default target group
group "default" {
  targets = ["dev"]
}

// Development group
group "development" {
  targets = ["dev"]
}

// Testing group
group "testing" {
  targets = ["test"]
}

// Production group
group "production" {
  targets = ["prod"]
}

// All targets group
group "all" {
  targets = ["dev", "test", "prod"]
}
