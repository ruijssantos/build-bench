import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bench & Build",
    short_name: "Bench & Build",
    description:
      "Thinner ratios, paint inventory, kit research and build logs for 1:24 scale model cars.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f2e9",
    theme_color: "#f6f2e9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
