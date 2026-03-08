# Terraform Layout

This structure is environment-first with reusable modules.

- `modules/*`: reusable resources (network, compute, data, observability)
- `envs/dev|staging|prod`: stack composition per environment
