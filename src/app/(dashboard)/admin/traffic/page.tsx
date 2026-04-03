import { getTrafficData } from "@/lib/admin-traffic-data";
import { TrafficDashboard } from "@/components/admin/traffic-dashboard";

export const metadata = { title: "Traffic" };

export default async function TrafficPage() {
  const data = await getTrafficData();
  return <TrafficDashboard data={data} />;
}
