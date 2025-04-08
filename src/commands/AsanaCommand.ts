import {
    IHttp,
    IModify,
    IPersistence,
    IRead,
} from "@rocket.chat/apps-engine/definition/accessors";
import { IRoom } from "@rocket.chat/apps-engine/definition/rooms";
import {
    ISlashCommand,
    SlashCommandContext,
} from "@rocket.chat/apps-engine/definition/slashcommands";
import { IUser } from "@rocket.chat/apps-engine/definition/users";
import { sendMessage } from "../messages/sendMessage";
import { sendNotification } from "../messages/sendNotification";
import { helpMessage } from "../helpers/helpMessage";
import { AsanaApp } from "../../AsanaApp";
import { authorize } from "../modal/authModal";
import { getData, clearData } from "../lib/dataStore";
import { ASANA_TOKEN } from "../constants/keys";

export class AsanaCommand implements ISlashCommand {
    public command = "asana";
    public i18nParamsExample = "";
    public i18nDescription = "";
    public providesPreview = false;

    private readonly app: AsanaApp;

    constructor(app: AsanaApp) {
        this.app = app;
    }

    public async executor(
        context: SlashCommandContext,
        read: IRead,
        modify: IModify,
        http: IHttp,
        persis: IPersistence
    ): Promise<void> {
        const args = context.getArguments();
        const user = context.getSender();
        const room: IRoom = context.getRoom();

        const [subcommand] = args;
        if (!subcommand) {
            await sendNotification(
                read,
                modify,
                user,
                room,
                "Please input a valid prompt or subcommand (connect/tasks/help)."
            );
            throw new Error("Error!");
        }

        switch (subcommand) {
            case "help":
                await sendNotification(read, modify, user, room, helpMessage);
                break;
            case "connect":
                await authorize(this.app, read, modify, user, room, persis);
                break;
            case "projects": {
                const storedData = await getData(
                    read.getPersistenceReader(),
                    user.id,
                    "asanaToken"
                );
                if (!storedData || !storedData.token) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "You are not connected to Asana. Please run /asana connect first."
                    );
                    break;
                }
                const token = storedData.token;

                const workspaceId = await this.app.getWorkspaceId();
                if (!workspaceId || workspaceId.trim() === "") {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Workspace GID is not set in the app settings. Please configure it."
                    );
                    break;
                }

