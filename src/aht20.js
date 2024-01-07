// import { I2CAddressedBus } from '@johntalton/and-other-delights'

const COMMANDS = {
	RESET: 0xBA,
	INIT: 0xBE,
	MEASUREMENT: 0xAC,
}

const MEASUREMENT_COMMAND_BYTES = Uint8Array.from( [ COMMANDS.MEASUREMENT, 0x33, 0x00 ] )
const INITIALIZE_COMMAND_BYTES = Uint8Array.from( [ COMMANDS._INIT,  ])
const RESET_COMMAND_BYTES = Uint8Array.from([ COMMANDS.RESET, ])

/*
STATUS

Bit [7] Busy indication
1-Equipment is busy, in measurement mode
0- Equipment is idle, in hibernation state

Bit [6:5] Mode
0x00 NOR
0x01 CYC
0x10 / 0x11 CMD


Bit [3] CAL Enable
1 - Calibrated
0 - Uncalibrated

*/

// // CRC8 Poly: 1+ X4+ X5+ X8, init: 0xFF
// function calcCRC


export class AHT20 {
	#bus

	/** @param {I2CAddressedBus} abus  */
  static from(abus) {
		return new AHT20(abus)
	}

	/** @param {I2CAddressedBus} abus  */
	constructor(abus) {
		this.#bus = abus
	}

	async reset() {
		return this.#bus.i2cWrite(RESET_COMMAND_BYTES)
	}

	async initialize() {
		return this.#bus.i2cWrite(INITIALIZE_COMMAND_BYTES)
	}

	async getState() {
		const ab = await this.#bus.i2cRead(1)
		const [ state ] = new Uint8Array(ab)

		const initialized = state !== 0x18

		const busy = (state & 0b1000_0000) !== 0
		const _init = (state & 0b0001_0000) === 0
		const calibrated = (state & 0b0000_1000) !== 0

		return {
			initialized, _init,
			busy, calibrated
		}
	}

	async triggerMeasurement() {
		return this.#bus.i2cWrite(MEASUREMENT_COMMAND_BYTES)
	}

	async getMeasurement() {
		const ab = await this.#bus.i2cRead(7)
		const u8 = new Uint8Array(ab)

		const [
			state, hum0, hum1, ht, temp0, temp1, crc
		] = u8

		console.log({ state, hum0, hum1, ht, temp0, temp1, crc })

		const humidityRaw = (hum0 << 12) | (hum1 << 4) | (ht >> 4)
		const temperatureRaw = ((ht & 0b0000_1111) << 16) | (temp0 << 8) | temp1

		const humidityRH = (humidityRaw / Math.pow(2, 20)) * 100
		const temperatureC = (temperatureRaw / Math.pow(2, 20)) * 200 - 50

		return {
			temperatureRaw, humidityRaw,
			temperatureC, humidityRH
		}
	}
}
