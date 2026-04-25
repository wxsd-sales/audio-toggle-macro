/********************************************************
 *
 * Macro Author:      	William Mills
 *                    	Solutions Specialist
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 *
 * Version: 1-0-0
 * Released: 03/19/26
 *
 * This is an example macro that shows how to create custom
 * action buttons that act as a toggle group which can be
 * used to apply audio configuration changes.
 *
 * Full Readme, source code and license details for this macro
 * are available on GitHub:
 * https://github.com/wxsd-sales/audio-toggle-macro
 *
 ********************************************************/

import xapi from "xapi";

/*********************************************************
 * Configure the settings below
 **********************************************************/

const groups = [
  // Array of Toggle Modes
  {
    name: "Group 1", // Give the group a unique name
    ethernetMacs: ["11:11:11:11:11:11", "22:22:22:22:22:22"],
    microphoneIds: [1, 2],
    default: true,
  },
  {
    name: "Group 2", // Give the group a unique name
    ethernetMacs: ["33:33:33:33:33:33", "44:44:44:44:44:44"],
    microphoneIds: [3, 4],
    default: true,
  },
  {
    name: "Group 3", // Give the group a unique name
    ethernetMacs: ["55:55:55:55:55:55", "66:66:66:66:66:66"],
    microphoneIds: [5, 6],
    default: false,
  },
  {
    name: "Group 4", // Give the group a unique name
    ethernetMacs: ["77:77:77:77:77:77", "88:88:88:88:88:88"],
    microphoneIds: [7, 8],
    default: false,
  },
];

const applyDefaultAfterCall = true;
const applyDefaultDelayMinutes = 5;

/*********************************************************
 * Do not change below
 **********************************************************/

const panelId = "audioToggle";
const ethernetMicIdByMac = Object.create(null);
const groupModeOn = "On";
const groupModeOff = "Off";
const groupModeMixed = "Mixed";
const groupIconIds = {
  [groupModeOn]: "green",
  [groupModeOff]: "red",
  [groupModeMixed]: "orange",
};
let groupModes = [];
let hadActiveCall = false;
let defaultTimerId;
let syncSuspended = false;
let ethernetStatusAvailable = true;

init();

async function init() {
  if (typeof groups == "undefined") {
    console.log("Groups Not Defined - Macro Will Not Continue Startup");
    await deleteButtons();
    return;
  }

  if (!validateGroupsConfig(groups)) {
    await deleteButtons();
    return;
  }

  subscribeToConfigChanges();

  await saveIcons();

  await deleteButtons();

  await mapEthernetMics();

  await selectDefault();

  subscribeToXapiPath("panel clicks", () =>
    xapi.Event.UserInterface.Extensions.Panel.Clicked.on(processPanelClicks),
  );

  if (!applyDefaultAfterCall) return;

  const numOfCalls = await getXapiValue("active call status", () =>
    xapi.Status.SystemUnit.State.NumberOfActiveCalls.get(),
  );

  if (typeof numOfCalls == "undefined") return;

  processCalls(numOfCalls);
  subscribeToXapiPath("active call status", () =>
    xapi.Status.SystemUnit.State.NumberOfActiveCalls.on(processCalls),
  );
}

function processCalls(value) {
  const activeCalls = Number(value);
  console.log("Number of Calls:", activeCalls);

  if (defaultTimerId) {
    clearTimeout(defaultTimerId);
    defaultTimerId = undefined;
  }

  if (activeCalls > 0) {
    hadActiveCall = true;
    return;
  }

  if (!hadActiveCall) return;

  hadActiveCall = false;

  defaultTimerId = setTimeout(
    selectDefault,
    applyDefaultDelayMinutes * 60 * 1000,
  );

  // TODO show dismisable alert that audio settings will reset to defaults in 5 minutes
}

