import React, { useState } from "react";
import { chatAPI } from "../lib/api";

const InviteFriend = ({ onInviteSent }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleInvite = async (e) => {
    e.preventDefault();

    if (!email) {
      setMessage("Please enter an email address");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const response = await chatAPI.sendInvitation(email);

      if (response.data.success) {
        setMessage(`Invitation sent successfully to ${email}`);
        setEmail("");
        if (onInviteSent) {
          onInviteSent(response.data.friend);
        }
      } else {
        setMessage("Failed to send invitation");
      }
    } catch (error) {
      console.error("Invitation error:", error);
      setMessage(error.response?.data?.message || "Failed to send invitation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invite-friend">
      <h3>Invite Friend</h3>
      <form onSubmit={handleInvite} className="invite-form">
        <div className="form-group">
          <input
            type="email"
            placeholder="Enter friend's email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="email-input"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="invite-button cursor-pointer"
        >
          {loading ? "Sending..." : "Send Invitation"}
        </button>
      </form>
      {message && (
        <div
          className={`message ${message.includes("successfully") ? "success" : "error"}`}
        >
          {message}
        </div>
      )}

      <style jsx>{`
        .invite-friend {
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          margin-bottom: 20px;
          background: white;
        }

        .invite-friend h3 {
          margin: 0 0 15px 0;
          color: #333;
        }

        .invite-form {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        .form-group {
          flex: 1;
        }

        .email-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .invite-button {
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .invite-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .invite-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .message {
          margin-top: 10px;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
        }

        .message.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .message.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }
      `}</style>
    </div>
  );
};

export default InviteFriend;
