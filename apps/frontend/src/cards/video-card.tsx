import { Schema } from "effect";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import { makeCard } from "@/lib/cards";
import { CameraField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";
import { mediaMtxWebRtcBaseUrl } from "@/lib/media-mtx/atom";

type ConnectionState = "connecting" | "live" | "reconnecting" | "error";
type PanState = {
  readonly pointerId: number;
  readonly originX: number;
  readonly originY: number;
  readonly startOffsetX: number;
  readonly startOffsetY: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const ZOOM_STEP = 0.0015;
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const DISCONNECTED_RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 10_000;

export const VideoCard = makeCard({
  id: "video-card",
  name: "Video Card",
  schema: Schema.Struct({
    camera: CameraField,
    url: Schema.optional(Schema.String).pipe(
      Schema.annotate({ [FormTitleAnnotationId]: "WebRTC / WHEP URL" }),
    ),
  }),
  component: (props) => <WebRtcVideo camera={props.params.camera} url={props.params.url} />,
});

function normalizeWhepUrl(rawUrl: string) {
  const url = new URL(rawUrl);

  if (url.protocol === "whep:") {
    url.protocol = "http:";
    return url;
  }

  if (url.protocol === "wheps:") {
    url.protocol = "https:";
    return url;
  }

  if (url.protocol === "http:" || url.protocol === "https:") {
    return url;
  }

  if (url.protocol === "webrtc:") {
    throw new Error("Use a WHEP endpoint here. Browsers cannot play a raw webrtc:// URL directly.");
  }

  throw new Error(`Unsupported video URL protocol: ${url.protocol}`);
}

function resolveVideoUrl(rawUrl: string) {
  const url = normalizeWhepUrl(rawUrl);

  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname) &&
    !["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    url.hostname = window.location.hostname;
  }

  if (!url.pathname.endsWith("/whep")) {
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/whep`;
  }

  return url;
}

function resolveCameraUrl(camera: string) {
  return new URL(
    `${camera.replace(/^\/+/, "")}/whep`,
    `${mediaMtxWebRtcBaseUrl.replace(/\/$/, "")}/`,
  );
}

function resolveVideoSource(camera: string | undefined, url: string | undefined) {
  if (camera) {
    return resolveCameraUrl(camera);
  }

  if (url) {
    return resolveVideoUrl(url);
  }

  throw new Error("Select a camera or enter a WebRTC / WHEP URL.");
}

function waitForIceGatheringComplete(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const handleIceGatheringStateChange = () => {
      if (peer.iceGatheringState !== "complete") {
        return;
      }

      peer.removeEventListener("icegatheringstatechange", handleIceGatheringStateChange);
      resolve();
    };

    peer.addEventListener("icegatheringstatechange", handleIceGatheringStateChange);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRenderedVideoSize(video: HTMLVideoElement, container: HTMLDivElement) {
  const intrinsicWidth = video.videoWidth;
  const intrinsicHeight = video.videoHeight;

  if (!intrinsicWidth || !intrinsicHeight) {
    return {
      width: container.clientWidth,
      height: container.clientHeight,
    };
  }

  const containerAspectRatio = container.clientWidth / container.clientHeight;
  const videoAspectRatio = intrinsicWidth / intrinsicHeight;

  if (videoAspectRatio > containerAspectRatio) {
    return {
      width: container.clientWidth,
      height: container.clientWidth / videoAspectRatio,
    };
  }

  return {
    width: container.clientHeight * videoAspectRatio,
    height: container.clientHeight,
  };
}

function WebRtcVideo({ camera, url }: { camera: string | undefined; url: string | undefined }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const reconnectAttemptRef = useRef(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsPanning(false);
    panStateRef.current = null;
    reconnectAttemptRef.current = 0;
  }, [camera, url]);

  function clampOffset(nextOffset: { x: number; y: number }, nextScale: number) {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!container || !video || nextScale <= MIN_SCALE) {
      return { x: 0, y: 0 };
    }

    const renderedVideoSize = getRenderedVideoSize(video, container);
    const maxOffsetX = Math.max(
      0,
      (renderedVideoSize.width * nextScale - container.clientWidth) / 2,
    );
    const maxOffsetY = Math.max(
      0,
      (renderedVideoSize.height * nextScale - container.clientHeight) / 2,
    );

    return {
      x: clamp(nextOffset.x, -maxOffsetX, maxOffsetX),
      y: clamp(nextOffset.y, -maxOffsetY, maxOffsetY),
    };
  }

  useEffect(() => {
    const abortController = new AbortController();
    const peer = new RTCPeerConnection();
    let sessionUrl: string | null = null;
    let reconnectTimeout: number | undefined;
    let reconnectScheduled = false;

    setConnectionState("connecting");
    setErrorMessage(null);

    function cancelReconnect() {
      if (reconnectTimeout !== undefined) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = undefined;
      }

      reconnectScheduled = false;
    }

    function scheduleReconnect(message: string, minimumDelay = INITIAL_RECONNECT_DELAY_MS) {
      if (abortController.signal.aborted || reconnectScheduled) {
        return;
      }

      reconnectScheduled = true;
      setConnectionState("reconnecting");
      setErrorMessage(message);

      const delay = Math.max(
        minimumDelay,
        Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** reconnectAttemptRef.current,
          MAX_RECONNECT_DELAY_MS,
        ),
      );

      reconnectTimeout = window.setTimeout(() => {
        reconnectAttemptRef.current += 1;
        setConnectionGeneration((generation) => generation + 1);
      }, delay);
    }

    peer.addTransceiver("video", { direction: "recvonly" });
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        cancelReconnect();
        reconnectAttemptRef.current = 0;
      } else if (peer.connectionState === "failed") {
        scheduleReconnect("Video stream connection dropped. Reconnecting...");
      } else if (peer.connectionState === "disconnected") {
        scheduleReconnect(
          "Video stream connection interrupted. Reconnecting...",
          DISCONNECTED_RECONNECT_DELAY_MS,
        );
      }
    };

    peer.ontrack = (event) => {
      const videoElement = videoRef.current;
      const [stream] = event.streams;

      if (!videoElement || !stream) {
        return;
      }

      videoElement.srcObject = stream;
      void videoElement.play().catch(() => {
        // Keep the card passive if autoplay is blocked.
      });
      cancelReconnect();
      reconnectAttemptRef.current = 0;
      setConnectionState("live");

      event.track.addEventListener(
        "ended",
        () => {
          scheduleReconnect("Video stream ended. Reconnecting...");
        },
        { once: true },
      );
    };

    void (async () => {
      let whepUrl: URL;

      try {
        whepUrl = resolveVideoSource(camera, url);
      } catch (error) {
        setConnectionState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to resolve video stream URL.",
        );
        return;
      }

      try {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await waitForIceGatheringComplete(peer);

        const response = await fetch(whepUrl, {
          method: "POST",
          body: peer.localDescription?.sdp,
          headers: {
            Accept: "application/sdp",
            "Content-Type": "application/sdp",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`WHEP negotiation failed with ${response.status}`);
        }

        const locationHeader = response.headers.get("location");
        sessionUrl = locationHeader ? new URL(locationHeader, whepUrl).toString() : null;
        const answerSdp = await response.text();

        await peer.setRemoteDescription({
          type: "answer",
          sdp: answerSdp,
        });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        scheduleReconnect(
          error instanceof Error
            ? `${error.message}. Reconnecting...`
            : "Failed to connect to video stream. Reconnecting...",
        );
      }
    })();

    return () => {
      abortController.abort();
      cancelReconnect();

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (sessionUrl) {
        void fetch(sessionUrl, { method: "DELETE" }).catch(() => {
          // Best-effort WHEP session cleanup.
        });
      }

      peer.close();
    };
  }, [camera, connectionGeneration, url]);

  function updateZoom(clientX: number, clientY: number, nextScale: number) {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

    setOffset((currentOffset) => {
      if (clampedScale === MIN_SCALE) {
        return { x: 0, y: 0 };
      }

      const anchorX = clientX - rect.left - rect.width / 2;
      const anchorY = clientY - rect.top - rect.height / 2;
      const scaleRatio = clampedScale / scale;

      return clampOffset(
        {
          x: anchorX - (anchorX - currentOffset.x) * scaleRatio,
          y: anchorY - (anchorY - currentOffset.y) * scaleRatio,
        },
        clampedScale,
      );
    });

    setScale(clampedScale);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();

    const delta = event.ctrlKey ? event.deltaY * 0.5 : event.deltaY;
    const zoomFactor = Math.exp(-delta * ZOOM_STEP);

    updateZoom(event.clientX, event.clientY, scale * zoomFactor);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (scale <= MIN_SCALE) {
      return;
    }

    panStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      ...clampOffset(
        {
          x: panState.startOffsetX + event.clientX - panState.originX,
          y: panState.startOffsetY + event.clientY - panState.originY,
        },
        scale,
      ),
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (panStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    panStateRef.current = null;
    setIsPanning(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleDoubleClick() {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setIsPanning(false);
    panStateRef.current = null;
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      ref={containerRef}
      onDoubleClick={handleDoubleClick}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onWheel={handleWheel}
      style={{ cursor: scale > MIN_SCALE ? (isPanning ? "grabbing" : "grab") : "default" }}
    >
      <video
        aria-label="Video stream"
        autoPlay
        className="h-full w-full object-contain select-none"
        muted
        playsInline
        ref={videoRef}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
      {connectionState !== "live" ? (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center text-xs font-medium text-white">
          {connectionState === "connecting" ? "Connecting to live stream..." : errorMessage}
        </div>
      ) : null}
    </div>
  );
}
