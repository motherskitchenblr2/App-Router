import { createFileRoute } from "@tanstack/react-router";
import { DeviceAdviser } from "@/components/device-adviser/device-adviser";

function DeviceAdviserPage() {
  return <DeviceAdviser />;
}

export const Route = createFileRoute("/_app/device-adviser")({ component: DeviceAdviserPage });