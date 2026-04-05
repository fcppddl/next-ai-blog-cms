"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-indigo-600" />,
        info: <InfoIcon className="size-4 text-blue-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-red-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-gray-400" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "bg-white border border-gray-200 shadow-lg rounded-xl text-gray-900 text-sm font-medium",
          title: "text-gray-900 font-semibold text-sm",
          description: "text-gray-500 text-xs mt-0.5",
          actionButton: "bg-indigo-600 text-white text-xs rounded-lg px-3 py-1.5 font-medium",
          cancelButton: "bg-gray-100 text-gray-600 text-xs rounded-lg px-3 py-1.5 font-medium",
          closeButton: "text-gray-400 hover:text-gray-600",
          success: "border-l-4 border-l-indigo-500",
          error: "border-l-4 border-l-red-500",
          warning: "border-l-4 border-l-amber-500",
          info: "border-l-4 border-l-blue-500",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
