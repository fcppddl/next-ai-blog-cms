import { toast as sonnerToast } from "sonner";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success" | "warning";
}

export function useToast() {
  const toast = ({ title, description, variant }: ToastOptions) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
    } else if (variant === "warning") {
      sonnerToast.warning(title, { description });
    } else {
      sonnerToast.success(title, { description });
    }
  };

  return { toast };
}
