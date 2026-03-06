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
  gray: "border-card-border bg-card",
};

const valueColorClasses = {
  blue: "text-cl-blue-light",
  amber: "text-cl-yellow",
  green: "text-cl-green",
  red: "text-red-400",
  gray: "text-foreground",
};

const iconColorClasses = {
  blue: "text-cl-blue-light/60",
  amber: "text-cl-yellow/60",
  green: "text-cl-green/60",
  red: "text-red-400/60",
  gray: "text-muted",
};

export function StatCard({ label, value, icon, color = "gray" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 card-shadow transition-all duration-200 hover:brightness-105",
        colorClasses[color]
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">{label}</p>
        {icon && <span className={iconColorClasses[color]}>{icon}</span>}
      </div>
      <p className={cn("text-2xl font-bold", valueColorClasses[color])}>
        {value}
      </p>
    </div>
  );
}
