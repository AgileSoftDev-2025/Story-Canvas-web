import type { Route } from "./+types/export";
import ExportPage from "../pages/export/export";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "" },
    { name: "", content: "" },
  ];
}

export default function ExportRoute() {
  return < ExportPage />;
}
