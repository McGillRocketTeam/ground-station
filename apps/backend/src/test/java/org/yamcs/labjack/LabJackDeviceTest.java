package org.yamcs.labjack;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Verifies the LJM-error classification that drives stream-recovery. Getting this wrong is the
 * difference between "transparently reconnects after the T7 power-cycles" and "stuck forever".
 */
class LabJackDeviceTest {

    @Test
    void disconnectClassErrorsTriggerReconnect() {
        int[] disconnects = {
            1224, // DEVICE_NOT_OPEN
            1225, // STREAM_NOT_INITIALIZED
            1227, // DEVICE_NOT_FOUND
            1233, // SOCKET_LEVEL_ERROR
            1239, // RECONNECT_FAILED
            1240, // CONNECTION_HAS_YIELDED_RECONNECT_FAILED
            1242, // STREAM_FLUSH_TIMEOUT
            1302, // COULD_NOT_START_STREAM
            1303 // STREAM_NOT_RUNNING
        };
        for (int code : disconnects) {
            assertTrue(LabJackDevice.isDisconnectError(code), "LJM " + code + " should force reconnect");
        }
    }

    @Test
    void transientOrUnknownErrorsDoNotTriggerReconnect() {
        for (int code : new int[] {0, 1, 1234, 2000, 9999}) {
            assertFalse(LabJackDevice.isDisconnectError(code), "LJM " + code + " should be transient");
        }
    }
}