function validateGroupsConfig(groupsConfig) {
  const errors = [];
  const names = Object.create(null);
  const usedValues = Object.create(null);
  const valueProperties = ["ethernetMacs", "microphoneIds", "usbMicrophone"];

  if (!Array.isArray(groupsConfig)) {
    errors.push("Groups config must be an array.");
  } else {
    if (groupsConfig.length == 0) {
      errors.push("At least one group must be configured.");
    }

    if (groupsConfig.length > 4) {
      errors.push("No more than 4 groups can be configured.");
    }

    for (let groupIndex = 0; groupIndex < groupsConfig.length; groupIndex++) {
      const group = groupsConfig[groupIndex];
      const groupLabel = `Group ${groupIndex + 1}`;

      if (typeof group != "object" || group == null || Array.isArray(group)) {
        errors.push(`${groupLabel} must be an object.`);
        continue;
      }

      const name = typeof group.name == "string" ? group.name.trim() : "";
      const nameKey = name.toLowerCase();

      if (!name) {
        errors.push(`${groupLabel} must have a non-blank name.`);
      } else if (names[nameKey]) {
        errors.push(
          `${groupLabel} name "${name}" is already used by ${names[nameKey]}.`,
        );
      } else {
        names[nameKey] = groupLabel;
      }

      let hasConfigValue = false;
      const groupValues = Object.create(null);

      for (let i = 0; i < valueProperties.length; i++) {
        const propertyName = valueProperties[i];
        const values = group[propertyName];

        if (typeof values == "undefined") continue;

        if (!Array.isArray(values)) {
          errors.push(`${groupLabel} ${propertyName} must be an array.`);
          continue;
        }

        for (let valueIndex = 0; valueIndex < values.length; valueIndex++) {
          const originalValue = values[valueIndex];
          const value = normalizeConfigValue(originalValue);

          if (!value) {
            errors.push(
              `${groupLabel} ${propertyName}[${valueIndex}] cannot be blank.`,
            );
            continue;
          }

          hasConfigValue = true;

          const valueKey = `${propertyName}:${value}`;

          if (groupValues[valueKey]) {
            errors.push(
              `${groupLabel} ${propertyName} value "${originalValue}" is duplicated in the same group.`,
            );
            continue;
          }

          groupValues[valueKey] = true;

          if (usedValues[valueKey]) {
            errors.push(
              `${groupLabel} ${propertyName} value "${originalValue}" is already used by ${usedValues[valueKey]}.`,
            );
          } else {
            usedValues[valueKey] = name || groupLabel;
          }
        }
      }

      if (!hasConfigValue) {
        errors.push(
          `${groupLabel} must have at least one ethernetMacs, microphoneIds, or usbMicrophone value.`,
        );
      }
    }
  }

  if (errors.length == 0) {
    console.log("Groups Config Validated");
    return true;
  }

  console.error("Invalid Groups Config - Macro Will Not Continue Startup");

  for (let i = 0; i < errors.length; i++) {
    console.error(errors[i]);
  }

  return false;
}

function normalizeConfigValue(value) {
  if (typeof value == "undefined" || value == null) return "";
  return String(value).trim().toLowerCase();
}

async function selectDefault() {
  groupModes = groups.map(({ default: defaultMode }) =>
    defaultMode === true ? groupModeOn : groupModeOff,
  );
  await saveButtons();
  await applyAllGroups();
}

async function applyAllGroups() {
  await mapEthernetMics();

  for (let i = 0; i < groups.length; i++) {
    await applyGroupMode(i, groupModes[i]);
  }
}

async function applyGroupMode(index, active) {
  const group = groups?.[index];

  if (typeof group == "undefined") {
    console.warn("Group not found at index:", index);
    return false;
  }

  const mode = normalizeGroupMode(active);

  if (mode == groupModeMixed) {
    console.warn("Cannot apply mixed mode to group:", group?.name);
    return false;
  }

  console.log("Apply Group:", group?.name, "Mode:", mode);

  const wasSyncSuspended = syncSuspended;
  syncSuspended = true;

  try {
    await mapEthernetMics();
    await setEthernetMicrophonesMode(group, mode);
    await setMicrophonesMode(group, mode);
    await setUsbMicrophonesMode(group, mode);
  } finally {
    syncSuspended = wasSyncSuspended;
  }

  await syncGroupButton(index);

  return true;
}

async function processPanelClicks({ PanelId }) {
  if (!PanelId.startsWith(panelId)) return;

  const [_panelId, index] = PanelId.split("-");

  console.log("Button Clicked - index:", index);

  if (typeof index == "undefined") return;

  const groupIndex = Number(index);

  if (Number.isNaN(groupIndex)) return;

  groupModes[groupIndex] = getNextGroupMode(groupModes[groupIndex]);

  await applyGroupMode(groupIndex, groupModes[groupIndex]);
  await saveButtons();
}

