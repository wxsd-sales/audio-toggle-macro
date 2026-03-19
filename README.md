# Audio Toggle Macro

This is an example macro that shows how to create custom action buttons that act as a toggle group which can be used to apply audio configuration changes.

![Control Panel Screenshot](/images/control-panel.png)

## Overview

This macro lets you easily create custom action buttons on the Control Panel which change color and icon to indicate which audio mode has been set.

Upon startup, the macro will create the buttons from the macro config and activate a default mode.

When a mode is activated, it will show as a green microphone icon and when not activated, it will show as a red muted icon.

Example macro config below

```javascript
const modes = [               // Array of Audio Modes
  {
    name: 'Mode 1',           // Give the node a unique name
    config: () => {           // Each mode should have a config function

      // Specify all xConfigs changes for the given mode
      // Keep in mind that audio inputs and xConfig 
      // options vary between devices

      // Example where Mode 1 Sets Ethernet 1 On and 3 - 4 Off
      xapi.Config.Audio.Input.Ethernet[1].Mode.set('On');
      xapi.Config.Audio.Input.Ethernet[2].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[3].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[4].Mode.set('Off');
    }
  },
  {
    name: 'Mode 2',
    config: () => {
      // Example where Mode 2 Sets Ethernet 2 On and 1, 3, 4 Off
      xapi.Config.Audio.Input.Ethernet[1].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[2].Mode.set('On');
      xapi.Config.Audio.Input.Ethernet[3].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[4].Mode.set('Off');
    }
  },
  {
    name: 'Mode 3',
    config: () => {
      // Example where Mode 3 Sets Ethernet 3 On and 1, 2, 4 Off
      xapi.Config.Audio.Input.Ethernet[1].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[2].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[3].Mode.set('On');
      xapi.Config.Audio.Input.Ethernet[4].Mode.set('Off');
    }
  },
  {
    name: 'Mode 4',
    config: () => {
      // Example where Mode 4 Sets Ethernet 4 On and 1, 2, 3 Off
      xapi.Config.Audio.Input.Ethernet[1].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[2].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[3].Mode.set('Off');
      xapi.Config.Audio.Input.Ethernet[4].Mode.set('On');
    }
  }
]

const defaultMode = 'Mode 1';       // Name of the mode which is applied when the macro starts

```

Lastly, the macro by default automatically applies the default audio mode upon joining a new RoomOS or MTR call. This feature can be disabled by setting the  `newCallApplyDefault` in the macros config to `false`.

```javascript
const newCallApplyDefault = true;   // can be set to true or false
```


## Setup

### Prerequisites & Dependencies: 

- Webex Device with RoomOS 11.x or above
- Web admin access to the device to upload the macro


### Installation Steps:

1. Download the ``audio-toggle.js`` file and upload it to your Webex Devices Macro editor via the web interface.
2. Configure the macros devices and presets in the configuration section.
3. Enable the Macro on the editor.

## Demo

*For more demos & PoCs like this, check out our [Webex Labs site](https://collabtoolbox.cisco.com/webex-labs).

## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.


## Disclaimer

Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex use cases, but are not Official Cisco Webex Branded demos.


## Questions
Please contact the WXSD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=Audio-Toggle-Macro) for questions. Or, if you're a Cisco internal employee, reach out to us on the Webex App via our bot (globalexpert@webex.bot). In the "Engagement Type" field, choose the "API/SDK Proof of Concept Integration Development" option to make sure you reach our team. 