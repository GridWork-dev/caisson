variable "cloudflare_api_token" {
  type        = string
  sensitive   = true
  description = "Cloudflare API token: Zone:DNS:Edit + Account:Cloudflare Pages:Edit + Account:Access(Apps and Policies):Edit on the caisson.sh zone/account."
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID that owns the caisson.sh zone + Pages project."
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Zone ID for caisson.sh (Cloudflare dashboard → caisson.sh → Overview → Zone ID). The .sh registration is external; the zone is hosted on Cloudflare."
}

variable "zone_name" {
  type        = string
  default     = "caisson.sh"
  description = "Apex domain."
}

variable "pages_project_name" {
  type        = string
  default     = "caisson-site"
  description = "Cloudflare Pages project — the marketing + docs Next site (single Next + MDX app, board lock)."
}

variable "production_branch" {
  type        = string
  default     = "main"
  description = "Git branch Pages treats as production."
}
