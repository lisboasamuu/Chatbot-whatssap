import type { PrismaClient } from '@prisma/client';

import type {
  ConversationStore,
  SaveMessageInput,
} from '../conversation/conversation.store.js';
import type {
  ConversationSession,
  ConversationState,
} from '../conversation/conversation.types.js';

export class PrismaConversationStore implements ConversationStore {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getOrCreateSession(
    externalUserId: string,
  ): Promise<ConversationSession> {
    const conversation = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { externalId: externalUserId },
        update: {},
        create: { externalId: externalUserId },
      });

      return tx.conversation.upsert({
        where: { customerId: customer.id },
        update: {},
        create: { customerId: customer.id },
        select: { id: true, state: true },
      });
    });

    return {
      id: conversation.id,
      state: conversation.state as ConversationState,
    };
  }

  public async updateState(
    conversationId: string,
    state: ConversationState,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { state },
    });
  }

  public async saveMessage(input: SaveMessageInput): Promise<void> {
    await this.prisma.message.create({
      data: {
        conversationId: input.conversationId,
        direction: input.direction,
        body: input.body,
      },
    });
  }
}
