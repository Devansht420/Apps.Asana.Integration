import { IModify, IRead } from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { SlashCommandContext } from "@rocket.chat/apps-engine/definition/slashcommands";
import { IUser } from "@rocket.chat/apps-engine/definition/users";

// export async function sendMessage(
//     value: string,
//     user: IUser,
//     room: IRoom,
//     modify: IModify,
// ): Promise<void> {

//     const message = modify.getCreator().startMessage();

//     message.setSender(user).setRoom(room).setText(value);

//     await modify.getCreator().finish(message);
// }

export async function sendMessage(context: SlashCommandContext, read: IRead, modify: IModify, message: string): Promise<void> {
        const messageStructure = modify.getCreator().startMessage();
        const appUser = await read.getUserReader().getAppUser();
        if (!appUser) {
            throw new Error("App user not found");
        }
        const room = context.getRoom();

        messageStructure
            .setSender(appUser)
            .setRoom(room)
            .setText(message);

        await modify.getCreator().finish(messageStructure);
    }
