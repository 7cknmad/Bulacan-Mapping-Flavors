import { cn } from "../../utils/cn";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export function Alert({ className, variant = 'default', ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-lg border p-4",
        variant === 'destructive' && "border-destructive/50 text-destructive dark:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />;
}