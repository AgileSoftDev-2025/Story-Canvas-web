import type { Route } from "./+types/userstory";
import UserStoryScenario from "../pages/scenarios/userstoryscenario";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "User Story" },
    { name: "description", content: "User Story page" },
  ];
}

export default function UserStoryScenarioRoute() {
  return <UserStoryScenario />;
}

