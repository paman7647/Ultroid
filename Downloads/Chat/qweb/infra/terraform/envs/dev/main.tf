terraform {
  required_version = ">= 1.7.0"
}

module "network" {
  source = "../../modules/network"
  name   = "qweb-dev"
}

module "postgres" {
  source = "../../modules/postgres"
  name   = "qweb-dev-postgres"
}

module "redis" {
  source = "../../modules/redis"
  name   = "qweb-dev-redis"
}

module "storage" {
  source = "../../modules/object_storage"
  bucket = "qweb-dev-uploads"
}

module "observability" {
  source = "../../modules/observability"
  name   = "qweb-dev-otel"
}
