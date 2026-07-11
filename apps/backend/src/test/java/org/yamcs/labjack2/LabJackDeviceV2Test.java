package org.yamcs.labjack2;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import libs.LJM;
import org.junit.jupiter.api.Test;

class LabJackDeviceV2Test {

    @Test
    void noResponseBytesReceivedIsToleratedForDigitalRead() {
        assertTrue(LabJackDeviceV2.isTransientDigitalReadError(LJM.Errors.NO_RESPONSE_BYTES_RECEIVED.getValue()));
    }

    @Test
    void disconnectOnlyErrorsAreNotTreatedAsTransientDigitalReadFailures() {
        assertFalse(LabJackDeviceV2.isTransientDigitalReadError(LJM.Errors.DEVICE_NOT_FOUND.getValue()));
        assertFalse(LabJackDeviceV2.isTransientDigitalReadError(LJM.Errors.STREAM_NOT_RUNNING.getValue()));
    }

    @Test
    void noResponseBytesReceivedIsRestartableForStreamReads() {
        assertTrue(LabJackDeviceV2.isRestartableStreamReadError(LJM.Errors.NO_RESPONSE_BYTES_RECEIVED.getValue()));
    }
}
