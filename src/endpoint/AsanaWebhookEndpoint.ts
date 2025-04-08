import { ApiEndpoint } from "@rocket.chat/apps-engine/definition/api";
import {
    IRead,
    IHttp,
    IModify,
    IPersistence,
    HttpStatusCode,
} from "@rocket.chat/apps-engine/definition/accessors";
import {
    IApiEndpointInfo,
    IApiEndpoint,
    IApiRequest,
    IApiResponse,
} from "@rocket.chat/apps-engine/definition/api";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { storeData } from "../lib/dataStore";
import { App } from "@rocket.chat/apps-engine/definition/App";

interface IAsanaUser {
    gid: string;
    name: string;
    resource_type: "user";
}
interface IAsanaResource {
    gid: string;
    resource_type: string;
    name?: string;
}
interface IAsanaParent extends IAsanaResource {
    resource_type: "project" | string;
}
interface IAsanaEvent {
    user?: IAsanaUser;
    created_at: string;
    action: "added" | "removed" | "deleted" | "undeleted" | "changed";
    resource: IAsanaResource;
    parent?: IAsanaParent;
}

export class AsanaWebhookEndpoint extends ApiEndpoint {
    public path = "asanawebhook";

    public async post(
        request: IApiRequest,
        endpoint: IApiEndpointInfo,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<IApiResponse> {
        // handle asana webhook handshake
        const secret = request.headers["x-hook-secret"];
        if (secret) {
            this.app
                .getLogger()
                .info("Received Asana webhook handshake request.");
            const response: IApiResponse = {
                status: HttpStatusCode.OK,
                headers: { "X-Hook-Secret": secret },
                content: {},
            };
            return response;
        }

        // for incoming events
        let events: Array<IAsanaEvent> = [];
        if (request.content?.events && Array.isArray(request.content.events)) {
            events = request.content.events;
        } else {
            this.app
                .getLogger()
                .warn(
                    "Received Asana webhook payload without a valid events array."
                );
            return this.success();
        }

        if (events.length === 0) {
            return this.success();
        }
        this.app
            .getLogger()
            .info(`Received ${events.length} Asana event(s). Processing...`);

        // find the target room (general)
        const roomName = "general"; // room is general as of now, later create room named after project name and send data there
        const room = (await read.getRoomReader().getByName(roomName)) as IRoom;
        if (!room) {
            this.app.getLogger().error(`Target room "${roomName}" not found.`);
            return this.success({ warning: `Room ${roomName} not found` });
        }

        //  Process each event
        for (const event of events) {
            try {
                // Filter for Task Change Events
                if (
                    event.resource?.resource_type === "task" &&
                    event.action === "changed"
                ) {
                    const taskGid = event.resource.gid;
                    const modifierName = event.user?.name || "Someone"; // doesnt exist as of now, event has user GID, call the API for getting user info using user GID and store userName in const and send in message
                    const projectName = event.parent?.name || ""; // doesnt exist as of now, do the same thing as above but for project using project GID

                    this.app
                        .getLogger()
                        .info(
                            `Processing 'task changed' event for Task GID: ${taskGid}`
                        );

                    // Format the Basic Notification Message
                    // Basic message without fetching details:
                    let messageText = `${modifierName} updated Asana Task \`${taskGid}\` 🔔`;
                    if (projectName) {
                        messageText += ` in project *${projectName}*`;
                    }
                    messageText += `.`;
                    const genericTaskLink = `https://app.asana.com/0/0/${taskGid}`;
                    messageText += ` [View Task](${genericTaskLink})`;

                    // Send message to the target channel
                    const messageBuilder = modify
                        .getCreator()
                        .startMessage()
                        .setRoom(room)
                        .setText(messageText);
                    await modify.getCreator().finish(messageBuilder);
                    this.app
                        .getLogger()
                        .info(
                            `Sent notification for Task GID: ${taskGid} to #${
                                room.slugifiedName || room.displayName
                            }`
                        );
                }
            } catch (error) {
                this.app
                    .getLogger()
                    .error(
                        `Error processing Asana event: ${error.message}`,
                        event
                    );
            }
        }

        return this.success();
    }
}
