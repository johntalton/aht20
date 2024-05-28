const COMMANDS = {
	RESET: 0xBA,
	// INIT: 0xBE,
	MEASUREMENT: 0xAC,
}

const MEASUREMENT_COMMAND_BYTES = Uint8Array.from( [ COMMANDS.MEASUREMENT, 0x33, 0x00 ] )
// const INITIALIZE_COMMAND_BYTES = Uint8Array.from( [ COMMANDS.INIT, 0x08, 0x00 ])
const RESET_COMMAND_BYTES = Uint8Array.from([ COMMANDS.RESET, ])

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
	/** @param {ArrayBufferLike|DataView|ArrayBufferView} buffer  */
	static decodeState(buffer) {
		const u8 = ArrayBuffer.isView(buffer) ?
			new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
			new Uint8Array(buffer)

		const [ state ] = u8

		const initialized = state !== 0x18

		const busy = (state & 0b1000_0000) !== 0
		const calibrated = (state & 0b0000_1000) !== 0

		return {
			initialized,
			busy, calibrated
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

	async initialize() {
		throw new Error('no implementation')
	// 	return this.#bus.i2cWrite(INITIALIZE_COMMAND_BYTES)
	}

	async getState() {
		const ab = await this.#bus.i2cRead(1)
		return Converter.decodeState(ab)
	}

	async triggerMeasurement() {
		return this.#bus.i2cWrite(MEASUREMENT_COMMAND_BYTES)
	}

	async getMeasurement() {
		const ab = await this.#bus.i2cRead(7)
		const u8 = new Uint8Array(ab)

		const [
			_, hum0, hum1, ht, temp0, temp1, crc
		] = u8

		const expectedCRC = calculateCRC(u8.subarray(0, -1))
		const validCRC = expectedCRC === crc

		const state = Converter.decodeState(u8.subarray(0, 1))

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
