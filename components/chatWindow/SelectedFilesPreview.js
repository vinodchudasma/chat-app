export default function SelectedFilesPreview({
  selectedFiles,
  onRemoveFile,
  onRemoveAllFiles
}) {
  if (selectedFiles.length === 0) return null;

  return (
    <></>
    // <div className="selected-files-preview bg-gray-50 border-t border-gray-200 p-4">
    //   <div className="flex items-center justify-between mb-3">
    //     <h4 className="font-medium text-gray-700">
    //       {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
    //     </h4>
    //     <button
    //       onClick={onRemoveAllFiles}
    //       className="text-sm text-red-600 hover:text-red-700 cursor-pointer"
    //     >
    //       Remove all
    //     </button>
    //   </div>
    //   <div className="flex flex-wrap gap-2">
    //     {selectedFiles.map((file, index) => (
    //       <div key={`file-${index}-${file.name}`} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
    //         <span className="text-sm text-gray-600 truncate max-w-xs">
    //           {file.name}
    //         </span>
    //         <button
    //           onClick={() => onRemoveFile(index)}
    //           className="text-red-500 hover:text-red-700 cursor-pointer"
    //         >
    //           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    //             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    //           </svg>
    //         </button>
    //       </div>
    //     ))}
    //   </div>
    // </div>
  );
}