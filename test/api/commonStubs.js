
'use strict';

const sinon = require('sinon');

const BLE_GAP_EVT_CONNECTED = 10;
const BLE_GAP_EVT_DISCONNECTED = 17;

module.exports.createBleDriver = function(callbackForReceivingBleDriverEventCallback) {
    let bleDriver = 
    {
        gap_connect: sinon.stub(),
        gap_disconnect: sinon.stub(),
        gap_update_connection_parameters: sinon.stub(),
        get_version: sinon.stub(),
        gap_get_device_name: sinon.stub(),
        gap_get_address: sinon.stub(),
        gap_cancel_connect: sinon.stub(),
        open: (options, err) => {},
        BLE_GAP_EVT_CONNECTED,
        BLE_GAP_EVT_DISCONNECTED,
    };
    
    // Enable users to trigger events
    sinon.stub(bleDriver, 'open', (port, options, callback) => {
        let bleDriverEventCallback = options.eventCallback;
        callback();
        callbackForReceivingBleDriverEventCallback(bleDriverEventCallback);
    });

    bleDriver.gap_connect.yields(undefined);
    bleDriver.gap_disconnect.yieldsAsync(undefined);
    bleDriver.gap_cancel_connect.yields(undefined);
    bleDriver.get_version.yields('0.0.9', undefined);
    bleDriver.gap_get_device_name.yieldsAsync('holy handgrenade', undefined);
    bleDriver.gap_get_address.yieldsAsync('Bridge of death', undefined);

    return bleDriver;
};

module.exports.createConnectEvent = function() {
    return {
        id: BLE_GAP_EVT_CONNECTED,
        conn_handle: 123,
        peer_addr: {address: 'FF:AA:DD'},
        role: 'BLE_GAP_ROLE_PERIPHERAL',
        conn_params: {
            min_conn_interval: 10,
            max_conn_interval: 100,
            slave_latency: 100,
            conn_sup_timeout: 455
        }
    };
};
