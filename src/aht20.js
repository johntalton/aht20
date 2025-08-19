/**
 * @import { I2CAddressedBus, I2CBufferSource } from '@johntalton/and-other-delights'
 */

/**
 * @typedef {Object} Status
 * @property {boolean} initialized
 * @property {boolean} busy
 * @property {boolean} calibrated
 */

/**
 * @typedef {Object} Measurement
 * @property {boolean} validCRC,
 * @property {number} humidityRH,
 * @property {number} temperatureC
 */

/** @typedef {Measurement|Status} MeasurementWithStatus */

const COMMANDS = {
	RESET: 0xBA,
	// INIT: 0xBE,
	MEASUREMENT: 0xAC,
}

const CALIBRATION_REGISTERS = [ 0x1B, 0x1C, 0x1E ]
const CALIBRATION_MASK = 0xB0

const MEASUREMENT_COMMAND_BYTES = Uint8Array.from( [ COMMANDS.MEASUREMENT, 0x33, 0x00 ] )
// const INITIALIZE_COMMAND_BYTES = Uint8Array.from( [ COMMANDS.INIT, 0x08, 0x00 ])
const RESET_COMMAND_BYTES = Uint8Array.from([ COMMANDS.RESET, ])

const STATUS_BYTE_LENGTH = 1
const CRC_BYTE_LENGTH = 1
const MEASUREMENT_BYTE_LENGTH = STATUS_BYTE_LENGTH + 5 + CRC_BYTE_LENGTH

const STATE_MAGIC_UNINITIALIZED = 0x18
const STATE_BUSY_MASK = 0b1000_0000
const STATE_CALIBRATED_MASK = 0b0000_1000

/**
	 * @param {I2CBufferSource} buffer
	 * @returns {number}
	 */
function calculateCRC(buffer) {
	const u8 = ArrayBuffer.isView(buffer) ?
		new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
		new Uint8Array(buffer)

	let crc = 0xFF

	for(let i = 0; i < u8.byteLength; i += 1) {
		crc = crc ^ u8[i]
		for(let j = 0; j < 8; j += 1) {
			if((crc & 0x80) !== 0) {
				crc = ((crc << 1) ^ 0x31) & 0xff // js does not know 'overflow' so mask off with and ff
			}
			else {
				crc = crc << 1
			}
		}
	}

	return crc
}

export class Converter {
	/**
	 * @param {I2CBufferSource} buffer
	 * @returns {Status}
	 */
	static decodeState(buffer) {
		const u8 = ArrayBuffer.isView(buffer) ?
			new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
			new Uint8Array(buffer)

		const [ state ] = u8

		const initialized = state !== STATE_MAGIC_UNINITIALIZED

		const busy = (state & STATE_BUSY_MASK) !== 0
		const calibrated = (state & STATE_CALIBRATED_MASK) !== 0

		return {
			initialized,
			busy,
			calibrated
		}
	}

	/**
	 * @param {I2CBufferSource} buffer
	 * @returns {MeasurementWithStatus}
	 */
	static decodeMeasurement(buffer) {
		const u8 = ArrayBuffer.isView(buffer) ?
			new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
			new Uint8Array(buffer, 0, buffer.byteLength)

		const [ _, hum0, hum1, ht, temp0, temp1, crc ] = u8

		const state = Converter.decodeState(u8.subarray(0, 1))
		const expectedCRC = calculateCRC(u8.subarray(0, -1))

		const validCRC = expectedCRC === crc

		const humidityRaw = (hum0 << 12) | (hum1 << 4) | (ht >> 4)
		const temperatureRaw = ((ht & 0b0000_1111) << 16) | (temp0 << 8) | temp1

		const humidityRH = (humidityRaw / Math.pow(2, 20)) * 100
		const temperatureC = (temperatureRaw / Math.pow(2, 20)) * 200 - 50

		return {
			...state,
			validCRC,
			humidityRH,
			temperatureC
		}
	}
}

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

	async getState() {
		const ab = await this.#bus.i2cRead(STATUS_BYTE_LENGTH)
		return Converter.decodeState(ab)
	}

	async triggerMeasurement() {
		return this.#bus.i2cWrite(MEASUREMENT_COMMAND_BYTES)
	}

	async getMeasurement() {
		const ab = await this.#bus.i2cRead(MEASUREMENT_BYTE_LENGTH)
		return Converter.decodeMeasurement(ab)
	}
}
