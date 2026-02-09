import { useState } from 'react';

export default function AISettings() {
  const [settings, setSettings] = useState({
    typingPredictions: true,
    autoTranslate: false,
    targetLanguage: 'en',
    translationProvider: 'google' // 'google', 'deepl', 'azure'
  });

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' }
  ];

  const handleSettingChange = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // Save to localStorage or backend
    localStorage.setItem('aiChatSettings', JSON.stringify(newSettings));
  };

  return (
    <div className="ai-settings space-y-6">
      <div className="setting-group">
        <h3 className="text-lg font-medium text-gray-900 mb-4">AI Features</h3>
        
        {/* Typing Predictions */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Smart Typing Predictions
            </label>
            <p className="text-sm text-gray-500">
              Get AI suggestions as you type
            </p>
          </div>
          <button
            onClick={() => handleSettingChange('typingPredictions', !settings.typingPredictions)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              settings.typingPredictions ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.typingPredictions ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto Translate */}
        <div className="flex items-center justify-between py-3">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Auto-Translate Messages
            </label>
            <p className="text-sm text-gray-500">
              Automatically translate incoming messages
            </p>
          </div>
          <button
            onClick={() => handleSettingChange('autoTranslate', !settings.autoTranslate)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              settings.autoTranslate ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                settings.autoTranslate ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Target Language */}
        <div className="py-3">
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Translation Language
          </label>
          <select
            value={settings.targetLanguage}
            onChange={(e) => handleSettingChange('targetLanguage', e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md cursor-pointer"
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}