const MAX_GROUPS = 4;
const MIN_MICROPHONE_ID = 1;
const MAX_MICROPHONE_ID = 8;
const USB_MICROPHONE_ID = 1;
const CONFIG_PATTERN =
  /const groups = \[[\s\S]*?\];\n\nconst applyDefaultAfterCall = [\s\S]*?;\nconst allowUserCancelDefaults = [\s\S]*?;\nconst applyDefaultDelayMinutes = [\s\S]*?;\nconst showAlertWhenApplyDefaults = [\s\S]*?;/;

const steps = [
  { id: "groups", name: "Groups", title: "Configure Groups" },
  { id: "behavior", name: "Behavior", title: "Reset Behavior" },
  { id: "export", name: "Export", title: "Export Macro" },
];

let nextGroupId = 1;
const initialGroup = createGroup({ defaultMode: true });

const state = {
  activeStep: "groups",
  drafts: {
    [initialGroup.id]: createDraft(),
  },
  groups: [initialGroup],
  macroTemplate: "",
  settings: {
    applyDefaultAfterCall: true,
    allowUserCancelDefaults: true,
    applyDefaultDelayMinutes: 5,
    showAlertWhenApplyDefaults: true,
  },
  templateError: "",
  templateLoaded: false,
};

const elements = {
  addGroupButton: document.querySelector("#addGroupButton"),
  buttonPreview: document.querySelector("#buttonPreview"),
  content: document.querySelector("#content"),
  goExportButton: document.querySelector("#goExportButton"),
  stepEyebrow: document.querySelector("#stepEyebrow"),
  stepNav: document.querySelector("#stepNav"),
  stepTitle: document.querySelector("#stepTitle"),
  summary: document.querySelector("#summary"),
};

loadMacroTemplate();
render();

elements.stepNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-step]");
  if (!button) return;
  state.activeStep = button.dataset.step;
  render();
});

elements.addGroupButton.addEventListener("click", () => {
  addGroup();
});

elements.goExportButton.addEventListener("click", () => {
  state.activeStep = "export";
  render();
});

elements.content.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const action = button.dataset.action;
  if (!action) return;

  const groupId = button.dataset.groupId;
  const group = groupId ? getGroup(groupId) : null;

  if (action === "add-mac" && group) addMac(group);
  if (action === "add-mic" && group) addMicrophone(group);
  if (action === "add-usb" && group) addUsbMicrophone(group);
  if (action === "remove-group" && group) removeGroup(group);
  if (action === "remove-value" && group) removeValue(group, button);
  if (action === "set-default" && group) setDefaultMode(group, button);
  if (action === "copy-macro") copyMacro();
  if (action === "download-macro") downloadMacro();
  if (action === "copy-config") copyConfig();
});

elements.content.addEventListener("input", (event) => {
  const input = event.target;
  const groupId = input.dataset.groupId;

  if (input.dataset.field === "group-name") {
    const group = getGroup(groupId);
    if (!group) return;
    group.name = input.value;
    refreshValidation();
    return;
  }

  if (input.dataset.draftField) {
    updateDraft(groupId, input.dataset.draftField, input.value);
    return;
  }

  if (input.dataset.setting) {
    updateSetting(input);
  }
});

elements.content.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset.setting) updateSetting(input);
});

function createGroup({ defaultMode = false, name } = {}) {
  const id = `group-${nextGroupId++}`;
  return {
    default: defaultMode,
    ethernetMacs: [],
    id,
    microphoneIds: [],
    name: name ?? `Group ${nextGroupId - 1}`,
    usbMicrophone: [],
  };
}

function createDraft() {
  return {
    mac: "",
    mic: "",
    usb: "",
  };
}

function addGroup() {
  if (state.groups.length >= MAX_GROUPS) return;
  const nextIndex = state.groups.length + 1;
  const group = createGroup({
    defaultMode: nextIndex === 1,
    name: getNextGroupName(),
  });
  state.drafts[group.id] = createDraft();
  state.groups.push(group);
  render();
}

function removeGroup(group) {
  if (state.groups.length <= 1) return;
  state.groups = state.groups.filter((item) => item.id !== group.id);
  delete state.drafts[group.id];
  render();
}

