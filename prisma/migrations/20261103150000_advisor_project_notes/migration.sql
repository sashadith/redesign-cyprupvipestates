-- CreateTable
CREATE TABLE "advisor_project_notes" (
    "userId" TEXT NOT NULL,
    "developmentId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advisor_project_notes_pkey" PRIMARY KEY ("userId","developmentId")
);

-- AddForeignKey
ALTER TABLE "advisor_project_notes" ADD CONSTRAINT "advisor_project_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advisor_project_notes" ADD CONSTRAINT "advisor_project_notes_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "developments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
