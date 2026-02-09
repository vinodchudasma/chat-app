export default function StickerMenu({
  showStickerMenu,
  stickerMenuRef,
  onSetShowStickerMenu,
  onAddSticker,
  stickers
}) {
  return (
    <div className="relative" ref={stickerMenuRef}>
      <button
        type="button"
        onClick={() => onSetShowStickerMenu(!showStickerMenu)}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
      >
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      </button>

      {showStickerMenu && (
        <div className="absolute bottom-full left-0 mb-2 bg-white shadow-xl rounded-lg border border-gray-200 z-40 w-64 max-h-60 overflow-y-auto">
          <div className="p-3">
            <div className="grid grid-cols-6 gap-1">
              {stickers.map((sticker, index) => (
                <button
                  key={`sticker-${index}`}
                  type="button"
                  onClick={() => onAddSticker(sticker)}
                  className="text-2xl hover:bg-gray-100 rounded p-1 cursor-pointer transition-colors"
                >
                  {sticker}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}