-- AlterEnum
ALTER TYPE "ConversationState" ADD VALUE 'SCHEDULING_NAME';

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "name" TEXT;
