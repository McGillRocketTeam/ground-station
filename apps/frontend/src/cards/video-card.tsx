import { Schema } from "effect";

import { makeCard } from "@/lib/cards";
import { FormTitleAnnotationId } from "@/lib/form";

export const VideoCard = makeCard({
  id: "video-card",
  name: "Video Card",
  schema: Schema.Struct({
    url: Schema.String.pipe(Schema.annotate({ [FormTitleAnnotationId]: "Video URL" })),
  }),
  component: (props) => <video aria-label="Video stream" src={props.params.url} />,
});
