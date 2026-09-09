import { App, Notice, TFile } from "obsidian";
import { sanitizeFilename } from "./constants";

export interface BoardConfig {
  name: string;
  folder: string;
  groupBy: string;
}

/** Creates a board file, its task folder, and the initial sample cards. */
export class BoardScaffolder {
  constructor(private readonly app: App) {}

  async create(config: BoardConfig): Promise<void> {
    const { name, folder, groupBy } = config;
    const vault = this.app.vault;

    const safeFolder = folder.replace(/[\\:*?"<>|]/g, "");
    const tasksFolder = `${safeFolder}/Tasks`;

    if (!vault.getAbstractFileByPath(safeFolder)) {
      await vault.createFolder(safeFolder);
    }
    if (!vault.getAbstractFileByPath(tasksFolder)) {
      await vault.createFolder(tasksFolder);
    }

    const basePath = `${safeFolder}/${name}.base`;
    if (vault.getAbstractFileByPath(basePath)) {
      new Notice(`A board already exists at "${basePath}".`);
      return;
    }

    const baseContent = [
      `filters:`,
      `  and:`,
      `    - file.inFolder("${tasksFolder}")`,
      `views:`,
      `  - type: kanban`,
      `    name: ${name}`,
      `    groupBy:`,
      `      property: note.${groupBy}`,
      `      direction: DESC`,
      `    order:`,
      `      - file.name`,
      `      - note.${groupBy}`,
      ``,
    ].join("\n");

    await vault.create(basePath, baseContent);

    const sampleTasks = [
      {
        title: "Plan project",
        value: "To Do",
        order: 0,
        tags: ["planning"],
      },
      {
        title: "Research and discovery",
        value: "To Do",
        order: 1,
        tags: ["research"],
      },
      {
        title: "Build first feature",
        value: "In Progress",
        order: 0,
        tags: ["feature"],
      },
      {
        title: "Fix onboarding bug",
        value: "In Progress",
        order: 1,
        tags: ["bug"],
      },
      {
        title: "Write documentation",
        value: "Done",
        order: 0,
        tags: ["docs"],
      },
    ];

    for (const task of sampleTasks) {
      const safeName = sanitizeFilename(task.title);
      const taskPath = `${tasksFolder}/${safeName}.md`;
      if (!vault.getAbstractFileByPath(taskPath)) {
        const tagsLine =
          task.tags.length > 0
            ? `tags:\n${task.tags.map((tag) => `  - ${tag}`).join("\n")}`
            : "";
        const content = [
          "---",
          `${groupBy}: ${task.value}`,
          `kanban_order: ${task.order}`,
          tagsLine,
          "---",
          "",
          `# ${task.title}`,
          "",
        ]
          .filter((line) => line !== "")
          .join("\n");
        await vault.create(taskPath, content);
      }
    }

    const file = vault.getAbstractFileByPath(basePath);
    if (file instanceof TFile) {
      void this.app.workspace.getLeaf(false).openFile(file);
      new Notice(`Board "${name}" created!`);
    }
  }
}
