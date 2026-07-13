import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Matrix Field",
    short_name: "Matrix Field",
    description:
      "Matrix mobile technician workspace for assigned work and offline field service.",
    start_url: "/field",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#0891b2",
    orientation: "any",
    icons: [
      {
        src: "/icons/field-icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/field-icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
