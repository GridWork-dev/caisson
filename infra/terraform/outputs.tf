output "site_urls" {
  value       = ["https://${var.zone_name}", "https://www.${var.zone_name}"]
  description = "Public site URLs once DNS + cert validate."
}
