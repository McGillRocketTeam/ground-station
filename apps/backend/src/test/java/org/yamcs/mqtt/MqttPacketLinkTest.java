package org.yamcs.mqtt;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.yamcs.YConfiguration;
import org.yamcs.commanding.PreparedCommand;
import org.yamcs.events.EventProducer;
import org.yamcs.events.EventProducerFactory;
import org.yamcs.tctm.Link.Status;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.buffer.ByteBufUtil;
import io.netty.channel.Channel;
import io.netty.channel.ChannelHandlerContext;
import io.netty.channel.ChannelInitializer;
import io.netty.channel.SimpleChannelInboundHandler;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.SocketChannel;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.handler.codec.mqtt.MqttConnAckMessage;
import io.netty.handler.codec.mqtt.MqttConnectMessage;
import io.netty.handler.codec.mqtt.MqttConnectReturnCode;
import io.netty.handler.codec.mqtt.MqttDecoder;
import io.netty.handler.codec.mqtt.MqttEncoder;
import io.netty.handler.codec.mqtt.MqttMessage;
import io.netty.handler.codec.mqtt.MqttMessageBuilders;
import io.netty.handler.codec.mqtt.MqttPublishMessage;
import io.netty.handler.codec.mqtt.MqttQoS;
import io.netty.handler.codec.mqtt.MqttSubAckMessage;
import io.netty.handler.codec.mqtt.MqttSubscribeMessage;

public class MqttPacketLinkTest {

    static NioEventLoopGroup bossGroup;
    static NioEventLoopGroup workerGroup;
    static Channel serverChannel;
    static EventProducer eventProducer = mock(EventProducer.class);

    FakeMqttBroker broker;

    @BeforeAll
    public static void setup() throws InterruptedException {
        bossGroup = new NioEventLoopGroup(1);
        workerGroup = new NioEventLoopGroup();
        EventProducerFactory.setMockup(true);
    }

    @AfterAll
    public static void teardown() throws InterruptedException {
        bossGroup.shutdownGracefully();
        workerGroup.shutdownGracefully();
    }

    @BeforeEach
    public void beforeEach() throws InterruptedException {
        broker = new FakeMqttBroker();
    }

    @AfterEach
    public void afterEach() throws InterruptedException {
        broker.stop();
    }

    @Test
    public void testConnectionRefused() throws Exception {
        broker.stop();
        var mpt = getLink(false, null);
        mpt.startAsync().awaitRunning();
        assertEquals(Status.UNAVAIL, mpt.getLinkStatus());
        mpt.stopAsync().awaitTerminated();
    }

    @Test
    public void testConnectionTimeout1() throws Exception {
        broker.connAckDelayMillis = 5000;
        broker.start();

        var mpt = getLink(false, null);
        mpt.startAsync().awaitRunning();
        Thread.sleep(2000);
        assertEquals(Status.UNAVAIL, mpt.getLinkStatus());
        mpt.stopAsync().awaitTerminated();
    }

    @Test
    public void testConnectionTimeout2() throws Exception {
        // does not apply because it does not subscribe to anything
        broker.subAckDelayMillis = 5000;
        broker.start();

        var mpt = getLink(false, null);
        mpt.startAsync().awaitRunning();
        Thread.sleep(1000);
        assertEquals(Status.OK, mpt.getLinkStatus());
        mpt.stopAsync().awaitTerminated();
    }

    @Test
    public void testConnectionNack() throws Exception {
        broker.sendNegativeConnAck = true;
        broker.start();

        var mpt = getLink(false, null);
        mpt.startAsync().awaitRunning();
        Thread.sleep(1000);
        assertEquals(Status.UNAVAIL, mpt.getLinkStatus());
        mpt.stopAsync().awaitTerminated();
    }

    @Test
    public void testSubNack() throws Exception {
        broker.sendNegativeSubAck = true;
        broker.start();

        var mpt = getLink(false, "tm");
        mpt.startAsync().awaitRunning();

        Thread.sleep(1000);
        assertEquals(Status.UNAVAIL, mpt.getLinkStatus());
        mpt.stopAsync().awaitTerminated();
    }

    @Test
    public void test1() throws Exception {
        broker.start();

        var mpt = getLink(true, "tm");
        mpt.startAsync().awaitRunning();

        Thread.sleep(1000);
        assertEquals(Status.OK, mpt.getLinkStatus());

        byte[] commandData = "testCommand".getBytes();

        var pc = mock(PreparedCommand.class);
        when(pc.getBinary()).thenReturn(commandData);

        mpt.sendCommand(pc);
        Thread.sleep(1000);

        assertEquals(1, broker.received.size());
        assertArrayEquals(commandData, broker.received.get(0));

        mpt.stopAsync().awaitTerminated();
    }

