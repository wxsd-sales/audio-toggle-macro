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

import xapi from 'xapi';


/*********************************************************
 * Configure the settings below
**********************************************************/

const modes = [               // Array of Audio Modes
  {
    name: 'Mode 1',           // Give the node a unique name
    config: () => {
      // Specify all xConfigs changes for the given mode
      // Keep in mind that audio inputs and xConfig option vary between devices
      xapi.Config.Audio.Input.Microphone[1].Mode.set('Off');
      xapi.Config.Audio.Input.USBC[1].Mode.set('Off');

      // Example where Mode 1 Sets Ethernet 1 - 4 On
      // xapi.Config.Audio.Input.Ethernet[1].Mode.set('On');
      // xapi.Config.Audio.Input.Ethernet[2].Mode.set('On');
      // xapi.Config.Audio.Input.Ethernet[3].Mode.set('On');
      // xapi.Config.Audio.Input.Ethernet[4].Mode.set('On');
    }
  },
  {
    name: 'Mode 2',
    config: () => {
      xapi.Config.Audio.Input.Microphone[1].Mode.set('On');
      xapi.Config.Audio.Input.USBC[1].Mode.set('On');


      // Example where Mode 2 Sets Ethernet 1 - 4 Off
      // xapi.Config.Audio.Input.Ethernet[1].Mode.set('Off');
      // xapi.Config.Audio.Input.Ethernet[2].Mode.set('Off');
      // xapi.Config.Audio.Input.Ethernet[3].Mode.set('Off');
      // xapi.Config.Audio.Input.Ethernet[4].Mode.set('Off');
    }
  },
  {
    name: 'Mode 3',
    config: () => {
      xapi.Config.Audio.Input.Microphone[1].Mode.set('Off');
      xapi.Config.Audio.Input.USBC[1].Mode.set('Off');
    }
  },
  {
    name: 'Mode 4',
    config: () => {
      xapi.Config.Audio.Input.Microphone[1].Mode.set('Off');
      xapi.Config.Audio.Input.USBC[1].Mode.set('Off');
    }
  }
]

const defaultMode = 'Mode 1';       // Name of the mode which is applied when the macro starts

const newCallApplyDefault = true;   // Set to true if you want default mode always applied upon joining a new call



/*********************************************************
 * Do not change below
**********************************************************/

const panelId = 'audioToggle';
let selectedModeIndex;
let callId;

init();

async function init() {

  await saveIcons();

  await deleteButtons();

  if (typeof modes == 'undefined') {
    console.log('Modes Not Defined - Macro Will Not Continue Startup');
    return
  }

  if (Array.isArray(modes) && modes.length == 0) {
    console.log('No Modes Configured - Macro Will Not Continue Startup');
    return
  }

  selectDefault();

  xapi.Event.UserInterface.Extensions.Panel.Clicked.on(processPanelClicks);

  if (!newCallApplyDefault) return

  xapi.Status.Call.on(({ Status, id }) => {
    if (Status && Status == 'Connected' && callId != id) {
      callId = id;
      return selectDefault()
    }
  });

  xapi.Status.MicrosoftTeams.Calling.InCall.on((inMTRCall) => {
    if (inMTRCall == 'True') return selectDefault()
  });

}

async function selectDefault() {
  selectedModeIndex = modes.findIndex(({ name }) => name == defaultMode);

  if (selectedModeIndex == -1) {
    selectedModeIndex = 0;
    const firstModeName = modes?.[0]?.name;
    console.warn(`Default Mode "${defaultMode}"" not found - Defaulting to first mode: ${firstModeName}`);
  }

  await saveButtons();
}



function applyMode() {
  console.log('Applying Mode at Index:', selectedModeIndex);

  const mode = modes?.[selectedModeIndex];

  if (typeof mode == 'undefined') {
    console.warn(`Mode not found at index:`, selectedModeIndex);
    return
  }

  console.log('Apply Mode:', mode?.name);

  try {
    mode?.config();
  } catch (e) {
    console.error('Error Applying Audio Mode:', mode?.name, 'Reason:', e.message)
  }
}


async function processPanelClicks({ PanelId }) {
  if (!PanelId.startsWith(panelId)) return

  const [_panelId, index] = PanelId.split('-');

  console.log('Button Clicked - index:', index)

  if (typeof index == 'undefined') return
  if (selectedModeIndex == index) return

  try {
    await toggleButton(index);
    await toggleButton(selectedModeIndex);
  } catch (e) {
    selectedModeIndex = index;
    await saveButtons();
  }

  selectedModeIndex = index;
  applyMode();
}

