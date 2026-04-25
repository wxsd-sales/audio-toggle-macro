import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const MACS = {
  group1Primary: "11:11:11:11:11:11",
  group1Secondary: "22:22:22:22:22:22",
  group2Primary: "33:33:33:33:33:33",
  group2Secondary: "44:44:44:44:44:44",
  group3Primary: "55:55:55:55:55:55",
};

const PRODUCT_PLATFORMS = [
  "Desk Pro",
  "Room Bar Pro",
  "Codec EQ",
  "Codec Pro",
  "Codec Pro G2",
];

async function flushMacroTasks() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function seedEthernetConnectorStreams(xapi, streamsByConnectorId) {
  for (const [connectorId, streamName] of Object.entries(streamsByConnectorId)) {
    try {
      await xapi.Status.Audio.Input.Connectors.Ethernet[
        connectorId
      ].StreamName.set(streamName);
    } catch {
      // Product-scoped xAPI mocks reject ethernet paths on devices without them.
    }
  }
}

function mockUiExtensionCommands(xapi) {
  xapi.Command.UserInterface.Message.Prompt.Display.mockResolvedValue({
    status: "OK",
  });
  xapi.Command.UserInterface.Extensions.Icon.List.mockResolvedValue({
    Icon: [],
  });
  xapi.Command.UserInterface.Extensions.Icon.Upload.mockResolvedValue({
    status: "OK",
  });
  xapi.Command.UserInterface.Extensions.Icon.Delete.mockResolvedValue({
    status: "OK",
  });
  xapi.Command.UserInterface.Extensions.List.mockResolvedValue({
    Extensions: {
      Panel: [],
    },
  });
  xapi.Command.UserInterface.Extensions.Panel.Save.mockResolvedValue({
    status: "OK",
  });
  xapi.Command.UserInterface.Extensions.Panel.Remove.mockResolvedValue({
    status: "OK",
  });
}

function getPanelSaveCalls(xapi, panelId) {
  return xapi.Command.UserInterface.Extensions.Panel.Save.mock.calls.filter(
    ([params]) => params?.PanelId == panelId,
  );
}

function getLastPanelXml(xapi, panelId) {
  const calls = getPanelSaveCalls(xapi, panelId);
  return calls.at(-1)?.[1];
}

async function loadMacroWithXapi({ activeCalls, productPlatform } = {}) {
  const { default: xapi } = await import("xapi");

  jest.clearAllMocks();
  xapi.removeAllListeners();
  mockUiExtensionCommands(xapi);

  if (productPlatform) {
    await xapi.Status.SystemUnit.ProductPlatform.set(productPlatform);
  }

  if (typeof activeCalls != "undefined") {
    await xapi.Status.SystemUnit.State.NumberOfActiveCalls.set(activeCalls);
  }

  await seedEthernetConnectorStreams(xapi, {
    1: MACS.group1Primary,
    2: MACS.group1Secondary,
    3: MACS.group2Primary,
    4: MACS.group2Secondary,
  });

  await import("./audio-toggle.js");
  await flushMacroTasks();

  return xapi;
}