function getNextGroupName() {
  const names = new Set(state.groups.map((group) => group.name.trim().toLowerCase()));
  for (let index = 1; index <= MAX_GROUPS; index += 1) {
    const name = `Group ${index}`;
    if (!names.has(name.toLowerCase())) return name;
  }
  return `Group ${state.groups.length + 1}`;
}

function getGroup(groupId) {
  return state.groups.find((group) => group.id === groupId);
}

function updateDraft(groupId, field, value) {
  state.drafts[groupId] ??= createDraft();
  state.drafts[groupId][field] = value;
  refreshDraftValidation(groupId, field);
}

function addMac(group) {
  const draft = state.drafts[group.id] ?? createDraft();
  const result = validateMacDraft(group, draft.mac);
  if (!result.valid) {
    refreshDraftValidation(group.id, "mac", true);
    return;
  }

  group.ethernetMacs.push(result.value);
  draft.mac = "";
  state.drafts[group.id] = draft;
  render();
}

function addMicrophone(group) {
  const draft = state.drafts[group.id] ?? createDraft();
  const result = validateMicrophoneDraft(group, draft.mic);
  if (!result.valid) {
    refreshDraftValidation(group.id, "mic", true);
    return;
  }

  group.microphoneIds.push(result.value);
  draft.mic = "";
  state.drafts[group.id] = draft;
  render();
}

function addUsbMicrophone(group) {
  const draft = state.drafts[group.id] ?? createDraft();
  const result = validateUsbDraft(group, draft.usb);
  if (!result.valid) {
    refreshDraftValidation(group.id, "usb", true);
    return;
  }

  group.usbMicrophone.push(result.value);
  draft.usb = "";
  state.drafts[group.id] = draft;
  render();
}

function removeValue(group, button) {
  const type = button.dataset.valueType;
  const value = button.dataset.value;

  if (type === "mac") {
    group.ethernetMacs = group.ethernetMacs.filter((item) => item !== value);
  }

  if (type === "mic") {
    group.microphoneIds = group.microphoneIds.filter((item) => String(item) !== value);
  }

  if (type === "usb") {
    group.usbMicrophone = group.usbMicrophone.filter((item) => String(item) !== value);
  }

  render();
}

function setDefaultMode(group, button) {
  group.default = button.dataset.value === "true";
  render();
}

function updateSetting(input) {
  const setting = input.dataset.setting;
  if (input.type === "checkbox") {
    state.settings[setting] = input.checked;
    if (setting === "applyDefaultAfterCall") {
      render();
      return;
    }
  } else {
    state.settings[setting] = input.value;
  }
  refreshValidation();
}

function render() {
  const activeStep = steps.find((step) => step.id === state.activeStep) ?? steps[0];
  const validation = validateConfig();

  elements.stepEyebrow.textContent = activeStep.name;
  elements.stepTitle.textContent = activeStep.title;
  elements.addGroupButton.hidden = state.activeStep !== "groups";
  elements.addGroupButton.disabled = state.groups.length >= MAX_GROUPS;
  elements.goExportButton.disabled = !validation.valid;

  renderButtonPreview();
  renderStepNav(validation);
  renderSummary(validation);

  if (state.activeStep === "groups") renderGroups(validation);
  if (state.activeStep === "behavior") renderBehavior(validation);
  if (state.activeStep === "export") renderExport(validation);
}

function renderStepNav(validation) {
  elements.stepNav.innerHTML = steps
    .map((step) => {
      const isActive = step.id === state.activeStep;
      const invalid = getStepInvalid(step.id, validation);
      const stateText = invalid ? "Needs input" : "OK";
      return `
        <button class="step-button ${isActive ? "active" : ""} ${
          invalid ? "invalid" : ""
        }" type="button" data-step="${step.id}">
          <span class="step-name">${escapeHtml(step.name)}</span>
          <span class="step-state">${stateText}</span>
        </button>
      `;
    })
    .join("");
}

