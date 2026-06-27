import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMealImageUrl } from "@/lib/meals.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera } from "lucide-react";

export function MealImage({ path }: { path: string | null }) {
  const fetchUrl = useServerFn(getMealImageUrl);
  const { data } = useQuery({
    queryKey: ["meal-image", path],
    queryFn: () => fetchUrl({ data: { path: path! } }),
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
  if (!path) {
    return (
      <div className="grid aspect-square place-items-center bg-secondary text-muted-foreground">
        <Camera className="h-6 w-6" />
      </div>
    );
  }
  return data ? (
    <img src={data} alt="Meal" className="aspect-square w-full object-cover" loading="lazy" />
  ) : (
    <Skeleton className="aspect-square w-full" />
  );
}
