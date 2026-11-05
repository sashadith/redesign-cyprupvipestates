-- Partner profile photo, shown in the footer of partner-branded presentations (mirrors brandLogo*).
ALTER TABLE "partners" ADD COLUMN "brandPhoto" BYTEA,
ADD COLUMN "brandPhotoType" TEXT,
ADD COLUMN "brandPhotoUpdatedAt" TIMESTAMP(3);