function renderButtonPreview() {
  elements.buttonPreview.innerHTML = state.groups
    .map((group, index) => {
      const label = group.name.trim() || `Group ${index + 1}`;
      const mode = group.default ? "on" : "off";
      const iconLabel = group.default ? "default on" : "default off";

      return `
        <div class="control-button ${mode}" aria-label="${escapeAttribute(
          `${label} ${iconLabel}`,
        )}">
          <span class="control-icon ${mode}" aria-hidden="true">
            <span class="mic-shape"></span>
          </span>
          <span class="control-label">${escapeHtml(label)}</span>
        </div>
      `;
    })
    .join("");
}

function renderSummary(validation) {
  const inputCount = state.groups.reduce(
    (total, group) =>
      total +
      group.ethernetMacs.length +
      group.microphoneIds.length +
      group.usbMicrophone.length,
    0,
  );
  const defaultOnCount = state.groups.filter((group) => group.default).length;
  const statusClass = validation.valid ? "valid" : "invalid";
  const statusText = validation.valid ? "Ready" : `${validation.errors.length} issue`;
  const issueLabel = validation.errors.length === 1 ? "blocking issue" : "blocking issues";

  elements.summary.innerHTML = `
    <div class="metric">
      <span class="metric-value">${state.groups.length}/${MAX_GROUPS}</span>
      <span class="metric-label">Groups</span>
    </div>
    <div class="metric">
      <span class="metric-value">${inputCount}</span>
      <span class="metric-label">Audio inputs</span>
    </div>
    <div class="metric">
      <span class="metric-value">${defaultOnCount}</span>
      <span class="metric-label">Default on</span>
    </div>
    <div class="metric ${statusClass}">
      <span class="metric-value">${escapeHtml(statusText)}</span>
      <span class="metric-label">${validation.valid ? "Export status" : issueLabel}</span>
    </div>
  `;
}

function renderGroups(validation) {
  elements.content.innerHTML = `
    <div class="groups-grid">
      ${state.groups.map((group, index) => renderGroup(group, index, validation)).join("")}
    </div>
  `;
  refreshValidation();
}

function renderGroup(group, index, validation) {
  const draft = state.drafts[group.id] ?? createDraft();
  const issues = validation.groupErrors.get(group.id) ?? [];
  return `
    <article class="group-card ${issues.length ? "invalid" : ""}" data-card-group-id="${
      group.id
    }">
      <div class="group-header">
        <div class="group-title">
          <span class="group-number">${index + 1}</span>
          <input
            class="group-name"
            type="text"
            value="${escapeAttribute(group.name)}"
            data-field="group-name"
            data-group-id="${group.id}"
            aria-label="Group name"
            maxlength="34"
          />
        </div>
        <div class="group-tools">
          <div class="default-control">
            <div class="default-copy">
              <span class="default-label">Reset default</span>
              <span class="default-note">${
                state.settings.applyDefaultAfterCall
                  ? "Auto-applied after calls"
                  : "Startup default only"
              }</span>
            </div>
            <div
              class="segmented"
              role="group"
              aria-label="Reset default mode for ${escapeAttribute(group.name)}"
            >
              <button
                class="segment-button ${group.default ? "active" : ""}"
                type="button"
                data-action="set-default"
                data-value="true"
                data-group-id="${group.id}"
              >On</button>
              <button
                class="segment-button ${!group.default ? "active" : ""}"
                type="button"
                data-action="set-default"
                data-value="false"
                data-group-id="${group.id}"
              >Off</button>
            </div>
          </div>
          <button
            class="button danger"
            type="button"
            data-action="remove-group"
            data-group-id="${group.id}"
            ${state.groups.length <= 1 ? "disabled" : ""}
          >Remove</button>
        </div>
      </div>
      <div class="group-body">
        <div class="field-grid">
          ${renderValueEditor({
            action: "add-mac",
            draftField: "mac",
            group,
            label: "Ethernet MAC addresses",
            placeholder: "00:11:22:33:44:55",
            type: "mac",
            value: draft.mac,
            values: group.ethernetMacs,
          })}
          ${renderValueEditor({
            action: "add-mic",
            draftField: "mic",
            group,
            inputMode: "numeric",
            label: "Microphone IDs",
            placeholder: "1-8",
            type: "mic",
            value: draft.mic,
            values: group.microphoneIds,
          })}
          ${renderValueEditor({
            action: "add-usb",
            draftField: "usb",
            group,
            inputMode: "numeric",
            label: "USB microphone ID",
            placeholder: "1",
            type: "usb",
            value: draft.usb,
            values: group.usbMicrophone,
          })}
        </div>
        <div class="group-issues ${issues.length ? "error" : ""}" data-group-issues="${
          group.id
        }">${issues.map(escapeHtml).join(" ")}</div>
      </div>
    </article>
  `;
}