function createPanel(name, active, order) {
  order = typeof order == "undefined" ? "" : `<Order>${order}</Order>`;
  const iconId = getGroupIconId(active);
  return `<Extensions>
            <Panel>
              <Location>ControlPanel</Location>
              <Icon>Custom</Icon>
              <Name>${name.replace(/&/g, "&amp;")}</Name>
              ${order}
              <ActivityType>Custom</ActivityType>
              <CustomIcon><Id>${iconId}</Id></CustomIcon>
            </Panel>
          </Extensions>`;
}

async function saveButtons() {
  const panels = groups.map(({ name }, i) =>
    createPanel(name, groupModes[i]),
  );
  for (let i = 0; i < panels.length; i++) {
    await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId + "-" + i }, panels[i]);
  }
}

async function toggleButton(index) {
  const requiredPanelId = panelId + "-" + index;
  const result = await xapi.Command.UserInterface.Extensions.List({
    ActivityType: "Custom",
  });
  const currentPanel = result?.Extensions?.Panel?.find(
    ({ PanelId }) => PanelId == requiredPanelId,
  );

  if (typeof currentPanel == "undefined")
    throw Error("Unable to find Panel with Id: " + requiredPanelId);

  const { Name, Order } = currentPanel;
  const currentIcon = currentPanel?.CustomIcon?.Id;
  const newState = currentIcon != "green";
  const panel = createPanel(Name, newState, Order);

  await xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId: requiredPanelId },
    panel,
  );
}

function subscribeToConfigChanges() {
  if (groups.some(({ ethernetMacs }) => Array.isArray(ethernetMacs))) {
    console.log("Listening for ethernet mode changes");
    subscribeToXapiPath("ethernet microphone mode changes", () =>
      xapi.Config.Audio.Input.Ethernet.on(({ Mode, id }) => {
        if (typeof Mode == "undefined") return;
        processEthernetModeChange(id, Mode);
      }),
    );
  }

  if (groups.some(({ microphoneIds }) => Array.isArray(microphoneIds))) {
    console.log("Listening for microphone mode changes");
    subscribeToXapiPath("microphone mode changes", () =>
      xapi.Config.Audio.Input.Microphone.on(({ Mode, id }) => {
        if (typeof Mode == "undefined") return;
        processMicrophoneModeChange(id, Mode);
      }),
    );
  }
}

async function processEthernetModeChange(ethernetId, mode) {
  if (syncSuspended) return;

  await mapEthernetMics();
  await syncChangedGroups(getGroupIndexesForEthernetId(ethernetId));
}

async function processMicrophoneModeChange(microphoneId, mode) {
  if (syncSuspended) return;
  await syncChangedGroups(getGroupIndexesForMicrophoneId(microphoneId));
}

async function syncChangedGroups(groupIndexes) {
  for (let i = 0; i < groupIndexes.length; i++) {
    await syncGroupButton(groupIndexes[i]);
  }
}

async function syncGroupButton(groupIndex) {
  const group = groups?.[groupIndex];

  if (typeof group == "undefined") return;

  const mode = await getGroupMode(group);
  groupModes[groupIndex] = mode;

  await saveButton(groupIndex);
}

async function saveButton(groupIndex) {
  const group = groups?.[groupIndex];

  if (typeof group == "undefined") return;

  const PanelId = panelId + "-" + groupIndex;
  console.log("Saving PanelId:", PanelId);
  await xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId },
    createPanel(group.name, groupModes[groupIndex]),
  );
}

async function getGroupMode(group) {
  const modes = [];
  const ethernetMacs = group?.ethernetMacs ?? [];
  const microphoneIds = group?.microphoneIds ?? [];
  const usbMicrophones = group?.usbMicrophone ?? [];

  await mapEthernetMics();

  if (ethernetStatusAvailable) {
    for (let i = 0; i < ethernetMacs.length; i++) {
      const ethernetMicId = getEthernetMicNumber(ethernetMacs[i]);

      if (typeof ethernetMicId == "undefined") {
        modes.push(groupModeMixed);
        continue;
      }

      const mode = await getXapiValue(
        `ethernet microphone ${ethernetMicId} mode`,
        () => xapi.Config.Audio.Input.Ethernet[ethernetMicId].Mode.get(),
      );

      if (typeof mode != "undefined") modes.push(mode);
    }
  }

  for (let i = 0; i < microphoneIds.length; i++) {
    const microphoneId = microphoneIds[i];
    const mode = await getXapiValue(
      `microphone ${microphoneId} mode`,
      () => xapi.Config.Audio.Input.Microphone[microphoneId].Mode.get(),
    );

    if (typeof mode != "undefined") modes.push(mode);
  }

  for (let i = 0; i < usbMicrophones.length; i++) {
    const usbMicrophone = usbMicrophones[i];
    const mode = await getXapiValue(
      `USB microphone ${usbMicrophone} mode`,
      () => xapi.Config.Audio.Input.USBC[usbMicrophone].Mode.get(),
    );

    if (typeof mode != "undefined") modes.push(mode);
  }

  return getGroupModeFromMicModes(modes);
}

