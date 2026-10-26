import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PlannerPal",
    short_name: "PlannerPal",
    description: "Je persoonlijke werkdag, mail en agenda.",
    lang: "nl",
    start_url: "/assistant",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f2",
    theme_color: "#28624c",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
