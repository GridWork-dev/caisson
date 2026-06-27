output "pages_subdomain" {
  value       = "${cloudflare_pages_project.site.name}.pages.dev"
  description = "The *.pages.dev subdomain the custom domains alias."
}

output "site_urls" {
  value       = ["https://${var.zone_name}", "https://www.${var.zone_name}"]
  description = "Public site URLs once DNS + cert validate."
}
