terraform {
  required_version = ">= 1.7.0"
}

module "network" {
  source = "../../modules/network"
  name   = "qweb-prod"
}

module "postgres" {
  source = "../../modules/postgres"
  name   = "qweb-prod-postgres"
}

module "redis" {
  source = "../../modules/redis"
  name   = "qweb-prod-redis"
}

module "storage" {
  source = "../../modules/object_storage"
  bucket = "qweb-prod-uploads"
}

module "observability" {
  source = "../../modules/observability"
  name   = "qweb-prod-otel"
}
