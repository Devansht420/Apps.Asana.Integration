// import {
//     IModify,
//     IRead,
// } from "@rocket.chat/apps-engine/definition/accessors";
// import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
// import { IUser } from "@rocket.chat/apps-engine/definition/users";
// import { notifyMessage } from "../messages/sendNotification";
// import { AsanaApp } from "../../AsanaApp";
// import { ButtonStyle } from '@rocket.chat/apps-engine/definition/uikit';


// export async function authorize(
//     app: AsanaApp,
//     read: IRead,
//     modify: IModify,
//     user: IUser,
//     room: IRoom,
// ): Promise<void> {
//     const url = await app
//         .getOauth2ClientInstance()
//         .getUserAuthorizationUrl(user);

//     const message = "Authorize Asana";

//     const blocks = modify.getCreator().getBlockBuilder();

//     blocks.addActionsBlock({
//         elements: [
//             blocks.newButtonElement({
//                 actionId: "authorize",
//                 text: blocks.newPlainTextObject("Connect"),
//                 url: url.toString(),
//                 style: ButtonStyle.PRIMARY,
//             }),
//         ],
//     });

//     await notifyMessage(room, read, user, message, blocks);
// }
