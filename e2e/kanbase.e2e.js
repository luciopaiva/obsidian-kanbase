import { browser, expect } from "@wdio/globals";
import { obsidianPage } from "wdio-obsidian-service";

describe("Kanbase in Obsidian", function () {
  beforeEach(async function () {
    await obsidianPage.resetVault("e2e/vault");
  });

  it("loads the plugin and registers its command", async function () {
    const state = await browser.executeObsidian(({ app, obsidian }) => {
      const icon = obsidian.getIcon("kanbase-logo");
      const frame = icon?.querySelector("rect");
      return {
        loaded: Boolean(app.plugins.plugins.kanbase),
        commandName: app.commands.commands["kanbase:create-board"]?.name,
        iconViewBox: icon?.getAttribute("viewBox"),
        iconFrameWidth: frame?.getAttribute("width"),
      };
    });

    expect(state).toEqual({
      loaded: true,
      commandName: "Kanbase: Create new board",
      iconViewBox: "0 0 100 100",
      iconFrameWidth: "84",
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

    const generatedCard = await browser.executeObsidian(async ({ app }) => {
      const file = app.vault.getAbstractFileByPath(
        "Generated/Tasks/Plan project.md",
      );
      return file ? app.vault.read(file) : null;
    });
    expect(generatedCard).toContain("kanbase_order: 0");
    expect(generatedCard).not.toContain("kanban_order:");

    const planningFilter = () =>
      browser.$(
        "//span[contains(@class, 'kanbase-filter-label') and normalize-space()='planning']/parent::span",
      );
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(1);
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(5);

    const shiftClickPlanningFilter = async () => {
      await browser.execute(
        (element) => {
          element.dispatchEvent(
            new MouseEvent("click", { bubbles: true, shiftKey: true }),
          );
        },
        await planningFilter(),
      );
    };
    await shiftClickPlanningFilter();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(4);
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(5);
    await planningFilter().click();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(1);
    await shiftClickPlanningFilter();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(4);
    await shiftClickPlanningFilter();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(5);

    const tapPlanningFilter = async () => {
      await browser.execute(
        (element) => {
          element.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              pointerType: "touch",
            }),
          );
          element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        },
        await planningFilter(),
      );
    };
    await tapPlanningFilter();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(1);
    await tapPlanningFilter();
    await expect(browser.$$(".kanbase-card")).toBeElementsArrayOfSize(4);
    await tapPlanningFilter();
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

  it("adopts legacy card order without changing the legacy property", async function () {
    const base = [
      "views:",
      "  - type: kanbase",
      "    name: Legacy order",
      "    groupBy:",
      "      property: note.status",
      "      direction: ASC",
      "    boardColumns:",
      "      - Backlog",
      "      - Done",
      "    order:",
      "      - file.name",
      "      - note.kanban_order",
      "      - note.kanbase_order",
      "",
    ].join("\n");

    await browser.executeObsidian(async ({ app, obsidian }, content) => {
      await app.vault.create("Legacy order.base", content);
      await app.vault.create(
        "Legacy A.md",
        "---\nstatus: Backlog\nkanban_order: V0\n---\n# Legacy A\n",
      );
      await app.vault.create(
        "Legacy B.md",
        "---\nstatus: Done\nkanban_order: V1\n---\n# Legacy B\n",
      );
      const file = app.vault.getAbstractFileByPath("Legacy order.base");
      if (!(file instanceof obsidian.TFile)) throw new Error("Base not found");
      await app.workspace.getLeaf(false).openFile(file);
    }, base);

    await expect(browser.$(".kanbase-container")).toExist();
    await expect(browser.$$(".kanbase-column")).toBeElementsArrayOfSize(3);
    const columns = await browser.$$(".kanbase-column");
    expect(await columns[0].getAttribute("data-column-name")).toBe("Backlog");
    expect(await columns[1].getAttribute("data-column-name")).toBe("Done");
    await columns[0]
      .$('[data-file-path="Legacy A.md"]')
      .dragAndDrop(columns[1].$(".kanbase-cards"));

    await browser.waitUntil(async () => {
      return browser.executeObsidian(({ app }) => {
        const first = app.vault.getAbstractFileByPath("Legacy A.md");
        const second = app.vault.getAbstractFileByPath("Legacy B.md");
        const firstFrontmatter = first
          ? app.metadataCache.getFileCache(first)?.frontmatter
          : null;
        const secondFrontmatter = second
          ? app.metadataCache.getFileCache(second)?.frontmatter
          : null;
        return Boolean(
          firstFrontmatter?.kanbase_order && secondFrontmatter?.kanbase_order,
        );
      });
    });

    const orders = await browser.executeObsidian(({ app }) => {
      const readOrders = (path) => {
        const file = app.vault.getAbstractFileByPath(path);
        const frontmatter = file
          ? app.metadataCache.getFileCache(file)?.frontmatter
          : null;
        return {
          status: frontmatter?.status,
          kanbase: frontmatter?.kanbase_order,
          legacy: frontmatter?.kanban_order,
        };
      };
      return {
        moved: readOrders("Legacy A.md"),
        untouched: readOrders("Legacy B.md"),
      };
    });

    expect(orders.moved.status).toBe("Done");
    expect(orders.moved.kanbase).toBe("V0");
    expect(orders.moved.legacy).toBe("V0");
    expect(orders.untouched.kanbase).toBe("V1");
    expect(orders.untouched.legacy).toBe("V1");
    await expect(
      browser.$$(
        '[data-property-id="note.kanban_order"], [data-property-id="note.kanbase_order"]',
      ),
    ).toBeElementsArrayOfSize(0);
  });

  it("hides tags required by Base filters without rewriting the Base", async function () {
    const original = [
      "filters:",
      "  and:",
      '    - file.tags.contains("smoke")',
      "views:",
      "  - type: kanbase",
      "    name: Smoke",
      "    groupBy:",
      "      property: note.status",
      "      direction: ASC",
      "",
    ].join("\n");

    await browser.executeObsidian(async ({ app, obsidian }, content) => {
      await app.vault.create("Smoke.base", content);
      await app.vault.create(
        "Card.md",
        "---\nstatus: Backlog\ntags: [smoke, visible]\n---\n# Card\n",
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
    await expect(
      browser.$(
        "//span[contains(@class, 'kanbase-filter-label') and normalize-space()='visible']",
      ),
    ).toExist();
    await expect(
      browser.$(
        "//span[contains(@class, 'kanbase-filter-label') and normalize-space()='smoke']",
      ),
    ).not.toExist();
    await expect(
      browser.$(
        "//span[contains(@class, 'kanbase-card-tag') and normalize-space()='smoke']",
      ),
    ).not.toExist();

    const content = await browser.executeObsidian(async ({ app }) => {
      const file = app.vault.getAbstractFileByPath("Smoke.base");
      return app.vault.read(file);
    });
    expect(content).toBe(original);
  });
});
