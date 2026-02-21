import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "blue" | "amber" | "green" | "red" | "gray";
}

const colorClasses = {
  blue: "border-blue-500/20 bg-blue-500/5",
  amber: "border-amber-500/20 bg-amber-500/5",
  green: "border-green-500/20 bg-green-500/5",
  red: "border-red-500/20 bg-red-500/5",
  gray: "border-gray-700 bg-gray-800/50",
};

const valueColorClasses = {
  blue: "text-blue-400",
  amber: "text-amber-400",
  green: "text-green-400",
  red: "text-red-400",
  gray: "text-gray-300",
};

export function StatCard({ label, value, icon, color = "gray" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02]",
        colorClasses[color]
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
        {icon && <span className="text-gray-600">{icon}</span>}
      </div>
      <p className={cn("text-2xl font-bold mt-2", valueColorClasses[color])}>
        {value}
      </p>
    </div>
  );
}
