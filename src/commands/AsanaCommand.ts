import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { IRoom } from '@rocket.chat/apps-engine/definition/rooms';
import {
    ISlashCommand,
    SlashCommandContext,
} from '@rocket.chat/apps-engine/definition/slashcommands';
import { IUser } from '@rocket.chat/apps-engine/definition/users';
import { sendMessage } from '../messages/sendMessage'
import { notifyMessage } from '../messages/sendNotification';
import { helpMessage } from '../helpers/helpMessage';
import { authorize } from '../modal/authModal';
import { AsanaApp } from '../../AsanaApp';

export class AsanaCommand implements ISlashCommand{
    public command = 'asana';
    public i18nParamsExample = '';
    public i18nDescription = '';
    public providesPreview = false;

    private readonly app: AsanaApp;

    constructor(app: AsanaApp) {
        this.app = app;
    }

    public async executor(context: SlashCommandContext, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<void> {
        const args = context.getArguments();
        const user = context.getSender();
        const room: IRoom = context.getRoom();


        const [subcommand] = args;
        if (!subcommand) {
            await notifyMessage(room, read, user, "Please input a valid prompt or subcommand!", ":warning:");
            throw new Error("Error!");
        }

        switch(subcommand){

            case 'help':
                await notifyMessage(room, read, user, helpMessage);
                break;
            case 'connect':
                await authorize(
                    this.app,
                    read,
                    modify,
                    user,
                    room,
                );
            case 'task':
                await notifyMessage(room, read, user, 'asana tasks');
                break;

            case 'summary':
                await notifyMessage(room, read, user, 'Asana Summary');
                break;
            default:
                throw new Error('Error');
        }
    }
}