function createPanel(name, active, order) {
  order = typeof order == 'undefined' ? '' : `<Order>${order}</Order>`
  return `<Extensions>
            <Panel>
              <Location>ControlPanel</Location>
              <Icon>Custom</Icon>
              <Name>${name.replace(/&/g, "&amp;")}</Name>
              ${order}
              <ActivityType>Custom</ActivityType>
              <CustomIcon><Id>${active ? 'green' : 'red'}</Id></CustomIcon>
            </Panel>
          </Extensions>`
}

async function saveButtons() {
  const panels = modes.map(({ name }, i) => createPanel(name, selectedModeIndex == i))
  for (let i = 0; i < panels.length; i++) {
    const PanelId = panelId + '-' + i;
    console.log('Saving PanelId:', PanelId)
    await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId }, panels[i]);
  }
}

async function toggleButton(index) {

  const requiredPanelId = panelId + '-' + index;
  const result = await xapi.Command.UserInterface.Extensions.List({ ActivityType: 'Custom' });
  const currentPanel = result?.Extensions?.Panel?.find(({ PanelId }) => PanelId == requiredPanelId);

  if (typeof currentPanel == 'undefined') throw Error('Unable to find Panel with Id: ' + requiredPanelId);

  const { Name, Order } = currentPanel;
  const currentIcon = currentPanel?.CustomIcon?.Id;
  const newState = currentIcon != 'green'
  const panel = createPanel(Name, newState, Order);

  await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: requiredPanelId }, panel);

}


async function deleteButtons() {

  const result = await xapi.Command.UserInterface.Extensions.List({ ActivityType: 'Custom' });
  const panelIds = result?.Extensions?.Panel?.filter(({ PanelId }) => PanelId.startsWith(panelId)).map(({ PanelId }) => PanelId);

  if (!panelIds) return

  for (let i = 0; i < panelIds.length; i++) {
    const PanelId = panelIds[i];
    console.log('Deleting PanelId:', PanelId)
    await xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId });
  }
}



