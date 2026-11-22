import Image, { type ImageLoader } from "next/image";
import { pictures, type PictureKey } from "@/data/workshops/pictures";
import styles from "./workshops.module.css";

// Two ready-made widths, so no image service is needed.
const load: ImageLoader = ({ src, width }) => `/media/workshops/${src}-${width <= 640 ? 640 : 1280}.webp`;

/** A decorative photo that fills its frame. The colour behind it shows while it loads, or if it never does. */
export function Picture({ name, sizes, eager = false }: { name: PictureKey; sizes: string; eager?: boolean }) {
  return <span className={styles.picture} style={{ backgroundColor: pictures[name].tone }} aria-hidden="true">
    <Image key={name} loader={load} src={name} alt="" fill sizes={sizes} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} draggable={false}
      onError={event => { event.currentTarget.style.visibility = "hidden"; }} />
  </span>;
}
