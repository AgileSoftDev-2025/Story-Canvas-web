// routes.ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("signin", "routes/signin.tsx"),
  route("signup", "routes/signup.tsx"),
  route("chat", "routes/chat.tsx"),
  route("history", "routes/history.tsx"),
  route("about", "routes/about.tsx"),
  route("edit-wireframe", "routes/editwireframe.tsx"),
  route("wireframe-generated", "routes/wireframegenerated.tsx"),
  route("user-stories", "routes/userstory.tsx"),
  route("user-stories-edit", "routes/userstory-edit.tsx"),
  route("history-detail", "routes/HistoryDetail.tsx"),
  route("preview-final", "routes/preview.tsx"),
  route("hasil-generate", "routes/hasilgenerate.tsx"),
] satisfies RouteConfig;