async function saveIcons() {

  const icons = {
    red: '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',
    green: 'iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAN9klEQVR4nO3dWXbiMBBG4Z9sLMrKoqwMZWX0g+MGjAFbgzXU/XRyMrRJC+IqleSBk9C/i9zNd27xr59PHrXcTpLC4vvfJ48NOj1siw6dancAO1wD3eka2G5t0wMF3ScKkkNHSAAtmgLdqZ0gjxV0TQ4khgaRAFpwHdm/1W+wb/Xz95mE0AASQA22Av4dEkJFJIAj3Ae8RNC/MiWEk3zdbthAAihpCnxG+Xgkg8JIALkR9KWQDNCoi5wuOv990Mo3X/tPPgoqgBSM9rUFSb9UBTjOdbSntdV87V0DIyPwe2m+9q7SE6YA71Dm94pFww1IAM8Q+KMgEbxAAlgi8EdFIlhBApgR+FaQCG6QACTporMIfGt+SALSR+0OVHWR10UXEfwWfXPUwGoFQLmPe0FGTyiylwAo9/GcuWmBnQQwjfrn2t1AF8wkgvETAOU+4vzIwE1Kxk4A0wLP97vNgBeGrgbGTQDM9ZHPsElgvARAyY9yvkabEox1HsBU8jPyo5TzaOcNjFMBUPLjOMNMCfpPAJT8qKf7KUHfUwBKftTV/ZSg3wqAQ3xpwuJ7V6EP4+h2StBnAmC+/174+/yr+2APyw0X3OKzNL1DoVtuiIWgk75qd2Kv/hIAwf9c0O0bbeXnRTJ4rcsk0AduyrnezppeGR384TVfTE17bO6QmDBj2sVpt83r+KB/lQxoy+YKR4URBP99O6t+wJMItjZfMDIMYJe6trPqlPokgtTmS4XH2NiNpnZWP4G/TAL8Befmi8TIsNh1puZVP5CpBnI1nz1OhsQuM7UeR32SwLvmM0fLYNhV+i353304cRB3aj5rzAyD4G97hZ9qIGdz2eJmCBzqG2O+TxLY01ym6ElS/1Rg7tY7nb7rC/5+p+vpu5+Ln8/C3+ffm5/5Qv2Zf/d3wd/fh+4vJ05XOw/XbqVGfqc8c25fsI9UArYHPllfFjqrzaB/1d/cyaBkf/toVZNAvSkAV/Xle/Wdjr0n0nzFoc/0+9gTjF1FSPGX51Bf6RH/XctVDbiKz6Gd5kuHXRsI/jyB09KrmOP5kAQuGj4J8GceL/hHf17HN1c8Dm8cuwZw0eXQ/69Fqa94y/PlICXPZFt+fsc4dD3guLsCD1/ebPDzfpOnnKZx0mXpSRlO6X1MeY3GMK3sDIXiLq1E7nHi5BKe77l671to/ojQLF8BXN+4A7F6HA9S/uJUAZL0rQPWA46YAvS4++aVcqpvr6+eU3zfg8rc1bg/xQfOsgmAef8kRD7Oq+05/ztO8YmPKkDqej2Aef/UYuf+I716sa/BuXrPW2m+VJiWOQzIFX5XX4qrAEY7YBqzpzmxF10VuXKw1BTAFfq9/QkRj/GZ+9ACH/GYINYCroqsB+RPALxp51XsPHbEV+9bDAtpnAocFShRAYy4+x7H1+5AQTF7BouBt7JPiPKuATD634t5dUeb+y/FrImM/prsk/VU4XwVAMF/L2bk8rk70aCYPSTk7kTXsk4Fck4BPjP+LptIn+uYBixl21PyTAEY/R9R/j/HNCCHH53Sa8ZcFQDBfytEPMZn7sNoQu0ONCdLzKUnAE73zcPSBIrhIo8MpwmnJQBK/3W/7zd54HJ3omGudgeGkbwgeNwNQfCcq92BCtzO7WOSqg1JA3B8AmD0x5FC7Q40K6kKoAIoIezc3hXoAyyJHojjEgCjP1K52h0YSnQVQAVQQqjdgQ7sPeoRSnRiKFED8v4EwOifn6VDgCglqgqgAgDGsXtgjkkAjP5Am3ZXAfsSAGf9Aa3bNUDvrQAY/YG27aoCticARn+gF5sH6j0VAKM/0Ae3dcNtCYDRH+jLxmnA1gqAI9VAXzZV7FsTgIvvB4AKNi0Gvk8AlP9Ar95WAVsqABb/gEG9TgCM/kDP3k4DuBYAGNvLCv5dAqD8B/rmXv3j8wRA+Q+M4cU0gCkAML6nlfyrBED5D4zh6WLgegKg/AdMYAoA2LBa0T9LAJT/gAGPCSDje48DaMbqOsBaBfCwEYAxsQYA2PEwtV9LAMz/gTG55Q/uEwDzf2BsixhfVgBOAMxgDQCw5W6Kv0wAzP+Bsbnbb64JgPk/YMNNrN9WAO5hQwAjcvMXrAEA9vy/zf/H2g8B2MAUALDHzV8wBQAMmxIARwAAW/5ifq4AXLWOAKiGKQBgk5NIAIBVn9I1AXAIEDCINQDAJicxBQDsush9cAgQsOtDlP+AWUwBALscCQAwjAQAGEYCAAwjAQB2fX6IswABs6gAAMNIAIBhJADAMM4EBAyjAgDs4kxAwDISAGAYCQAw7ENSqN0JAHVQAQB2BRIAYBgJADCMBAAYRgIA7Pr9kPRbuxcA6qACAAwjAQCGkQAAwzgTEDCMCgCwizMBAbNOCh86MQUArJorgFCzEwAOFyTWAACrfqVrAuBsQMAgpgCAYUwBAJuCNCcAjgQAtpxYBATMu00AoVYnABwqzF9QAQD2/D/q97H2QwA2MAUA7AnzF9cEwJEAwIbT8zWAIAAj+7n9ZpkAfgTADI4CALaE22/uEwDrADgKx5zqOL1KAJOw8jPs4XZuTzC852p3YAgPU/y1BMA6AGAEawAtCLU7ACPC8gePCWCaIzxsiB1c7Q50IOzc3hXogzUra3xUAIANq1P7ZwmAdYAUnzu3D7JXc4XaHYBEBYAaYoaXvUkV907yaz9eTwCsA6RxEY+h5nrN1e5A157uXa8qAHbJFG7n9qFAH1rld27vCvQBkl4lAM4KTPMd8ZiQuxMNihlWXO5OGPOk/JferwGErB3Ba9Rc65j/p3i5V71LAOySsZzipgEhcz9a4yMe4zL3Af+9TgAsBh5v5JQb89x87k4Y86L8lzgMWFbsOkDI240m/IhgPt7blHt6+ysucpLOGTpj0/tX+JHTeK94bAK4ZO6HJaf3e9/7CoBpQBof8ZigsV7x2OCPeQxmYctG28YnqoA0MVWANL3iLmM/aol9/oz+KX7ezf+lrWsAnBOQxkc+boQFwa/Ix/mcnTBoQ/BL+xYBQ1RHELcYKE2veGwAteBH8XtN7GsGacfQsScBjDAe1eMjHxfU5yufsuof+zhMNo7++1101oUW3ZTw4av3fnvzic+VltIKBf+UAFz1p9dzSw2MHpKAhefYciuOKiCtOY0bICM/tz6a3xvOMWcC9jgjbUfqoT2vaWEwZOhLLkF5+sTCXyeoAtLaWWkjZUsjZmrJP3+cqz+T3puPCeXYawGoAlI45Vnp9ppOsqnx1wiaRn2f4Xd5jXHCkynk7PSWOme+/XA6piI4Z+53C1VM/83HhnHsSZrTLsfpwelyz+fd38en8o2qQdcqI2T6ndKYFz3Vsem03zXxCUCaqgCKt3QlF/X83+e9C2xBZYJ+5kTw5xEd/FJ6AnDiz5jHkdfLu5vP4ebnQcfwYsU/n6QEkI61gHwt14p6yx/M+XM2nxq+aRXA7KJLlt+Dse+c48XIn9OGG368k+uWYBwWzOVbYyYAL4I/rywxl6cCkFgQzC0o7XLaVjhNge/qdmMwQac8F4rnvCkoVUBOTtPyqq/bjSRe49zVqC2/tTuwjgXBMu2svCfflP5wYk8o13zOkM03BZhdxIJgKa0vEDpR7peWYeHvVon3Bej5JlZt+9Y0xnq1lQicplKfcr+07NPs/BWAxILgUebdwVf6/50Y8Y9T5ISfUgnAiTMEjzUfMQiF/x+n6+E8V/j/wq2vEnfnLpMAJP0tVnDkt4ag6zqxT/xdTgR8fZVP943FWnAbLeYUY07ZbaX5kiFa9s1BT83dvMqmz4Meg/wKj/xHvDswJwgBcYofUSufAE7dvrUFUNPPEW/Jd0QFMJcx4ZD/C+jfYYt+xyQAifUAYKsDV/yPSwATpgLAa4eeSXtsAmA9AHjlkHn/raMrgLm8IQkA96qc7HN8ApBYFATuhVpn+tVJABKLgsAk2919YtRLABJJAKgY/FLtBDBhPQBWVb93RrmrAffg8uGroLLvyFODU/63K+tfkct7+zXdSc52441BrDSfLW6GYnn3sBD8JIHpL40XrO4etYPy6I9z9Ve8RvNZYiSjFhYB71k8UcjWs7Wqybv6tJcAJJtJwBpbf90mg19qNQFItpJAqN2BClztDhym2eCXWk4Akp0k4Gp3AIV8tRz8UusJQJqTQPUTJor6rN2BCsZ/zl0c528/AUjzZcTjJgGntt7ppzSvkaueoE6CX2rlTMA9Rn7XIQtXRjiNfM5n1Qt7YvRRAdwa+QKis8auBLwI/sb0VwHMLLzzUKjdgYxc7Q4U1fRK/yv9JgDJRhJA67oNfqn3BCBJXEmIOoIq3MMvt/4TwIxqAMfpcr6/pr9FwGesnDSE2n5GCX5ppApgxpQAZQQNUPIvjZcAZkwJkM8wJf/SOFOAJaYEyGOokn9p3Apgdvl/RzqqAewRNGDJvzR+ApgxJcB23ZzLn8pOApiRCPDcsHP9Z+wlAGlOAp8a/QRVbBVkoNxfYzMBzKgG0PmpvKlsJ4AZicAic+X+GhLA7HrLZhLB2IKMlvtrSABLJIJRBRH4D0gAz5AIRhFE4D9FAniHRNCrIAIfWVl927K+2lkXDu+iJBJBi+0sAn83pgApOKGotiDKfDSBquCodhajfTZUALmxaFhKEKN9diSAkkgGqYII+qJIAEchGWwR/j5PN3Ih8IsjAdRwvUmJREIIIuCrIQG0wFZCCCLgm0ECaNF9Quj5MGP4+/yr6eq78HxT1EAC6Ml9YpDaSA7h7/Pv/68J9G6QAEbxmBxufS6+X9suPHns79PtCPTu/QNZs8GympXO/AAAAABJRU5ErkJggg=='
  }

  const iconNames = Object.keys(icons);
  const iconList = await xapi.Command.UserInterface.Extensions.Icon.List();
  const oldIcons = iconList?.Icon?.filter(({ Id }) => iconNames.includes(Id)).map(({ Id }) => Id) ?? [];

  for (let i = 0; i < oldIcons.length; i++) {
    const Id = oldIcons[i];
    console.log('Deleting Old Icon Id:', Id)
    await xapi.Command.UserInterface.Extensions.Icon.Delete({ Id });
  }

  for (let i = 0; i < iconNames.length; i++) {
    const Id = iconNames[i];
    console.log('Saving Icon Id:', Id)
    await xapi.Command.UserInterface.Extensions.Icon.Upload({ Id }, icons[Id]);
  }

}