                // Get all projects for the workspace
                const projectsUrl = `https://app.asana.com/api/1.0/workspaces/${workspaceId}/projects?opt_fields=name,gid`;
                const projectsResponse = await http.get(projectsUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (projectsResponse.statusCode !== 200) {
                    this.app
                        .getLogger()
                        .error(
                            "Failed to retrieve projects. Status:",
                            projectsResponse.statusCode,
                            "Content:",
                            projectsResponse.content
                        );
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Failed to retrieve projects from Asana."
                    );
                    break;
                }
                const projects = projectsResponse.data.data;
                if (!projects || projects.length === 0) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "No projects found in your workspace."
                    );
                    break;
                }

                let message =
                    "*Projects In Your Workspace With Their Tasks -*\n\n";

                const getCustomFieldValue = (
                    customFields: any[],
                    fieldName: string
                ): string => {
                    for (const field of customFields) {
                        if (
                            field.name &&
                            field.name.toLowerCase() === fieldName.toLowerCase()
                        ) {
                            if (
                                field.type === "enum" &&
                                field.enum_value &&
                                field.enum_value.name
                            ) {
                                return field.enum_value.name;
                            }
                            return (
                                field.text_value || field.display_value || ""
                            );
                        }
                    }
                    return "";
                };

                // For each project, get tasks and format output
                for (const project of projects) {
                    const projectName = project.name;
                    const projectId = project.gid;
                    // URL to fetch tasks for the project
                    const projectTasksUrl = `https://app.asana.com/api/1.0/tasks?project=${projectId}&opt_fields=name,permalink_url,assignee.name,due_on,custom_fields`;
                    const projectTasksResponse = await http.get(
                        projectTasksUrl,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (projectTasksResponse.statusCode !== 200) {
                        this.app
                            .getLogger()
                            .error(
                                `Failed to retrieve tasks for project ${projectName}. Status:`,
                                projectTasksResponse.statusCode
                            );
                        continue;
                    }
                    const projectTasks = projectTasksResponse.data.data;
                    if (!projectTasks || projectTasks.length === 0) {
                        continue;
                    }
                    message += `*${projectName}* -\n`;
                    for (const task of projectTasks) {
                        const taskName = task.name;
                        const taskLink = task.permalink_url;
                        const assigneeName =
                            task.assignee && task.assignee.name
                                ? task.assignee.name
                                : "Unassigned";
                        const status = task.custom_fields
                            ? getCustomFieldValue(task.custom_fields, "Status")
                            : "";
                        const priority = task.custom_fields
                            ? getCustomFieldValue(
                                  task.custom_fields,
                                  "Priority"
                              )
                            : "";
                        const dueDate = task.due_on || "No due date";
                        let taskLine = `• [${taskName}](${taskLink})`;
                        if (assigneeName)
                            taskLine += ` *Assignee*- ${assigneeName}`;
                        if (status) taskLine += ` *Status*- ${status}`;
                        if (priority) taskLine += ` *Priority*- ${priority}`;
                        if (dueDate) taskLine += ` *Due Date*- ${dueDate}`;
                        taskLine += `\n`;
                        message += taskLine;
                    }
                    message += `\n`;
                }

                await sendNotification(read, modify, user, room, message);
                break;
            }

            case "my-tasks": {
                const storedData = await getData(
                    read.getPersistenceReader(),
                    user.id,
                    "asanaToken"
                );
                if (!storedData || !storedData.token) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "You are not connected to Asana. Please run /asana connect first."
                    );
                    break;
                }
                const token = storedData.token;

                // Get the user ID
                const userInfoUrl = `https://app.asana.com/api/1.0/users/me`;
                const userInfoResponse = await http.get(userInfoUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (userInfoResponse.statusCode !== 200) {
                    this.app
                        .getLogger()
                        .error(
                            "Failed to retrieve user info. Status:",
                            userInfoResponse.statusCode,
                            "Content:",
                            userInfoResponse.content
                        );
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Failed to retrieve Asana user info. Please ensure you are logged in."
                    );
                    break;
                }

                const userGid = userInfoResponse.data.data.gid;

                const workspaceId = await this.app.getWorkspaceId();
                if (!workspaceId || workspaceId.trim() === "") {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Workspace GID is not set in the app settings. Please configure it."
                    );
                    break;
                }

                // get the User Task List GID
                const userTaskListUrl = `https://app.asana.com/api/1.0/users/${userGid}/user_task_list?workspace=${workspaceId}`;
                const userTaskListResponse = await http.get(userTaskListUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (userTaskListResponse.statusCode !== 200) {
                    this.app
                        .getLogger()
                        .error(
                            "Failed to retrieve user task list. Status:",
                            userTaskListResponse.statusCode,
                            "Content:",
                            userTaskListResponse.content
                        );
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Failed to retrieve your Asana task list."
                    );
                    break;
                }

                const userTaskListGid = userTaskListResponse.data.data.gid;

                // get tasks from the User Task List
                const tasksUrl = `https://app.asana.com/api/1.0/user_task_lists/${userTaskListGid}/tasks?opt_fields=name,permalink_url,assignee.name,due_on,custom_fields`;
                const tasksResponse = await http.get(tasksUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (tasksResponse.statusCode !== 200) {
                    this.app
                        .getLogger()
                        .error(
                            "Failed to retrieve tasks. Status:",
                            tasksResponse.statusCode,
                            "Content:",
                            tasksResponse.content
                        );
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Failed to retrieve tasks from your Asana My Tasks list."
                    );
                    break;
                }

                const tasks = tasksResponse.data.data;
                if (!tasks || tasks.length === 0) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "No tasks found in your Asana My Tasks list."
                    );
                    break;
                }

                let message = `*Your Asana My Tasks List* -\n`;

                const getCustomFieldValue = (
                    customFields: any[],
                    fieldName: string
                ): string => {
                    for (const field of customFields) {
                        if (
                            field.name &&
                            field.name.toLowerCase() === fieldName.toLowerCase()
                        ) {
                            if (
                                field.type === "enum" &&
                                field.enum_value &&
                                field.enum_value.name
                            ) {
                                return field.enum_value.name;
                            }
                            return (
                                field.text_value || field.display_value || ""
                            );
                        }
                    }
                    return "";
                };

                // format and send the message
                for (const task of tasks) {
                    const taskName = task.name;
                    const taskLink = task.permalink_url;
                    const assigneeName =
                        task.assignee && task.assignee.name
                            ? task.assignee.name
                            : "Unassigned";
                    const status = task.custom_fields
                        ? getCustomFieldValue(task.custom_fields, "Status")
                        : "";
                    const priority = task.custom_fields
                        ? getCustomFieldValue(task.custom_fields, "Priority")
                        : "";
                    const dueDate = task.due_on || "No due date";
                    message += `• [${taskName}](${taskLink})`;
                    if (assigneeName) message += ` *Assignee*- ${assigneeName}`;
                    if (status) message += ` *Status*- ${status}`;
                    if (priority) message += ` *Priority*- ${priority}`;
                    if (dueDate) message += ` *Due Date*- ${dueDate}`;
                    message += `\n`;
                }

                await sendNotification(read, modify, user, room, message);
                break;
            }
            case "feed": {
                // get stored token data (saved under key 'asanaToken')
                const storedData = await getData(
                    read.getPersistenceReader(),
                    user.id,
                    "asanaToken"
                );
                if (!storedData || !storedData.token) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "You are not connected to Asana. Please run /asana connect first."
                    );
                    break;
                }
                const token = storedData.token;

                // get the workspace ID from settings
                const workspaceId = await this.app.getWorkspaceId();
                if (!workspaceId || workspaceId.trim() === "") {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Workspace GID is not configured."
                    );
                    break;
                }

                // compute the timestamp for 24 hours ago in ISO format
                const now = new Date();
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                const cutoffTimestamp = yesterday.toISOString();

                // get all projects for the workspace
                const projectsUrl = `https://app.asana.com/api/1.0/workspaces/${workspaceId}/projects?opt_fields=name,gid&limit=100`;
                const projectsResponse = await http.get(projectsUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (projectsResponse.statusCode !== 200) {
                    this.app
                        .getLogger()
                        .error(
                            "Failed to retrieve projects. Status:",
                            projectsResponse.statusCode,
                            "Content:",
                            projectsResponse.content
                        );
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "Failed to retrieve projects from Asana."
                    );
                    break;
                }
                const projects = projectsResponse.data.data;
                if (!projects || projects.length === 0) {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "No projects found in your workspace."
                    );
                    break;
                }

                let message = "";

                // helper function for extracting custom field values
                const getCustomFieldValue = (
                    customFields: any[],
                    fieldName: string
                ): string => {
                    for (const field of customFields) {
                        if (
                            field.name &&
                            field.name.toLowerCase() === fieldName.toLowerCase()
                        ) {
                            if (
                                field.type === "enum" &&
                                field.enum_value &&
                                field.enum_value.name
                            ) {
                                return field.enum_value.name;
                            }
                            return (
                                field.text_value || field.display_value || ""
                            );
                        }
                    }
                    return "";
                };

                for (const project of projects) {
                    const projectName = project.name;
                    const projectId = project.gid;
                    // URL to fetch tasks for the project
                    const projectTasksUrl = `https://app.asana.com/api/1.0/tasks?project=${projectId}&opt_fields=name,permalink_url,created_at,assignee.name,due_on,custom_fields&limit=100`;
                    const projectTasksResponse = await http.get(
                        projectTasksUrl,
                        {
                            headers: { Authorization: `Bearer ${token}` },
                        }
                    );
                    if (projectTasksResponse.statusCode !== 200) {
                        this.app
                            .getLogger()
                            .error(
                                `Failed to retrieve tasks for project ${projectName}. Status:`,
                                projectTasksResponse.statusCode
                            );
                        continue;
                    }
                    const projectTasks = projectTasksResponse.data.data;
                    if (!projectTasks || projectTasks.length === 0) {
                        continue;
                    }

                    // filter tasks that were created in the last 24 hours
                    const recentTasks = projectTasks.filter((task: any) => {
                        return (
                            task.created_at && task.created_at > cutoffTimestamp
                        );
                    });
                    if (recentTasks.length === 0) {
                        continue;
                    }

                    // Add projectn name
                    message += `*${projectName}* -\n`;
                    for (const task of recentTasks) {
                        const taskName = task.name;
                        const taskLink = task.permalink_url;
                        const assigneeName =
                            task.assignee && task.assignee.name
                                ? task.assignee.name
                                : "Unassigned";
                        const status = task.custom_fields
                            ? getCustomFieldValue(task.custom_fields, "Status")
                            : "";
                        const priority = task.custom_fields
                            ? getCustomFieldValue(
                                  task.custom_fields,
                                  "Priority"
                              )
                            : "";
                        const dueDate = task.due_on || "No due date";
                        message += `• [${taskName}](${taskLink})`;
                        if (assigneeName)
                            message += ` *Assignee*- ${assigneeName}`;
                        if (status) message += ` *Status*- ${status}`;
                        if (priority) message += ` *Priority*- ${priority}`;
                        if (dueDate) message += ` *Due Date*- ${dueDate}`;
                        message += `\n`;
                    }
                    message += `\n`;
                }

                // If no tasks were found across all projects, notify the user.
                if (message.trim() === "") {
                    await sendNotification(
                        read,
                        modify,
                        user,
                        room,
                        "No tasks were created in the last 24 hours in your workspace."
                    );
                } else {
                    await sendNotification(read, modify, user, room, message);
                }
                break;
            }

            case "summary":
                await sendNotification(
                    read,
                    modify,
                    user,
                    room,
                    "Asana Summary"
                );
                break;

            case "subscribe":
            // implement logic for calling Asana API for establishing a webhook with resource ID and RC post URI
            default:
                throw new Error("Error");
        }
    }
}
