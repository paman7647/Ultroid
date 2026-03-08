terraform {
  required_version = ">= 1.7.0"
}

variable "name" {
  type = string
}

output "network_id" {
  value = "replace-with-provider-network-id"
}