function getGroupModeFromMicModes(modes) {
  if (modes.length == 0) return groupModeMixed;
  if (modes.every((mode) => mode == groupModeOn)) return groupModeOn;
  if (modes.every((mode) => mode == groupModeOff)) return groupModeOff;
  return groupModeMixed;
}

function getGroupIndexesForEthernetId(ethernetId) {
  const normalizedEthernetId = normalizeConfigValue(ethernetId);
  const groupIndexes = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const ethernetMacs = groups[groupIndex]?.ethernetMacs ?? [];
    const hasEthernetMic = ethernetMacs.some(
      (macAddress) =>
        normalizeConfigValue(getEthernetMicNumber(macAddress)) ==
        normalizedEthernetId,
    );

    if (hasEthernetMic) groupIndexes.push(groupIndex);
  }

  return groupIndexes;
}

function getGroupIndexesForMicrophoneId(microphoneId) {
  const normalizedMicrophoneId = normalizeConfigValue(microphoneId);
  const groupIndexes = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const microphoneIds = groups[groupIndex]?.microphoneIds ?? [];
    const hasMicrophone = microphoneIds.some(
      (id) => normalizeConfigValue(id) == normalizedMicrophoneId,
    );

    if (hasMicrophone) groupIndexes.push(groupIndex);
  }

  return groupIndexes;
}

function getNextGroupMode(mode) {
  return mode == groupModeOn ? groupModeOff : groupModeOn;
}

function normalizeGroupMode(mode) {
  if (mode === true) return groupModeOn;
  if (mode === false) return groupModeOff;
  if (mode == groupModeOn || mode == groupModeOff) return mode;
  return groupModeMixed;
}

function getGroupIconId(mode) {
  return groupIconIds[normalizeGroupMode(mode)] ?? groupIconIds[groupModeMixed];
}

async function mapEthernetMics() {
  clearMap(ethernetMicIdByMac);

  const ethernetConnectors = await getXapiValue(
    "ethernet microphone status",
    () => xapi.Status.Audio.Input.Connectors.Ethernet.get(),
  );

  if (typeof ethernetConnectors == "undefined") {
    ethernetStatusAvailable = false;
    return false;
  }

  ethernetStatusAvailable = true;
  const connectors = normalizeIndexedStatus(ethernetConnectors);

  for (let i = 0; i < connectors.length; i++) {
    const connector = connectors[i];
    const connectorId = getConnectorId(connector);
    const streamName = normalizeConfigValue(connector?.StreamName);

    if (!connectorId || !streamName) continue;

    // Cisco Ethernet microphones use their MAC address as the stream name.
    ethernetMicIdByMac[streamName] = connectorId;
  }

  console.log("Ethernet Mic Map:", JSON.stringify(ethernetMicIdByMac));
  return true;
}

function getEthernetMicNumber(macAddress) {
  return ethernetMicIdByMac[normalizeConfigValue(macAddress)];
}

async function setEthernetMicrophonesMode(group, mode) {
  const ethernetMacs = group?.ethernetMacs ?? [];

  for (let i = 0; i < ethernetMacs.length; i++) {
    const macAddress = ethernetMacs[i];
    const ethernetMicId = getEthernetMicNumber(macAddress);

    if (typeof ethernetMicId == "undefined") {
      console.warn(
        `Ethernet microphone "${macAddress}" not found for group "${group.name}".`,
      );
      continue;
    }

    console.log(
      "Setting Ethernet Mic:",
      macAddress,
      "Connector:",
      ethernetMicId,
      "Mode:",
      mode,
    );

    await setXapiValue(
      `ethernet microphone ${macAddress} connector ${ethernetMicId} mode`,
      () => xapi.Config.Audio.Input.Ethernet[ethernetMicId].Mode.set(mode),
    );
  }
}

