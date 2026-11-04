-- Lead cockpit: remember each user's last summary language (null = English).
ALTER TABLE "users" ADD COLUMN "crmSummaryLocale" "Locale";
