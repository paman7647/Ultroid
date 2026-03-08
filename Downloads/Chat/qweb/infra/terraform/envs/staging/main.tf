terraform {
  required_version = ">= 1.7.0"
}

module "network" {
  source = "../../modules/network"
  name   = "qweb-staging"
}

module "postgres" {
  source = "../../modules/postgres"
  name   = "qweb-staging-postgres"
}

module "redis" {
  source = "../../modules/redis"
  name   = "qweb-staging-redis"
}

module "storage" {
  source = "../../modules/object_storage"
  bucket = "qweb-staging-uploads"
}

module "observability" {
  source = "../../modules/observability"
  name   = "qweb-staging-otel"
}