describe("audio-toggle macro", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates group panels and applies the configured default audio modes", async () => {
    const xapi = await loadMacroWithXapi();

    expect(xapi.Command.UserInterface.Extensions.Panel.Save).toHaveBeenCalledWith(
      { PanelId: "audioToggle-0" },
      expect.stringContaining("<CustomIcon><Id>audioToggleGreen</Id></CustomIcon>"),
    );
    expect(xapi.Command.UserInterface.Extensions.Panel.Save).toHaveBeenCalledWith(
      { PanelId: "audioToggle-2" },
      expect.stringContaining("<CustomIcon><Id>audioToggleRed</Id></CustomIcon>"),
    );

    expect(xapi.Config.Audio.Input.Ethernet[1].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Ethernet[2].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Ethernet[3].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Ethernet[4].Mode.get()).toBe("On");

    expect(xapi.Config.Audio.Input.Microphone[1].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Microphone[2].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Microphone[5].Mode.get()).toBe("Off");
    expect(xapi.Config.Audio.Input.Microphone[6].Mode.get()).toBe("Off");
  });

  it("saves custom icon IDs with alphanumeric-only characters", async () => {
    const xapi = await loadMacroWithXapi();
    const uploadedIconIds =
      xapi.Command.UserInterface.Extensions.Icon.Upload.mock.calls.map(
        ([{ Id }]) => Id,
      );

    expect(uploadedIconIds).toEqual([
      "audioToggleRed",
      "audioToggleGreen",
      "audioToggleOrange",
    ]);

    for (let i = 0; i < uploadedIconIds.length; i++) {
      expect(uploadedIconIds[i]).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("toggles every audio input in a group when that group button is tapped", async () => {
    const xapi = await loadMacroWithXapi();

    xapi.Event.UserInterface.Extensions.Panel.Clicked.emit({
      PanelId: "audioToggle-0",
    });
    await flushMacroTasks();

    expect(xapi.Config.Audio.Input.Ethernet[1].Mode.get()).toBe("Off");
    expect(xapi.Config.Audio.Input.Ethernet[2].Mode.get()).toBe("Off");
    expect(xapi.Config.Audio.Input.Microphone[1].Mode.get()).toBe("Off");
    expect(xapi.Config.Audio.Input.Microphone[2].Mode.get()).toBe("Off");

    expect(xapi.Command.UserInterface.Extensions.Panel.Save).toHaveBeenCalledWith(
      { PanelId: "audioToggle-0" },
      expect.stringContaining("<CustomIcon><Id>audioToggleRed</Id></CustomIcon>"),
    );
  });

  it("resolves ethernet microphone IDs from stream names at toggle time", async () => {
    const xapi = await loadMacroWithXapi();

    await seedEthernetConnectorStreams(xapi, {
      5: "unused-stream",
      6: MACS.group3Primary,
    });

    xapi.Event.UserInterface.Extensions.Panel.Clicked.emit({
      PanelId: "audioToggle-2",
    });
    await flushMacroTasks();

    expect(xapi.Config.Audio.Input.Ethernet[6].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Microphone[5].Mode.get()).toBe("On");
    expect(xapi.Config.Audio.Input.Microphone[6].Mode.get()).toBe("On");
  });

  it("shows a prompt when a call ends before resetting audio defaults", async () => {
    const xapi = await loadMacroWithXapi({ activeCalls: 1 });
    xapi.Command.UserInterface.Message.Prompt.Display.mockClear();

    jest.useFakeTimers();
    try {
      await xapi.Status.SystemUnit.State.NumberOfActiveCalls.set(0);

      expect(
        xapi.Command.UserInterface.Message.Prompt.Display,
      ).toHaveBeenCalledWith({
        Duration: 300,
        FeedbackId: "audioToggle",
        "Option.1": "Cancel Audio Reset",
        "Option.2": "Reset Audio Now",
        Text: "Audio settings will reset to defaults in 5 minutes.",
        Title: "Audio Settings",
      });
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("updates the group button color when admins change mic config directly", async () => {
    const xapi = await loadMacroWithXapi();
    const panelId = "audioToggle-0";

    xapi.Command.UserInterface.Extensions.Panel.Save.mockClear();

    xapi.Config.Audio.Input.Microphone[1].Mode.set("Off");
    await flushMacroTasks();

    expect(getLastPanelXml(xapi, panelId)).toEqual(
      expect.stringContaining("<CustomIcon><Id>audioToggleOrange</Id></CustomIcon>"),
    );

    xapi.Config.Audio.Input.Ethernet[1].Mode.set("Off");
    xapi.Config.Audio.Input.Ethernet[2].Mode.set("Off");
    xapi.Config.Audio.Input.Microphone[2].Mode.set("Off");
    await flushMacroTasks();

    expect(getLastPanelXml(xapi, panelId)).toEqual(
      expect.stringContaining("<CustomIcon><Id>audioToggleRed</Id></CustomIcon>"),
    );

    xapi.Config.Audio.Input.Ethernet[1].Mode.set("On");
    xapi.Config.Audio.Input.Ethernet[2].Mode.set("On");
    xapi.Config.Audio.Input.Microphone[1].Mode.set("On");
    xapi.Config.Audio.Input.Microphone[2].Mode.set("On");
    await flushMacroTasks();

    expect(getLastPanelXml(xapi, panelId)).toEqual(
      expect.stringContaining("<CustomIcon><Id>audioToggleGreen</Id></CustomIcon>"),
    );
  });

  it.each(PRODUCT_PLATFORMS)(
    "starts cleanly with product-scoped xAPI paths for %s",
    async (productPlatform) => {
      const xapi = await loadMacroWithXapi({ productPlatform });

      expect(
        xapi.Command.UserInterface.Extensions.Panel.Save,
      ).toHaveBeenCalledWith(
        { PanelId: "audioToggle-0" },
        expect.stringContaining("<CustomIcon><Id>"),
      );
      expect(console.error).not.toHaveBeenCalled();
    },
  );
});
