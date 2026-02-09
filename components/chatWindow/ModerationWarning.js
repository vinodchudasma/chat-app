'use client';

import { useState } from 'react';

export default function ModerationWarning({
  show,
  reasons,
  warningLevel,
  onConfirmSend,
  onCancel,
  messageContent
}) {
  const [understandRisk, setUnderstandRisk] = useState(false);

  if (!show) return null;

  const isHighWarning = warningLevel === 'high';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          {/* Header */}
          <div className={`flex items-center gap-3 mb-4 p-3 rounded-lg ${
            isHighWarning ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className={`p-2 rounded-full ${
              isHighWarning ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className={`font-semibold ${
                isHighWarning ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {isHighWarning ? 'Content Warning' : 'Moderation Alert'}
              </h3>
              <p className={`text-sm ${
                isHighWarning ? 'text-red-600' : 'text-yellow-600'
              }`}>
                {isHighWarning 
                  ? 'This message contains potentially harmful content' 
                  : 'Please review your message before sending'
                }
              </p>
            </div>
          </div>

          {/* Reasons */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Issues detected:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          </div>

          {/* Message Preview */}
          {messageContent && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Message preview:</h4>
              <p className="text-sm text-gray-600 italic">"{messageContent}"</p>
            </div>
          )}

          {/* Warning for high level */}
          {isHighWarning && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> Sending this type of content may violate our community guidelines and could result in restrictions.
              </p>
            </div>
          )}

          {/* Confirmation for high warning */}
          {isHighWarning && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                id="understand-risk"
                checked={understandRisk}
                onChange={(e) => setUnderstandRisk(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <label htmlFor="understand-risk" className="text-sm text-gray-700">
                I understand the risks and want to send this message anyway
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmSend}
              disabled={isHighWarning && !understandRisk}
              className={`px-4 py-2 text-sm text-white rounded-lg transition-colors cursor-pointer ${
                isHighWarning
                  ? 'bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              }`}
            >
              Send Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}