function renderValueEditor({
  action,
  draftField,
  group,
  inputMode = "text",
  label,
  placeholder,
  type,
  value,
  values,
}) {
  return `
    <div class="field-block">
      <label for="${group.id}-${draftField}">${escapeHtml(label)}</label>
      <div class="input-row">
        <input
          id="${group.id}-${draftField}"
          type="text"
          inputmode="${inputMode}"
          value="${escapeAttribute(value)}"
          placeholder="${escapeAttribute(placeholder)}"
          data-draft-field="${draftField}"
          data-group-id="${group.id}"
          autocomplete="off"
        />
        <button
          class="icon-button"
          type="button"
          data-action="${action}"
          data-group-id="${group.id}"
          aria-label="Add ${escapeAttribute(label)}"
        >+</button>
      </div>
      <div class="field-message" data-draft-message="${group.id}:${draftField}"></div>
      <div class="chip-row">
        ${renderChips(group, type, values)}
      </div>
    </div>
  `;
}

function renderChips(group, type, values) {
  if (values.length === 0) return `<span class="empty-chip">None added</span>`;
  return values
    .map(
      (value) => `
        <span class="chip">
          <span>${escapeHtml(String(value))}</span>
          <button
            type="button"
            data-action="remove-value"
            data-group-id="${group.id}"
            data-value-type="${type}"
            data-value="${escapeAttribute(String(value))}"
            aria-label="Remove ${escapeAttribute(String(value))}"
          >x</button>
        </span>
      `,
    )
    .join("");
}

function renderBehavior(validation) {
  const settings = state.settings;
  const delayError = validation.settingErrors.applyDefaultDelayMinutes;
  elements.content.innerHTML = `
    <div class="settings-panel">
      <div class="settings-grid">
        <div class="setting-row">
          <label class="switch-row">
            <span>Reset to defaults after calls</span>
            <input
              type="checkbox"
              data-setting="applyDefaultAfterCall"
              ${settings.applyDefaultAfterCall ? "checked" : ""}
            />
          </label>
          <label class="switch-row">
            <span>Allow user cancellation</span>
            <input
              type="checkbox"
              data-setting="allowUserCancelDefaults"
              ${settings.allowUserCancelDefaults ? "checked" : ""}
              ${settings.applyDefaultAfterCall ? "" : "disabled"}
            />
          </label>
          <label class="switch-row">
            <span>Show reset alert</span>
            <input
              type="checkbox"
              data-setting="showAlertWhenApplyDefaults"
              ${settings.showAlertWhenApplyDefaults ? "checked" : ""}
              ${settings.applyDefaultAfterCall ? "" : "disabled"}
            />
          </label>
        </div>
        <div class="setting-row delay-row">
          <label for="applyDefaultDelayMinutes">Reset delay minutes</label>
          <input
            id="applyDefaultDelayMinutes"
            class="${delayError ? "invalid" : ""}"
            type="number"
            min="1"
            max="60"
            step="1"
            data-setting="applyDefaultDelayMinutes"
            value="${escapeAttribute(String(settings.applyDefaultDelayMinutes))}"
            ${settings.applyDefaultAfterCall ? "" : "disabled"}
          />
          <div class="field-message ${delayError ? "error" : ""}">${
            delayError ? escapeHtml(delayError) : ""
          }</div>
        </div>
      </div>
    </div>
  `;
}

