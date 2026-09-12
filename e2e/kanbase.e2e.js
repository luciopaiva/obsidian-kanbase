import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

describe("Kanbase in Obsidian", function () {
  beforeEach(async function () {
    await obsidianPage.resetVault("e2e/vault");
  });

  it("loads the plugin and registers its command", async function () {
    const state = await browser.executeObsidian(({ app }) => ({
      loaded: Boolean(app.plugins.plugins.kanbase),
      baseBoardLoaded: Boolean(app.plugins.plugins["base-board"]),
      commandName: app.commands.commands["kanbase:create-board"]?.name,
    }));

    expect(state).toEqual({
      loaded: true,
      baseBoardLoaded: true,
      commandName: "Kanbase: Create new board",
    });
  });

  it("creates and exercises a board through the real Bases UI", async function () {
    await browser.executeObsidianCommand("kanbase:create-board");
    const modal = browser.$(".modal-content");
    await expect(modal).toExist();
    const inputs = await modal.$$("input");
    await inputs[0].setValue("Generated");
    await modal.$("button=Create").click();

    await expect(browser.$(".kanbase-container")).toExist();
    await expect(browser.$(".kanbase-toolbar-title")).toHaveText(
      "Generated Kanbase",
    );
    await expect(browser.$$(".kanbase-column")).toBeElementsArrayOfSize(3);
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(5);

    const generatedBase = await browser.executeObsidian(async ({ app }) => {
      const file = app.vault.getAbstractFileByPath("Generated/Generated.base");
      return file ? app.vault.read(file) : null;
    });
    expect(generatedBase).toContain("type: kanbase");
    expect(generatedBase).toContain("property: note.status");

    const planningFilter = () =>
      browser.$(
        "//span[contains(@class, 'kanbase-filter-label') and normalize-space()='planning']/parent::span",
      );
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(1);
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(4);
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(5);

    const columns = await browser.$$(".kanbase-column");
    const firstColumn = columns[0];
    const targetColumn = columns[columns.length - 1];
    const targetStatus = await targetColumn.getAttribute("data-column-name");
    const sourceCard = firstColumn.$(".kanbase-card");
    const sourcePath = await sourceCard.getAttribute("data-file-path");
    await sourceCard.dragAndDrop(targetColumn.$(".kanbase-cards"));
    await browser.waitUntil(async () => {
      return browser.executeObsidian(
        ({ app }, path, status) => {
          const file = app.vault.getAbstractFileByPath(path);
          return (
            app.metadataCache.getFileCache(file)?.frontmatter?.status === status
          );
        },
        sourcePath,
        targetStatus,
      );
    });

    const movedCard = browser.$(`[data-file-path="${sourcePath}"]`);
    await browser.pause(200);
    await movedCard.click();
    await browser.waitUntil(async () => {
      const activePath = await browser.executeObsidian(
        ({ app }) => app.workspace.getActiveFile()?.path,
      );
      return activePath === sourcePath;
    });

    await browser.executeObsidian(async ({ app, obsidian }) => {
      const file = app.vault.getAbstractFileByPath("Generated/Generated.base");
      if (!(file instanceof obsidian.TFile)) throw new Error("Base not found");
      await app.workspace.getLeaf(false).openFile(file);
    });
    await expect(browser.$(".kanbase-container")).toExist();

    const firstColumnAfterOpen = browser.$(".kanbase-column");
    await firstColumnAfterOpen.$(".kanbase-column-add-card").click();
    const cardInput = firstColumnAfterOpen.$(".kanbase-add-card-input");
    await cardInput.setValue("E2E-created card");
    await browser.keys("Enter");
    await expect(
      browser.$(
        "//div[contains(@class, 'kanbase-card-title') and contains(., 'E2E-created card')]",
      ),
    ).toExist();
    await browser.keys("Escape");
    await browser.waitUntil(
      async () => !(await browser.$(".modal-container").isExisting()),
    );

    const filterToggle = browser.$('[aria-label="Hide tag filters"]');
    await browser.execute((element) => element.click(), await filterToggle);
    await expect(browser.$('[aria-label="Show tag filters"]')).toExist();
    await browser.waitUntil(async () => {
      const content = await browser.executeObsidian(async ({ app }) => {
        const file = app.vault.getAbstractFileByPath(
          "Generated/Generated.base",
        );
        return file ? app.vault.read(file) : "";
      });
      return content.includes("tagFiltersVisible: false");
    });
    await browser.executeObsidian(async ({ app, obsidian }) => {
      const leaf = app.workspace.activeLeaf;
      if (!leaf) throw new Error("Active leaf not found");
      const file = app.vault.getAbstractFileByPath("Generated/Generated.base");
      if (!(file instanceof obsidian.TFile)) throw new Error("Base not found");
      await leaf.setViewState({ type: "empty" });
      await leaf.openFile(file);
    });
    await expect(browser.$(".kanbase-container")).toExist();
    await expect(browser.$('[aria-label="Show tag filters"]')).toExist();
  });

  it("opens a Kanbase view without rewriting a coexisting legacy view", async function () {
    const original = [
      "views:",
      "  - type: kanbase",
      "    name: Smoke",
      "    groupBy:",
      "      property: note.status",
      "      direction: ASC",
      "  - type: kanban",
      "    name: Legacy board",
      "    boardColumns:",
      "      - Backlog",
      "      - Done",
      "",
    ].join("\n");

    await browser.executeObsidian(async ({ app, obsidian }, content) => {
      await app.vault.create("Smoke.base", content);
      await app.vault.create(
        "Card.md",
        "---\nstatus: Backlog\ntags: [smoke]\n---\n# Card\n",
      );
      const file = app.vault.getAbstractFileByPath("Smoke.base");
      if (!(file instanceof obsidian.TFile))
        throw new Error("Base not created");
      await app.workspace.getLeaf(false).openFile(file);
    }, original);

    await expect(browser.$(".kanbase-container")).toExist();
    await expect(browser.$(".kanbase-toolbar-title")).toHaveText(
      "Smoke Kanbase",
    );

    const content = await browser.executeObsidian(async ({ app }) => {
      const file = app.vault.getAbstractFileByPath("Smoke.base");
      return app.vault.read(file);
    });
    expect(content).toContain("type: kanban");
    expect(content).toContain("type: kanbase");
    expect(content).toContain("name: Legacy board");
  });
});
