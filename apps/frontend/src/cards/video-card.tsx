import { Schema } from "effect";
import { useEffect, useRef, useState } from "react";

import { makeCard } from "@/lib/cards";
import { CameraField } from "@/lib/dashboard-field-types";
import { FormTitleAnnotationId } from "@/lib/form";
import { mediaMtxWebRtcBaseUrl } from "@/lib/media-mtx/atom";

type ConnectionState = "connecting" | "live" | "error";

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

function WebRtcVideo({ camera, url }: { camera: string | undefined; url: string | undefined }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const peer = new RTCPeerConnection();
    let sessionUrl: string | null = null;

    setConnectionState("connecting");
    setErrorMessage(null);

    peer.addTransceiver("video", { direction: "recvonly" });
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        setConnectionState("error");
        setErrorMessage("Video stream connection dropped.");
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
      setConnectionState("live");
    };

    void (async () => {
      try {
        const whepUrl = resolveVideoSource(camera, url);
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

        setConnectionState("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to connect to video stream.",
        );
      }
    })();

    return () => {
      abortController.abort();

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
  }, [camera, url]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        aria-label="Video stream"
        autoPlay
        className="h-full w-full object-contain"
        muted
        playsInline
        ref={videoRef}
      />
      {connectionState !== "live" ? (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center text-xs font-medium text-white">
          {connectionState === "error" ? errorMessage : "Connecting to live stream..."}
        </div>
      ) : null}
    </div>
  );
}