function renderExport(validation) {
  const macro = validation.valid && state.templateLoaded ? buildMacro() : "";
  const config = validation.valid ? buildConfigBlock() : "";
  const canExportMacro = validation.valid && state.templateLoaded;
  const issueMarkup = validation.valid
    ? ""
    : `<ul class="issue-list">${validation.errors
        .map((error) => `<li>${escapeHtml(error)}</li>`)
        .join("")}</ul>`;

  elements.content.innerHTML = `
    <div class="export-grid">
      <div class="export-panel">
        <div class="template-status ${state.templateError ? "error" : ""}">
          ${getTemplateStatusText()}
        </div>
        <div class="export-message ${validation.valid ? "" : "error"}">
          ${validation.valid ? "Configuration valid." : issueMarkup}
        </div>
        <div class="export-actions">
          <button
            class="button primary"
            type="button"
            data-action="download-macro"
            ${canExportMacro ? "" : "disabled"}
          >Download Macro</button>
          <button
            class="button secondary"
            type="button"
            data-action="copy-macro"
            ${canExportMacro ? "" : "disabled"}
          >Copy Macro</button>
          <button
            class="button secondary"
            type="button"
            data-action="copy-config"
            ${validation.valid ? "" : "disabled"}
          >Copy Config</button>
        </div>
      </div>
      <textarea class="code-preview" readonly spellcheck="false">${
        canExportMacro
          ? escapeHtml(macro)
          : escapeHtml(config || "Resolve validation issues to generate the macro.")
      }</textarea>
    </div>
  `;
}

function refreshValidation() {
  const validation = validateConfig();
  renderButtonPreview();
  renderSummary(validation);
  renderStepNav(validation);
  elements.goExportButton.disabled = !validation.valid;

  for (const group of state.groups) {
    const issues = validation.groupErrors.get(group.id) ?? [];
    const card = document.querySelector(`[data-card-group-id="${group.id}"]`);
    const issueNode = document.querySelector(`[data-group-issues="${group.id}"]`);
    card?.classList.toggle("invalid", issues.length > 0);
    if (issueNode) {
      issueNode.textContent = issues.join(" ");
      issueNode.classList.toggle("error", issues.length > 0);
    }
  }

  for (const group of state.groups) {
    refreshDraftValidation(group.id, "mac");
    refreshDraftValidation(group.id, "mic");
    refreshDraftValidation(group.id, "usb");
  }
}

function refreshDraftValidation(groupId, field, forceMessage = false) {
  const group = getGroup(groupId);
  if (!group) return;

  const input = document.querySelector(
    `[data-group-id="${groupId}"][data-draft-field="${field}"]`,
  );
  const message = document.querySelector(`[data-draft-message="${groupId}:${field}"]`);
  const addButton = document.querySelector(
    `[data-group-id="${groupId}"][data-action="${getAddAction(field)}"]`,
  );

  if (!input || !message || !addButton) return;

  const value = state.drafts[groupId]?.[field] ?? "";
  const result = getDraftValidation(group, field, value);
  const showMessage = forceMessage || value.trim() !== "";

  input.classList.toggle("invalid", showMessage && !result.valid);
  message.textContent = showMessage && !result.valid ? result.message : "";
  message.classList.toggle("error", showMessage && !result.valid);
  addButton.disabled = !result.valid;
}

function getAddAction(field) {
  if (field === "mac") return "add-mac";
  if (field === "mic") return "add-mic";
  return "add-usb";
}

function getDraftValidation(group, field, value) {
  if (field === "mac") return validateMacDraft(group, value);
  if (field === "mic") return validateMicrophoneDraft(group, value);
  return validateUsbDraft(group, value);
}

