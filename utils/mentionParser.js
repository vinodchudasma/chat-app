export const parseMentions = (text, users = []) => {
  if (!text) return { parsedText: "", mentions: [] };

  const mentionRegex = /@(\w+)/g;
  const mentions = [];
  let parsedText = text;

  // Find all @mentions in the text
  const matches = [...text.matchAll(mentionRegex)];

  matches.forEach((match) => {
    const mentionText = match[0]; // Full mention like "@john"
    const username = match[1]; // Just "john"

    // Find the user
    const user = users.find(
      (u) =>
        u.username?.toLowerCase() === username.toLowerCase() ||
        u.first_name?.toLowerCase() === username.toLowerCase() ||
        `${u.first_name}${u.last_name || ""}`
          .toLowerCase()
          .replace(/\s+/g, "") === username.toLowerCase(),
    );

    if (user) {
      mentions.push({
        userId: user._id,
        username: user.username || user.first_name,
        fullName: `${user.first_name} ${user.last_name || ""}`.trim(),
        position: match.index,
        length: mentionText.length,
      });

      // Replace with a span for display
      const span = `<span class="mention-user bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium cursor-pointer" data-user-id="${user._id}" title="${user.first_name}">@${user.first_name}</span>`;
      parsedText = parsedText.replace(mentionText, span);
    }
  });

  return { parsedText, mentions };
};

export const extractMentionUsernames = (text) => {
  if (!text) return [];

  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];
  return matches.map((match) => match[1].toLowerCase());
};

export const formatMessageWithMentions = (message, users = []) => {
  if (!message) return message;

  let formattedMessage = message;
  const mentionRegex = /@(\w+)/g;
  const matches = [...message.matchAll(mentionRegex)];

  matches.reverse().forEach((match) => {
    const mentionText = match[0];
    const username = match[1].toLowerCase();

    const user = users.find(
      (u) =>
        u.username?.toLowerCase() === username ||
        u.first_name?.toLowerCase() === username ||
        `${u.first_name}${u.last_name || ""}`
          .toLowerCase()
          .replace(/\s+/g, "") === username,
    );

    if (user) {
      const span = `<span class="mention-user bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-medium" data-user-id="${user._id}">@${user.first_name}</span>`;
      formattedMessage = formattedMessage.replace(mentionText, span);
    }
  });

  return formattedMessage;
};
