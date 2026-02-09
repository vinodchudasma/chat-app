export default function DeleteDialog({
  showDeleteDialog,
  selectedMessage,
  deleteType,
  onClose,
  onDelete
}) {
  if (!showDeleteDialog || !selectedMessage) return null;

  return (
    <div className="fixed inset-0 bg-opacity-10 backdrop-blur-sm transition-all flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Delete Message
          </h3>
          <p className="text-gray-600 mb-6">
            {deleteType === 'for-everyone'
              ? 'This message will be deleted for everyone. This action cannot be undone.'
              : 'This message will be deleted only for you. Other people in the chat will still be able to see it.'
            }
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => onDelete(selectedMessage, deleteType)}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}