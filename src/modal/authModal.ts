import {
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { sendNotification } from "../messages/sendNotification";
import { AsanaApp } from "../../AsanaApp";
import { ButtonStyle } from "@rocket.chat/apps-engine/definition/uikit";
import { ROOM_ID_KEY } from "../constants/keys";
import { storeData } from "../lib/dataStore";

export async function authorize(
    app: AsanaApp,
    read: IRead,
    modify: IModify,
    user: IUser,
    room: IRoom,
    persistence: IPersistence
): Promise<void> {
    await storeData(persistence, user.id, ROOM_ID_KEY, { roomId: room.id });
    const url = await app
        .getOauth2ClientInstance()
        .getUserAuthorizationUrl(user);

    const message = "Authorize Asana";

    const blocks = modify.getCreator().getBlockBuilder();

    blocks.addActionsBlock({
        elements: [
            blocks.newButtonElement({
                actionId: "authorize",
                text: blocks.newPlainTextObject("Authorize Asana"),
                url: url.toString(),
                style: ButtonStyle.PRIMARY,
            }),
        ],
    });

    await sendNotification(read, modify, user, room, message, blocks);
}
