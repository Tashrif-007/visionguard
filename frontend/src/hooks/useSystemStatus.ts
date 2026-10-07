import { useQuery } from "@tanstack/react-query";
import * as systemApi from "@/api/systemApi";

export function useSystemStatus() {
  return useQuery({
    queryKey: ["system", "status"],
    queryFn: systemApi.getSystemStatus,
    refetchInterval: 5000,
  });
}
