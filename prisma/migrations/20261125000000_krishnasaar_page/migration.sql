-- CreateTable
CREATE TABLE "krishnasaar_page" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "whatItIs" TEXT,
    "history" TEXT,
    "wildlife" TEXT,
    "bestTime" TEXT,
    "gettingThere" TEXT,
    "whatToBring" TEXT,
    "coverMediaId" TEXT,
    "destinationId" TEXT,
    "relatedGuides" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "krishnasaar_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "krishnasaar_faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "krishnasaar_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "krishnasaar_media" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "krishnasaar_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "krishnasaar_media_mediaId_key" ON "krishnasaar_media"("mediaId");

-- CreateIndex
CREATE INDEX "krishnasaar_media_sortOrder_idx" ON "krishnasaar_media"("sortOrder");

-- AddForeignKey
ALTER TABLE "krishnasaar_page" ADD CONSTRAINT "krishnasaar_page_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "krishnasaar_page" ADD CONSTRAINT "krishnasaar_page_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "nearby_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "krishnasaar_media" ADD CONSTRAINT "krishnasaar_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The page is a single row.
ALTER TABLE "krishnasaar_page" ADD CONSTRAINT "krishnasaar_page_single_row" CHECK ("id" = 1);
