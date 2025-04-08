import {
    IAppAccessors,
    IConfigurationExtend,
    IEnvironmentRead,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { App } from "@rocket.chat/apps-engine/definition/App";
import { IAppInfo } from "@rocket.chat/apps-engine/definition/metadata";
import { AsanaCommand } from "./src/commands/AsanaCommand";
import {
    ApiVisibility,
    ApiSecurity,
} from "@rocket.chat/apps-engine/definition/api";
import { createOAuth2Client } from "@rocket.chat/apps-engine/definition/oauth2/OAuth2";
import {
    IOAuth2Client,
    IOAuth2ClientOptions,
    IAuthData,
} from "@rocket.chat/apps-engine/definition/oauth2/IOAuth2";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { sendNotification } from "./src/messages/sendNotification";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import { clearData, getData, storeData } from "./src/lib/dataStore";
import { ASANA_TOKEN, ROOM_ID_KEY } from "./src/constants/keys";
import { OAuth2Client } from "@rocket.chat/apps-engine/server/oauth2/OAuth2Client";
import {
    UIKitBlockInteractionContext,
    IUIKitResponse,
} from "@rocket.chat/apps-engine/definition/uikit";
import { SettingEnum, settings } from "./src/config/settings";
import { AsanaWebhookEndpoint } from "./src/endpoint/AsanaWebhookEndpoint";

export class AsanaApp extends App {
    public oauth2ClientInstance: OAuth2Client;

    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    public async extendConfiguration(
        configuration: IConfigurationExtend,
        environmentRead: IEnvironmentRead
    ): Promise<void> {
        const asanaCommand = new AsanaCommand(this);

        await Promise.all([
            configuration.slashCommands.provideSlashCommand(asanaCommand),
            this.getOauth2ClientInstance().setup(configuration),
        ]);
        await Promise.all(
            settings.map((setting) =>
                configuration.settings.provideSetting(setting)
            )
        );
        configuration.api.provideApi({
            visibility: ApiVisibility.PUBLIC,
            security: ApiSecurity.UNSECURE,
            endpoints: [new AsanaWebhookEndpoint(this)],
        });
    }
    public getOauth2ClientInstance(): OAuth2Client {
        const oauthConfig: IOAuth2ClientOptions = {
            alias: "asana-app",
            accessTokenUri: "https://app.asana.com/-/oauth_token",
            authUri: "https://app.asana.com/-/oauth_authorize",
            refreshTokenUri: "https://app.asana.com/-/oauth_token",
            revokeTokenUri: "https://app.asana.com/-/oauth_revoke",
            defaultScopes: [],
            authorizationCallback: this.authorizationCallback.bind(this),
        };

        try {
            if (!this.oauth2ClientInstance) {
                this.oauth2ClientInstance = createOAuth2Client(
                    this,
                    oauthConfig
                );
            }
        } catch (error) {
            this.getLogger().error("getOauth2ClientInstance error", error);
        }
        return this.oauth2ClientInstance;
    }

    public async getWorkspaceId(): Promise<string> {
        const workspaceId = await this.getAccessors()
            .environmentReader.getSettings()
            .getValueById(SettingEnum.WORKSPACE_GID);
        if (!workspaceId || workspaceId.trim() === "") {
            this.getLogger().error(
                'Workspace GID is not set in the app settings. Please configure the "Asana.WorkspaceGid" setting.'
            );
        }
        return workspaceId;
    }

    public async authorizationCallback(
        token: IAuthData,
        user: IUser,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persistence: IPersistence
    ) {
        let text = "Asana Authentication Successful! 🚀";
        const interactionData = await getData(
            read.getPersistenceReader(),
            user.id,
            ROOM_ID_KEY
        );

        // store token
        if (token) {
            await storeData(persistence, user.id, "asanaToken", {
                token: token.token,
            });
        } else {
            text = "Asana Authentication Failed! 😔";
        }

        if (interactionData && interactionData.roomId) {
            const roomId = interactionData.roomId as string;
            const room = (await read.getRoomReader().getById(roomId)) as IRoom;
            await clearData(persistence, user.id, ROOM_ID_KEY);
            await sendNotification(read, modify, user, room, text);
        } else {
            this.getLogger().error(
                "No room context found for user:",
                user.username
            );
        }

        return {
            statusCode: 200,
            content:
                "Authentication successful. You can now close this window.",
        };
    }
}