function validateConfig() {
  const errors = [];
  const groupErrors = new Map(state.groups.map((group) => [group.id, []]));
  const settingErrors = {};

  if (state.groups.length === 0) {
    errors.push("At least one group is required.");
  }

  if (state.groups.length > MAX_GROUPS) {
    errors.push(`No more than ${MAX_GROUPS} groups can be configured.`);
  }

  const seenNames = new Map();
  const seenMacs = new Map();
  const seenMics = new Map();
  const seenUsb = new Map();

  for (const group of state.groups) {
    const name = group.name.trim();
    const groupIssues = groupErrors.get(group.id);

    if (!name) {
      addGroupError(errors, groupIssues, "Group name is required.");
    } else {
      const nameKey = name.toLowerCase();
      if (seenNames.has(nameKey)) {
        addGroupError(errors, groupIssues, `Group name "${name}" is already used.`);
      } else {
        seenNames.set(nameKey, group);
      }
    }

    if (
      group.ethernetMacs.length === 0 &&
      group.microphoneIds.length === 0 &&
      group.usbMicrophone.length === 0
    ) {
      addGroupError(errors, groupIssues, `${name || "Group"} needs at least one input.`);
    }

    for (const mac of group.ethernetMacs) {
      if (!normalizeMac(mac)) {
        addGroupError(errors, groupIssues, `${mac} is not a valid MAC address.`);
        continue;
      }
      flagDuplicate(errors, groupIssues, seenMacs, mac, group, "Ethernet MAC");
    }

    for (const micId of group.microphoneIds) {
      if (!isValidMicrophoneId(micId)) {
        addGroupError(
          errors,
          groupIssues,
          `Microphone ID ${micId} must be ${MIN_MICROPHONE_ID}-${MAX_MICROPHONE_ID}.`,
        );
        continue;
      }
      flagDuplicate(errors, groupIssues, seenMics, micId, group, "Microphone ID");
    }

    for (const usbId of group.usbMicrophone) {
      if (usbId !== USB_MICROPHONE_ID) {
        addGroupError(errors, groupIssues, `USB microphone ID ${usbId} must be 1.`);
        continue;
      }
      flagDuplicate(errors, groupIssues, seenUsb, usbId, group, "USB microphone ID");
    }
  }

  const delay = Number(state.settings.applyDefaultDelayMinutes);
  if (
    state.settings.applyDefaultAfterCall &&
    (!Number.isInteger(delay) || delay < 1 || delay > 60)
  ) {
    settingErrors.applyDefaultDelayMinutes = "Delay must be a whole number from 1 to 60.";
    errors.push(settingErrors.applyDefaultDelayMinutes);
  }

  return {
    errors,
    groupErrors,
    settingErrors,
    valid: errors.length === 0,
  };
}

function addGroupError(errors, groupIssues, message) {
  errors.push(message);
  groupIssues.push(message);
}

function flagDuplicate(errors, groupIssues, seen, value, group, label) {
  const key = String(value).toLowerCase();
  if (!seen.has(key)) {
    seen.set(key, group);
    return;
  }

  const owner = seen.get(key);
  const message = `${label} ${value} is already used by ${owner.name.trim() || "another group"}.`;
  addGroupError(errors, groupIssues, message);
}

function validateMacDraft(group, rawValue) {
  const raw = rawValue.trim();
  if (!raw) return invalid("Enter a MAC address.");

  const mac = normalizeMac(raw);
  if (!mac) return invalid("Use 12 hex characters, with or without separators.");

  const owner = findOwner((item) => item.ethernetMacs.includes(mac));
  if (owner) {
    return invalid(
      owner.id === group.id
        ? "This MAC address is already in this group."
        : `This MAC address is already used by ${owner.name.trim() || "another group"}.`,
    );
  }

  return valid(mac);
}

function validateMicrophoneDraft(group, rawValue) {
  const raw = rawValue.trim();
  if (!raw) return invalid("Enter a microphone ID.");

  const id = Number(raw);
  if (!isValidMicrophoneId(id)) {
    return invalid(`Use a whole number from ${MIN_MICROPHONE_ID} to ${MAX_MICROPHONE_ID}.`);
  }

  const owner = findOwner((item) => item.microphoneIds.includes(id));
  if (owner) {
    return invalid(
      owner.id === group.id
        ? "This microphone ID is already in this group."
        : `This microphone ID is already used by ${owner.name.trim() || "another group"}.`,
    );
  }

  return valid(id);
}

