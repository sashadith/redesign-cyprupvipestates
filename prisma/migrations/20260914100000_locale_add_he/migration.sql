-- Hebrew locale. Additive; nothing references 'he' until a later migration/app write.
ALTER TYPE "Locale" ADD VALUE IF NOT EXISTS 'he';