    MqttPacketLink getLink(boolean autoReconnect, String tmTopic) {
        YConfiguration config = getConfig(broker.port, autoReconnect, tmTopic);

        MqttPacketLink mpt = new MqttPacketLink();
        mpt.init("test", "test", config);
        return mpt;

    }

    YConfiguration getConfig(int port, boolean autoReconnect, String tmTopic) {
        Map<String, Object> m = new HashMap<>();
        m.put("brokers", Arrays.asList("tcp://localhost:" + port));
        m.put("clientId", "test-clientid");
        m.put("connectionTimeoutSecs", 1);
        m.put("autoReconnect", autoReconnect);
        m.put("keepAliveSecs", 60);
        m.put("tcTopic", "tc");
        if (tmTopic != null) {
            m.put("tmTopic", tmTopic);
        }
        return YConfiguration.wrap(m);
    }

    static class FakeMqttBroker {
        List<byte[]> received = new ArrayList<>();

        private final NioEventLoopGroup bossGroup = new NioEventLoopGroup(1);
        private final NioEventLoopGroup workerGroup = new NioEventLoopGroup();
        private Channel serverChannel;
        private int port;

        long connAckDelayMillis = 0;
        long subAckDelayMillis = 0;
        long pubAckDelayMillis = 0;

        private boolean sendNegativeConnAck = false;
        private boolean sendNegativeSubAck = false;

        public void start() throws InterruptedException {
            ServerBootstrap b = new ServerBootstrap();
            b.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    // .handler(new LoggingHandler(LogLevel.INFO))
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        public void initChannel(SocketChannel ch) {
                            ch.pipeline().addLast(MqttEncoder.INSTANCE);
                            ch.pipeline().addLast(new MqttDecoder());
                            ch.pipeline().addLast(new SimpleChannelInboundHandler<MqttMessage>() {
                                @Override
                                protected void channelRead0(ChannelHandlerContext ctx, MqttMessage msg) {
                                    if (msg instanceof MqttConnectMessage) {
                                        ctx.executor().schedule(() -> {
                                            MqttConnAckMessage connAckMessage = MqttMessageBuilders.connAck()
                                                    .returnCode(sendNegativeConnAck
                                                            ? MqttConnectReturnCode.CONNECTION_REFUSED_IDENTIFIER_REJECTED
                                                            : MqttConnectReturnCode.CONNECTION_ACCEPTED)
                                                    .build();
                                            ctx.writeAndFlush(connAckMessage);
                                        }, connAckDelayMillis, TimeUnit.MILLISECONDS);
                                    } else if (msg instanceof MqttSubscribeMessage) {
                                        ctx.executor().schedule(() -> {
                                            MqttSubAckMessage subAckMessage = MqttMessageBuilders.subAck()
                                                    .packetId(((MqttSubscribeMessage) msg).variableHeader().messageId())
                                                    .addGrantedQos(sendNegativeSubAck ? MqttQoS.FAILURE
                                                            : MqttQoS.AT_MOST_ONCE)
                                                    .build();
                                            ctx.writeAndFlush(subAckMessage);

                                        }, subAckDelayMillis, TimeUnit.MILLISECONDS);
                                    } else if (msg instanceof MqttPublishMessage) {
                                        MqttPublishMessage msgp = (MqttPublishMessage) msg;
                                        received.add(ByteBufUtil.getBytes(msgp.payload()));
                                        ctx.executor().schedule(() -> {
                                            MqttMessage pubAckMessage = MqttMessageBuilders.pubAck()
                                                    .packetId(msgp.variableHeader().packetId())
                                                    .build();
                                            ctx.writeAndFlush(pubAckMessage);
                                        }, pubAckDelayMillis, TimeUnit.MILLISECONDS);
                                    }
                                }
                            });
                        }
                    });

            serverChannel = b.bind(0).sync().channel();
            port = ((InetSocketAddress) serverChannel.localAddress()).getPort();
        }

        public void stop() {
            if (serverChannel != null) {
                serverChannel.close();
            }
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }

        public void setConnAckDelayMillis(long connAckDelayMillis) {
            this.connAckDelayMillis = connAckDelayMillis;
        }

        public void setPubAckDelayMillis(long pubAckDelayMillis) {
            this.subAckDelayMillis = pubAckDelayMillis;
        }

        public void setSendNegativeConnAck(boolean sendNegativeConnAck) {
            this.sendNegativeConnAck = sendNegativeConnAck;
        }

        public void setSendNegativePubAck(boolean sendNegativePubAck) {
            this.sendNegativeSubAck = sendNegativePubAck;
        }
    }
}
