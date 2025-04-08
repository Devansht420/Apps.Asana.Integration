import { ISetting, SettingType } from '@rocket.chat/apps-engine/definition/settings';

export enum SettingEnum {
    WORKSPACE_GID = 'workspace-gid',
}

export const settings: ISetting[] = [
    {
        id: SettingEnum.WORKSPACE_GID,
        public: true,
        type: SettingType.STRING,
        packageValue: '',
        i18nLabel: 'Workspace_GID',
        i18nDescription: 'Enter your Asana Workspace GID here.',
        required: true,
    },
];