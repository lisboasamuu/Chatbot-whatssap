import { Prisma, type PrismaClient } from '@prisma/client';

import type {
  ConversationStore,
  SaveMessageInput,
  UpdateSessionInput,
} from '../conversation/conversation.store.js';
import {
  parseConversationContext,
  type ConversationContext,
  type ConversationSession,
  type ConversationState,
} from '../conversation/conversation.types.js';

function toPrismaContext(
  context: ConversationContext | null,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  if (context === null) {
    return Prisma.DbNull;
  }

  return {
    ...(context.draftDate !== undefined ? { draftDate: context.draftDate } : {}),
    ...(context.draftTime !== undefined ? { draftTime: context.draftTime } : {}),
    ...(context.draftName !== undefined ? { draftName: context.draftName } : {}),
    ...(context.awaitingCourtesyReply !== undefined
      ? { awaitingCourtesyReply: context.awaitingCourtesyReply }
      : {}),
    ...(context.selectedAppointmentId !== undefined
      ? { selectedAppointmentId: context.selectedAppointmentId }
      : {}),
  } satisfies Prisma.InputJsonObject;
}

export class PrismaConversationStore implements ConversationStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly companyId: string,
  ) {}

  public async getOrCreateSession(
    externalUserId: string,
  ): Promise<ConversationSession> {
    const conversation = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: {
          companyId_externalId: {
            companyId: this.companyId,
            externalId: externalUserId,
          },
        },
        update: {},
        create: {
          companyId: this.companyId,
          externalId: externalUserId,
        },
      });

      return tx.conversation.upsert({
        where: {
          companyId_customerId: {
            companyId: this.companyId,
            customerId: customer.id,
          },
        },
        update: {},
        create: {
          companyId: this.companyId,
          customerId: customer.id,
        },
        select: {
          id: true,
          customerId: true,
          state: true,
          context: true,
        },
      });
    });

    return {
      id: conversation.id,
      customerId: conversation.customerId,
      state: conversation.state as ConversationState,
      context: parseConversationContext(conversation.context),
    };
  }

  public async updateSession(
    conversationId: string,
    input: UpdateSessionInput,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        companyId_id: {
          companyId: this.companyId,
          id: conversationId,
        },
      },
      data: {
        state: input.state,
        context: toPrismaContext(input.context),
      },
    });
  }

  public async updateState(
    conversationId: string,
    state: ConversationState,
  ): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        companyId_id: {
          companyId: this.companyId,
          id: conversationId,
        },
      },
      data: { state },
    });
  }

  public async saveMessage(input: SaveMessageInput): Promise<void> {
    await this.prisma.conversation.update({
      where: {
        companyId_id: {
          companyId: this.companyId,
          id: input.conversationId,
        },
      },
      data: {
        messages: {
          create: {
            direction: input.direction,
            body: input.body,
          },
        },
      },
    });
  }
}
