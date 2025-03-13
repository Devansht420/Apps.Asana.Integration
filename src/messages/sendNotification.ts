import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import { BlockBuilder } from '@rocket.chat/apps-engine/definition/uikit';
import { IUser } from '@rocket.chat/apps-engine/definition/users';

export async function notifyMessage(room: IRoom, read: IRead, user: IUser, message: string, emoji?, blocks?: BlockBuilder): Promise<void> {
    const notifier = read.getNotifier();
    const messageBuilder = notifier.getMessageBuilder();
    messageBuilder.setText(message);
    messageBuilder.setRoom(room);
    if (blocks) {
        messageBuilder.setBlocks(blocks);
    }
    return notifier.notifyUser(user, messageBuilder.getMessage());
}
