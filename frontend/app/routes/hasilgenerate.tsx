import type { Route } from "./+types/hasilgenerate";
import HasilGenerate from "../pages/export/hasilgenerate"; // default import sesuai file

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Hasil Generate - StoryCanvas" },
    { name: "description", content: "Lihat hasil generate dari onboarding kamu." },
  ];
}

export default function IndexRoute() {
  return <HasilGenerate />;
}
