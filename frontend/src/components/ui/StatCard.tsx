import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "blue" | "amber" | "green" | "red" | "gray";
}

const colorClasses = {
  blue: "border-cl-blue/20 bg-cl-blue/5",
  amber: "border-cl-yellow/20 bg-cl-yellow/5",
  green: "border-cl-green/20 bg-cl-green/5",
  red: "border-red-500/20 bg-red-500/5",
  gray: "border-gray-700 bg-gray-800/50",
};

const valueColorClasses = {
  blue: "text-cl-blue-light",
  amber: "text-cl-yellow",
  green: "text-cl-green",
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
