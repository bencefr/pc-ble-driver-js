/* Copyright (c) 2010 - 2017, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const arrayToInt = require('./util/intArrayConv').arrayToInt;

const currentDir = require.resolve('./firmwareRegistry');
const hexDir = path.join(currentDir, '..', '..', 'pc-ble-driver', 'hex');
const sdV2Dir = path.join(hexDir, 'sd_api_v2');
const sdV3Dir = path.join(hexDir, 'sd_api_v3');

const VERSION_INFO_MAGIC = 0x46D8A517;
const VERSION_INFO_START = 0x20000;
const VERSION_INFO_LENGTH = 24;

/*
 * Holds connectivity firmware information for all supported devices.
 *
 * Devices that have a J-Link debug probe are programmed using nrfjprog, and
 * have only one firmware hex file. Devices that use the Nordic USB stack
 * are programmed using serial DFU. In this case, we need two hex files: One
 * for the softdevice and one for the connectivity application.
 *
 * MacOS does not support opening serial ports using baud rates higher than
 * 115200, while Windows and Linux supports 1m. This requires separate
 * connectivity firmwares and baud rate settings for the different OS'es.
 */
function getFirmwareMap(platform) {
    return {
        jlink: {
            nrf51: {
                file: platform === 'darwin' ?
                    path.join(sdV2Dir, 'connectivity_1.2.2_115k2_with_s130_2.0.1.hex') :
                    path.join(sdV2Dir, 'connectivity_1.2.2_1m_with_s130_2.0.1.hex'),
                version: '1.2.2',
                baudRate: platform === 'darwin' ? 115200 : 1000000,
                sdBleApiVersion: 2,
            },
            nrf52: {
                file: platform === 'darwin' ?
                    path.join(sdV3Dir, 'connectivity_1.2.2_115k2_with_s132_3.0.hex') :
                    path.join(sdV3Dir, 'connectivity_1.2.2_1m_with_s132_3.0.hex'),
                version: '1.2.2',
                baudRate: platform === 'darwin' ? 115200 : 1000000,
                sdBleApiVersion: 3,
            },
        },
        nordicUsb: {
            pca10059: {
                files: {
                    application: path.join(sdV3Dir, 'connectivity_1.2.2_1m_with_s132_3.0.hex'), // TODO: Add real file.
                    softdevice: path.join(sdV3Dir, 'connectivity_1.2.2_1m_with_s132_3.0.hex'), // TODO: Add real file.
                },
                version: 'connectivity 1.2.2+dfuMar-27-2018-12-41-04', // TODO: Add real version.
                baudRate: platform === 'darwin' ? 115200 : 1000000,
                sdBleApiVersion: 3,
            },
        },
    };
}

/**
 * Exposes connectivity firmware information to the consumer of pc-ble-driver-js.
 * Implemented as a class with static functions in order to stay consistent with
 * the rest of the pc-ble-driver-js API.
 */
class FirmwareRegistry {

    /**
     * Get connectivity firmware information for the given device family.
     * Returns an object on the form:
     * {
     *   file: '/path/to/firmware.hex',
     *   version: '1.2.2',
     *   baudRate: 115200,
     *   sdBleApiVersion: 2,
     * }
     *
     * @param {String} family The device family. One of 'nrf51' or 'nrf52'.
     * @param {String} [platform] Optional value that can be one of 'win32',
     *     'linux', 'darwin'. Will use the detected platform if not provided.
     * @returns {Object} Firmware info object as described above.
     */
    static getJlinkConnectivityFirmware(family, platform) {
        const firmwareMap = getFirmwareMap(platform || process.platform);
        if (!firmwareMap.jlink[family]) {
            throw new Error(`Unsupported family: ${family}. ` +
                `Expected one of ${JSON.stringify(Object.keys(firmwareMap.jlink))}`);
        }
        return firmwareMap.jlink[family];
    }