async function setMicrophonesMode(group, mode) {
  const microphoneIds = group?.microphoneIds ?? [];

  for (let i = 0; i < microphoneIds.length; i++) {
    const microphoneId = microphoneIds[i];

    console.log("Setting Microphone:", microphoneId, "Mode:", mode);

    await setXapiValue(`microphone ${microphoneId} mode`, () =>
      xapi.Config.Audio.Input.Microphone[microphoneId].Mode.set(mode),
    );
  }
}

async function setUsbMicrophonesMode(group, mode) {
  const usbMicrophones = group?.usbMicrophone ?? [];

  for (let i = 0; i < usbMicrophones.length; i++) {
    const usbMicrophone = usbMicrophones[i];

    console.log("Setting USB Microphone:", usbMicrophone, "Mode:", mode);

    await setXapiValue(`USB microphone ${usbMicrophone} mode`, () =>
      xapi.Config.Audio.Input.USBC[usbMicrophone].Mode.set(mode),
    );
  }
}

async function getXapiValue(description, getter) {
  try {
    return await getter();
  } catch (error) {
    console.warn(`Skipping ${description}: ${getXapiErrorMessage(error)}`);
    return undefined;
  }
}

async function setXapiValue(description, setter) {
  try {
    await setter();
    return true;
  } catch (error) {
    console.warn(`Skipping ${description}: ${getXapiErrorMessage(error)}`);
    return false;
  }
}

function subscribeToXapiPath(description, subscribe) {
  try {
    const subscription = subscribe();

    if (isPromiseLike(subscription)) {
      subscription.catch((error) => {
        console.warn(
          `Skipping ${description}: ${getXapiErrorMessage(error)}`,
        );
      });
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Skipping ${description}: ${getXapiErrorMessage(error)}`);
    return false;
  }
}

function isPromiseLike(value) {
  return value != null && typeof value.then == "function";
}

function getXapiErrorMessage(error) {
  return error?.message ?? String(error);
}

function normalizeIndexedStatus(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item, i) => normalizeIndexedItem(item, i + 1));
  }

  if (typeof value != "object") return [];

  if (typeof value.StreamName != "undefined") return [value];

  return Object.keys(value).map((key) => normalizeIndexedItem(value[key], key));
}

function normalizeIndexedItem(item, fallbackId) {
  if (typeof item == "object" && item != null) {
    return {
      ...item,
      id: item.id ?? item.Id ?? item.ConnectorId ?? fallbackId,
    };
  }

  return { id: fallbackId, Value: item };
}

function getConnectorId(connector) {
  return connector?.id ?? connector?.Id ?? connector?.ConnectorId;
}

function clearMap(map) {
  const keys = Object.keys(map);

  for (let i = 0; i < keys.length; i++) {
    delete map[keys[i]];
  }
}

async function deleteButtons() {
  const result = await xapi.Command.UserInterface.Extensions.List({
    ActivityType: "Custom",
  });
  const panelIds = result?.Extensions?.Panel?.filter(({ PanelId }) =>
    PanelId.startsWith(panelId),
  ).map(({ PanelId }) => PanelId);

  if (!panelIds) return;

  for (let i = 0; i < panelIds.length; i++) {
    const PanelId = panelIds[i];
    console.log("Deleting PanelId:", PanelId);
    await xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId });
  }
}

async function saveIcons() {
  const icons = {
    red: "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",
    green:
      "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",
    orange: "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"
  };

  const iconNames = Object.keys(icons);
  const iconList = await xapi.Command.UserInterface.Extensions.Icon.List();
  const oldIcons =
    iconList?.Icon?.filter(({ Id }) => iconNames.includes(Id)).map(
      ({ Id }) => Id,
    ) ?? [];

  for (let i = 0; i < oldIcons.length; i++) {
    const Id = oldIcons[i];
    console.log("Deleting Old Icon Id:", Id);
    await xapi.Command.UserInterface.Extensions.Icon.Delete({ Id });
  }

  for (let i = 0; i < iconNames.length; i++) {
    const Id = iconNames[i];
    console.log("Saving Icon Id:", Id);
    await xapi.Command.UserInterface.Extensions.Icon.Upload({ Id }, icons[Id]);
  }
}