function validateUsbDraft(group, rawValue) {
  const raw = rawValue.trim();
  if (!raw) return invalid("Enter USB microphone ID 1.");

  const id = Number(raw);
  if (id !== USB_MICROPHONE_ID) return invalid("Only USB microphone ID 1 is supported.");

  const owner = findOwner((item) => item.usbMicrophone.includes(id));
  if (owner) {
    return invalid(
      owner.id === group.id
        ? "USB microphone ID 1 is already in this group."
        : `USB microphone ID 1 is already used by ${owner.name.trim() || "another group"}.`,
    );
  }

  return valid(id);
}

function valid(value) {
  return { valid: true, value };
}

function invalid(message) {
  return { message, valid: false };
}

function normalizeMac(rawValue) {
  const compact = rawValue.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact)) return "";
  return compact.match(/.{2}/g).join(":");
}

function isValidMicrophoneId(value) {
  return (
    Number.isInteger(Number(value)) &&
    Number(value) >= MIN_MICROPHONE_ID &&
    Number(value) <= MAX_MICROPHONE_ID
  );
}

function findOwner(predicate) {
  return state.groups.find(predicate);
}

function getStepInvalid(stepId, validation) {
  if (stepId === "groups") {
    return [...validation.groupErrors.values()].some((issues) => issues.length > 0);
  }

  if (stepId === "behavior") {
    return Object.keys(validation.settingErrors).length > 0;
  }

  return !validation.valid || !state.templateLoaded;
}

function buildConfigBlock() {
  const settings = state.settings;
  const delay = Number(settings.applyDefaultDelayMinutes);
  return `const groups = [
${state.groups.map(buildGroupConfig).join(",\n")}
];

const applyDefaultAfterCall = ${Boolean(settings.applyDefaultAfterCall)};
const allowUserCancelDefaults = ${Boolean(settings.allowUserCancelDefaults)};
const applyDefaultDelayMinutes = ${Number.isInteger(delay) ? delay : 5};
const showAlertWhenApplyDefaults = ${Boolean(settings.showAlertWhenApplyDefaults)};`;
}

function buildGroupConfig(group) {
  const lines = [
    "  {",
    `    name: ${JSON.stringify(group.name.trim())},`,
  ];

  if (group.ethernetMacs.length > 0) {
    lines.push(`    ethernetMacs: ${formatArray(group.ethernetMacs)},`);
  }

  if (group.microphoneIds.length > 0) {
    lines.push(`    microphoneIds: ${formatArray(group.microphoneIds)},`);
  }

  if (group.usbMicrophone.length > 0) {
    lines.push(`    usbMicrophone: ${formatArray(group.usbMicrophone)},`);
  }

  lines.push(`    default: ${Boolean(group.default)},`);
  lines.push("  }");
  return lines.join("\n");
}

function formatArray(values) {
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}

function buildMacro() {
  const config = buildConfigBlock();
  if (!state.macroTemplate) return config;
  if (CONFIG_PATTERN.test(state.macroTemplate)) {
    return state.macroTemplate.replace(CONFIG_PATTERN, config);
  }
  return `${config}\n\n${state.macroTemplate}`;
}

async function loadMacroTemplate() {
  const candidates = [
    new URL("../audio-toggle.js", window.location.href),
    new URL("./audio-toggle.js", window.location.href),
  ];

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      state.macroTemplate = await response.text();
      state.templateLoaded = true;
      state.templateError = "";
      render();
      return;
    } catch {
      // Try the next hosting layout.
    }
  }

  state.templateError = "Macro template unavailable.";
  state.templateLoaded = false;
  render();
}

function getTemplateStatusText() {
  if (state.templateLoaded) return "Macro template loaded.";
  if (state.templateError) return state.templateError;
  return "Loading macro template.";
}

async function copyMacro() {
  await copyText(buildMacro(), "Macro copied.");
}

async function copyConfig() {
  await copyText(buildConfigBlock(), "Config copied.");
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showExportMessage(successMessage, false);
  } catch {
    showExportMessage("Clipboard access was blocked.", true);
  }
}

function downloadMacro() {
  const blob = new Blob([buildMacro()], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "audio-toggle.js";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showExportMessage("Macro download created.", false);
}

function showExportMessage(message, isError) {
  const node = document.querySelector(".export-message");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
