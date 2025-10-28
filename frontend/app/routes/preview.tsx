import type { Route } from "./+types/preview";
import PreviewFinal from "../pages/projects/preview";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Preview & Export | Story Canvas" }, { name: "description", content: "Preview user stories, wireframes, and test scenarios before exporting the full project documentation." }];
}

export default function PreviewRoute() {
  return <PreviewFinal />;
}
