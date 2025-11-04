import type { Route } from "./+types/userstory";
import UserStoryScenarioEdit from "../pages/scenarios/userstoryscenario-edit";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Story" },
    { name: "description", content: "User Story page" },
  ];
}

export default function UserStoryScenarioEditRoute() {
  return <UserStoryScenarioEdit />;
}

