# Audio Toggle Macro

This macro creates custom RoomOS Control Panel buttons that independently toggle groups of audio inputs. Each group can include Ethernet microphones, analog microphone inputs, and USB-C microphones, letting users quickly turn the microphones for a specific area or use case on or off.

![Control Panel Screenshot](/images/control-panel.png)

## Overview

This macro lets you create up to four custom action buttons on the Control Panel. Each button represents one microphone group and acts as its own toggle.

Upon startup, the macro validates the group configuration, creates the buttons, maps Ethernet microphones by MAC address, and applies the configured default state for each group.

When a user taps a group button, the macro sets every supported audio input in that group to the same mode:

- Green microphone icon: every available input in the group is `On`.
- Red muted icon: every available input in the group is `Off`.
- Orange microphone icon: the group is in a mixed state, meaning some inputs are `On` and some are `Off`.

The orange mixed state is useful when an admin manually changes microphone mode settings outside the macro and leaves a group misconfigured. The macro monitors microphone and Ethernet input mode changes and updates the button color to reflect the actual state of the group.

Ethernet microphones are configured by MAC address because the RoomOS Ethernet input ID can vary between devices or after reconnects. The macro uses the Ethernet microphone stream name, which matches the microphone MAC address, to map each configured MAC to its current RoomOS Ethernet input ID before applying changes.

Example macro config below:

```javascript
const groups = [
  {
    name: "Presenter",
    ethernetMacs: ["11:11:11:11:11:11", "22:22:22:22:22:22"],
    microphoneIds: [1, 2],
    default: true,
  },
  {
    name: "Audience",
    ethernetMacs: ["33:33:33:33:33:33"],
    microphoneIds: [3, 4],
    default: false,
  },
  {
    name: "USB Mic",
    usbMicrophone: [1],
    default: false,
  },
];
```

The macro also validates the group configuration at startup. There must be at least one group and no more than four groups. Group names must be unique and each configured microphone value must only appear once across all groups.

Lastly, the macro can automatically reapply the default group states after a call ends. This feature can be disabled by setting `applyDefaultAfterCall` in the macro config to `false`.

```javascript
const applyDefaultAfterCall = true;
const applyDefaultDelayMinutes = 5;
```


## Setup

### Prerequisites & Dependencies: 

- Webex Device with RoomOS 11.x or above
- Web admin access to the device to upload the macro


### Installation Steps:

1. Download the ``audio-toggle.js`` file and upload it to your Webex Devices Macro editor via the web interface.
2. Configure the macro groups and other settings, there are comments in the config section to help with this.
3. Enable the Macro on the editor.

## Demo

*For more demos & PoCs like this, check out our [Webex Labs site](https://collabtoolbox.cisco.com/webex-labs).

## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.


## Disclaimer

Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex use cases, but are not Official Cisco Webex Branded demos.


## Questions
Please contact the WXSD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=Audio-Toggle-Macro) for questions. Or, if you're a Cisco internal employee, reach out to us on the Webex App via our bot (globalexpert@webex.bot). In the "Engagement Type" field, choose the "API/SDK Proof of Concept Integration Development" option to make sure you reach our team.
