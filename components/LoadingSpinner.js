export default function LoadingSpinner({ size = 'medium' }) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className="flex items-center justify-center">
      <div 
        className={`
          ${sizeClasses[size]} 
          border-4 border-primary-200 border-t-primary-600 
          rounded-full animate-spin
        `}
      />
    </div>
  );
}