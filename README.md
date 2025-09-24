# AHT20

Humidity and Temperature sensor driver.


[![npm Version](http://img.shields.io/npm/v/@johntalton/aht20.svg)](https://www.npmjs.com/package/@johntalton/aht20)
![GitHub package.json version](https://img.shields.io/github/package-json/v/johntalton/aht20)
[![CI](https://github.com/johntalton/aht20/actions/workflows/CI.yml/badge.svg)](https://github.com/johntalton/aht20/actions/workflows/CI.yml)


# Usage

The AHT20 use a triggered reading result workflow.  Thus, reading data will be stable (unchanged) until the next trigger is performed.

```javascript
import { I2CAddressedBus } from '@johntalton/and-other-delights'
import { AHT20, DEFAULT_ADDRESS } from '@johntalton/aht20'

const bus = // some I2CBus implementation
const device = new AHT20(new I2CAddressedBus(bus, DEFAULT_ADDRESS))

// trigger a single measurement that can be read at a later time
await device.triggerMeasurement()

// read the measurement / state date and CRC check
const { state, validCRC, temperatureC, humidityRH } = await device.getMeasurement()

// excessive checking state is not needed in most cases, just example
if(state.busy || !state.initialized) {
  // handle error
}

// it is recomended however to check the CRC
// it will be true if the returned CRC matches the computed CRC (done automatically by library)
if(!validCRC) {
  // handle data read error
}

// all good
console.log('The Temperature is: ', temperatureC)

```