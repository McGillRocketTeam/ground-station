package org.yamcs.mrt.links;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.tctm.Link;

class AstraGenericTmLinkTest {

    @BeforeEach
    void resetRegistry() {
        FlightComputerPacketDedupRegistry.clear();
        AbstractAstraGenericTmTcLink.clearTelemetryStatusRegistry();
    }

    @Test
    void readsPacketIdAsLittleEndianUint16() {
        assertEquals(0x1234, AstraGenericTmLink.readPacketId(new byte[] {0x34, 0x12}));
    }

    @Test
    void extractsSystemNameFromLinkName() {
        assertEquals("SystemA", AstraGenericTmLink.extractSystemName("SystemA/Rocket/FlightComputer"));
    }

    @Test
    void rejectsDuplicatePacketIds() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 42));
        assertFalse(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 42));
    }

    @Test
    void rejectsDuplicatePacketIdsAcrossDifferentLinksInSameSystem() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 42));
        assertFalse(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 42));
    }

    @Test
    void doesNotDeduplicateAcrossSystems() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 42));
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemB", 42));
    }

    @Test
    void rejectsOlderPacketIdsWithinCurrentCycle() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 100));
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 101));
        assertFalse(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 100));
    }

    @Test
    void rejectsOnlySmallBackwardJumps() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 100));
        assertFalse(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 95));
    }

    @Test
    void acceptsCounterResetAfterLargeBackwardJump() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 468));
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 1));
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 2));
    }

    @Test
    void acceptsPacketIdsAfterRollover() {
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 0xFFFF));
        assertTrue(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 0));
        assertFalse(FlightComputerPacketDedupRegistry.shouldProcess("SystemA", 0xFFFF));
    }

    @Test
    void allowsShortPacketsThrough() {
        AstraGenericTmLink link = new AstraGenericTmLink();

        assertTrue(link.shouldProcessTelemetryPayload(new byte[] {0x01}));
    }

    @Test
    void marksFlightComputerLinkOkWhenTelemetryArrives() {
        AstraGenericTmLink link = new AstraGenericTmLink();

        assertEquals(Link.Status.UNAVAIL, link.connectionStatus());

        link.noteTelemetryReceived();

        assertEquals(Link.Status.OK, link.connectionStatus());
    }

    @Test
    void marksConfiguredFlightComputerTargetOkWhenTelemetryArrives() {
        TestTmTcLink radioLink = new TestTmTcLink();
        TestTmTcLink flightComputerLink = new TestTmTcLink();
        AbstractAstraGenericTmTcLink.registerTelemetryStatusLink(
                "SystemA/Rocket/FlightComputer", flightComputerLink);
        radioLink.setTelemetryStatusTargets(
                java.util.List.of("SystemA/Rocket/FlightComputer"));

        radioLink.noteTelemetryReceived();

        assertEquals(Link.Status.OK, flightComputerLink.connectionStatus());
    }

    @Test
    void appliesPendingTelemetryStatusWhenFlightComputerLinkRegistersLate() {
        TestTmTcLink flightComputerLink = new TestTmTcLink();

        AbstractAstraGenericTmTcLink.markTelemetryStatusOk("SystemA/Rocket/FlightComputer");
        AbstractAstraGenericTmTcLink.registerTelemetryStatusLink(
                "SystemA/Rocket/FlightComputer", flightComputerLink);

        assertEquals(Link.Status.OK, flightComputerLink.connectionStatus());
    }

    private static byte[] packet(int packetId) {
        return new byte[] {(byte) packetId, (byte) (packetId >>> 8), 0x00, 0x00};
    }

    private static final class TestTmTcLink extends AbstractAstraGenericTmTcLink {
        @Override
        public boolean sendCommand(PreparedCommand preparedCommand) {
            return false;
        }

        @Override
        public boolean isTcDataLinkImplemented() {
            return false;
        }
    }
}
