import { X } from "lucide-react";

const ErrorAlert = (message, onClose) => {
  if (!message) return null;

  return (
    <div className="flex items-start justify-between gap-2 text-red-200 text-xs p-2 mb-2 bg-red-500/20 rounded">
      <span className="flex-1">{message}</span>

      <button
        onClick={onClose}
        className="text-red-200 hover:text-white transition"
        aria-label="Close error"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default ErrorAlert;
