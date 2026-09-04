export interface ReminderSendResult {
  messageId: string | null;
}

export interface ReminderMessenger {
  isReady(companyId: string): boolean | Promise<boolean>;
  sendReminder(
    companyId: string,
    recipient: string,
    body: string,
  ): Promise<ReminderSendResult>;
}

export class UnavailableReminderMessenger implements ReminderMessenger {
  public isReady(): boolean {
    return false;
  }

  public async sendReminder(): Promise<ReminderSendResult> {
    throw new Error('WhatsApp channel is unavailable.');
  }
}
