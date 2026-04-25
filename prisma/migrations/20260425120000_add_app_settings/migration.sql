-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL DEFAULT '',
    "updatedAt" DATETIME NOT NULL
);