    /**
     * Get connectivity firmware information for Nordic USB devices.
     * Returns an object on the form:
     * {
     *   files: {
     *     application: '/path/to/application.hex',
     *     softdevice: '/path/to/softdevice.hex',
     *   },
     *   version: 'connectivity 1.2.2+dfuMar-27-2018-12-41-04',
     *   baudRate: 115200,
     *   sdBleApiVersion: 3,
     * }
     *
     * @param {String} [platform] Optional value that can be one of 'win32',
     *     'linux', 'darwin'. Will use the detected platform if not provided.
     * @returns {Object} Firmware info object as described above.
     */
    static getNordicUsbConnectivityFirmware(platform) {
        const firmwareMap = getFirmwareMap(platform || process.platform);
        return firmwareMap.nordicUsb.pca10059;
    }

    /**
     * Returns an object that can be passed to the nrf-device-setup npm library
     * for setting up the device. See https://www.npmjs.com/package/nrf-device-setup
     * for a description of the returned object format.
     *
     * @param {String} [platform] Optional value that can be one of 'win32',
     *     'linux', 'darwin'. Will use the detected platform if not provided.
     * @returns {Object} Device setup object.
     */
    static getDeviceSetup(platform) {
        const firmwareMap = getFirmwareMap(platform || process.platform);

        const config = {
            jprog: {},
            dfu: {},
        };

        // Convert jlink entries from the firmwareMap to jprog entries as
        // expected by nrf-device-setup. Reading files into buffers to avoid
        // problems with file system paths when using the library inside an
        // Electron asar archive.
        Object.keys(firmwareMap.jlink).forEach(family => {
            const deviceConfig = firmwareMap.jlink[family];
            const buffer = fs.readFileSync(deviceConfig.file);
            Object.assign(config.jprog, {
                [family]: {
                    fw: buffer,
                    fwVersion: {
                        length: VERSION_INFO_LENGTH,
                        validator: data => {
                            const parsedData = FirmwareRegistry.parseVersionStruct(data);
                            return parsedData.version === deviceConfig.version &&
                                parsedData.baudRate === deviceConfig.baudRate;
                        },
                    },
                    fwIdAddress: VERSION_INFO_START,
                },
            });
        });

        // Convert nordicUsb entries from the firmwareMap to dfu entries as
        // expected by nrf-device-setup. Reading files into buffers to avoid
        // problems with file system paths when using the library inside an
        // Electron asar archive.
        Object.keys(firmwareMap.nordicUsb).forEach(deviceType => {
            const deviceConfig = firmwareMap.nordicUsb[deviceType];
            const applicationBuffer = fs.readFileSync(deviceConfig.files.application);
            const softdeviceBuffer = fs.readFileSync(deviceConfig.files.softdevice);
            Object.assign(config.dfu, {
                [deviceType]: {
                    application: applicationBuffer,
                    softdevice: softdeviceBuffer,
                    semver: deviceConfig.version,
                },
            });
        });

        return config;
    }

    /**
     * Parse the version info struct that can be found in the connectivity
     * firmware. See the connectivity firmware patch in pc-ble-driver/hex/sd_api_v*
     * for details.
     *
     * @param {Number[]} versionStruct Array of integers from the firmware.
     * @returns {Object} Parsed version info struct as an object.
     */
    static parseVersionStruct(versionStruct) {
        const magic = arrayToInt(versionStruct.slice(0, 4));
        const isValid = versionStruct.length === VERSION_INFO_LENGTH
            && magic === VERSION_INFO_MAGIC;
        if (!isValid) {
            return {};
        }
        const major = versionStruct[12];
        const minor = versionStruct[13];
        const patch = versionStruct[14];
        const version = `${major}.${minor}.${patch}`;
        const sdBleApiVersion = versionStruct[16];
        const transportType = versionStruct[17];
        const baudRate = arrayToInt(versionStruct.slice(20, 24));
        return {
            version,
            sdBleApiVersion,
            transportType,
            baudRate,
        };
    }
}

module.exports = FirmwareRegistry;
