"use client";

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "luca_voss_msgs";

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveMsgs(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Last assistant message variants for regenerate
  const [variants, setVariants] = useState([]); // array of {text, time}
  const [variantIndex, setVariantIndex] = useState(0);
  const bottomRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => { setMessages(loadSaved()); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, variants, variantIndex]);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 6000); return () => clearTimeout(t); }
  }, [error]);

  // The displayed messages — replace last assistant msg with current variant if variants exist
  function getDisplayMessages() {
    if (variants.length === 0) return messages;
    // Replace the last assistant message with the current variant
    const copy = [...messages];
    for (let i = copy.length - 1; i >= 0; i--) {
      if (copy[i].role === "assistant") {
        copy[i] = { ...copy[i], ...variants[variantIndex] };
        break;
      }
    }
    return copy;
  }

  async function fetchReply(history) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (data.reply) return data.reply;
    throw new Error(data.error || "No response.");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    // If variants exist, commit the current variant into messages before adding new user msg
    let base = messages;
    if (variants.length > 0) {
      base = getDisplayMessages();
      saveMsgs(base);
    }

    setVariants([]);
    setVariantIndex(0);

    const userMsg = { role: "user", text, time: getTime() };
    const next = [...base, userMsg];
    setMessages(next);
    saveMsgs(next);
    setLoading(true);
    setError(null);

    try {
      const reply = await fetchReply(next);
      const assistantMsg = { role: "assistant", text: reply, time: getTime() };
      const final = [...next, assistantMsg];
      setMessages(final);
      saveMsgs(final);
      setVariants([{ text: reply, time: assistantMsg.time }]);
      setVariantIndex(0);
    } catch (e) {
      setError(e.message || "Connection error. Try again.");
    }

    setLoading(false);
    taRef.current?.focus();
  }

  async function regenerate() {
    if (loading) return;
    setLoading(true);
    setError(null);

    // Build history without the last assistant message
    const historyWithoutLast = [...messages];
    for (let i = historyWithoutLast.length - 1; i >= 0; i--) {
      if (historyWithoutLast[i].role === "assistant") {
        historyWithoutLast.splice(i, 1);
        break;
      }
    }

    try {
      const reply = await fetchReply(historyWithoutLast);
      const newVariant = { text: reply, time: getTime() };
      const newVariants = [...variants, newVariant];
      setVariants(newVariants);
      setVariantIndex(newVariants.length - 1);
    } catch (e) {
      setError(e.message || "Connection error. Try again.");
    }

    setLoading(false);
    taRef.current?.focus();
  }

  function prevVariant() {
    setVariantIndex(i => Math.max(0, i - 1));
  }

  function nextVariant() {
    setVariantIndex(i => Math.min(variants.length - 1, i + 1));
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function autoResize(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  }

  function clearChat() {
    if (!confirm("Clear this conversation?")) return;
    setMessages([]);
    setVariants([]);
    setVariantIndex(0);
    localStorage.removeItem(STORAGE_KEY);
  }

  const isLuca = r => r === "assistant";
  const displayMessages = getDisplayMessages();
  const hasVariants = variants.length > 1;
  const showRegenerateBar = variants.length > 0 && !loading;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:"#f0ebe3", fontFamily:"Georgia,serif", maxWidth:640, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ padding:"14px 20px", borderBottom:"1px solid #ddd6cc", display:"flex", alignItems:"center", gap:14, background:"#f0ebe3", flexShrink:0 }}>
        <div style={{ position:"relative", flexShrink:0 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#2c2520,#1a1714)", display:"flex", alignItems:"center", justifyContent:"center", fontStyle:"italic", fontSize:17, color:"#f0ebe3" }}>L</div>
          <div style={{ position:"absolute", bottom:0, right:0, width:10, height:10, borderRadius:"50%", background:"#7a9e7e", border:"2px solid #f0ebe3" }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontStyle:"italic", fontSize:18, color:"#1a1714", lineHeight:1 }}>Luca Voss</div>
          <div style={{ fontSize:10, color:"#8a8178", letterSpacing:"0.09em", textTransform:"uppercase", marginTop:3, fontFamily:"monospace" }}>painter · east london</div>
        </div>
        <button onClick={clearChat} style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.06em", textTransform:"uppercase", color:"#8a8178", background:"none", border:"1px solid #ddd6cc", padding:"4px 9px", cursor:"pointer", borderRadius:2 }}>
          clear
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"24px 18px", display:"flex", flexDirection:"column", gap:18 }}>

        {displayMessages.length === 0 && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, textAlign:"center", padding:40 }}>
            <div style={{ fontStyle:"italic", fontSize:34, color:"#1a1714", opacity:0.15, letterSpacing:"0.06em" }}>Luca Voss</div>
            <div style={{ fontSize:10, color:"#8a8178", letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"monospace" }}>say something. he might respond.</div>
          </div>
        )}

        {displayMessages.map((msg, i) => {
          const isLastAssistant = isLuca(msg.role) && i === displayMessages.length - 1;
          return (
            <div key={i} style={{ display:"flex", flexDirection:"column", alignSelf: isLuca(msg.role) ? "flex-start" : "flex-end", alignItems: isLuca(msg.role) ? "flex-start" : "flex-end", maxWidth:"80%" }}>
              <div style={{ fontSize:9, letterSpacing:"0.1em", textTransform:"uppercase", color:"#8a8178", marginBottom:4, fontFamily:"monospace" }}>
                {isLuca(msg.role) ? "Luca" : "Jayda"}
              </div>
              <div style={{
                padding:"11px 15px",
                background: isLuca(msg.role) ? "#ffffff" : "#1a1714",
                color: isLuca(msg.role) ? "#1a1714" : "#f0ebe3",
                border: isLuca(msg.role) ? "1px solid #ddd6cc" : "none",
                borderRadius:2,
                borderTopLeftRadius: isLuca(msg.role) ? 0 : 2,
                borderTopRightRadius: isLuca(msg.role) ? 2 : 0,
                fontFamily: isLuca(msg.role) ? "Georgia,serif" : "monospace",
                fontSize: isLuca(msg.role) ? 15 : 12,
                lineHeight:1.7,
                boxShadow: isLuca(msg.role) ? "2px 2px 10px rgba(26,23,20,0.09)" : "none",
                whiteSpace:"pre-wrap", wordBreak:"break-word",
              }}>{msg.text}</div>

              {/* Regenerate controls — only on last Luca message */}
              {isLastAssistant && showRegenerateBar && (
                <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:6 }}>
                  {hasVariants && (
                    <button onClick={prevVariant} disabled={variantIndex === 0} style={{ background:"none", border:"none", cursor: variantIndex === 0 ? "not-allowed" : "pointer", color: variantIndex === 0 ? "#ccc5bc" : "#8a8178", fontSize:14, padding:"0 2px", lineHeight:1 }}>‹</button>
                  )}
                  <button onClick={regenerate} disabled={loading} style={{ fontFamily:"monospace", fontSize:9, letterSpacing:"0.07em", textTransform:"uppercase", color:"#8a8178", background:"none", border:"1px solid #ddd6cc", padding:"3px 8px", cursor: loading ? "not-allowed" : "pointer", borderRadius:2 }}>
                    regenerate
                  </button>
                  {hasVariants && (
                    <button onClick={nextVariant} disabled={variantIndex === variants.length - 1} style={{ background:"none", border:"none", cursor: variantIndex === variants.length - 1 ? "not-allowed" : "pointer", color: variantIndex === variants.length - 1 ? "#ccc5bc" : "#8a8178", fontSize:14, padding:"0 2px", lineHeight:1 }}>›</button>
                  )}
                  {hasVariants && (
                    <span style={{ fontSize:9, color:"#8a8178", fontFamily:"monospace", letterSpacing:"0.05em" }}>{variantIndex + 1}/{variants.length}</span>
                  )}
                </div>
              )}

              <div style={{ fontSize:9, color:"#8a8178", marginTop:4, letterSpacing:"0.06em", fontFamily:"monospace" }}>{msg.time}</div>
            </div>
          );
        })}

        {loading && (
          <div style={{ alignSelf:"flex-start", display:"flex", alignItems:"center", gap:5, padding:"13px 16px", background:"#ffffff", border:"1px solid #ddd6cc", borderRadius:2, borderTopLeftRadius:0, boxShadow:"2px 2px 10px rgba(26,23,20,0.09)" }}>
            <style>{`@keyframes blink{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-5px);opacity:1}}`}</style>
            {[0,0.2,0.4].map((d,i) => (
              <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:"#8a8178", animation:`blink 1.2s ${d}s infinite ease-in-out` }} />
            ))}
          </div>
        )}

        {error && (
          <div style={{ fontSize:11, color:"#b85c38", fontFamily:"Georgia,serif", fontStyle:"italic", textAlign:"center", padding:"4px 0" }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"14px 16px 20px", borderTop:"1px solid #ddd6cc", background:"#f0ebe3", flexShrink:0 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end", background:"#fff", border:"1px solid #ddd6cc", borderRadius:2, padding:"9px 13px", boxShadow:"0 2px 8px rgba(26,23,20,0.07)" }}>
          <textarea
            ref={taRef} value={input}
            onChange={e => { setInput(e.target.value); autoResize(e); }}
            onKeyDown={handleKey}
            placeholder="say something..."
            rows={1}
            style={{ flex:1, background:"none", border:"none", outline:"none", resize:"none", fontFamily:"monospace", fontSize:12.5, color:"#1a1714", lineHeight:1.6, maxHeight:120, letterSpacing:"0.02em" }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{ background: loading||!input.trim() ? "#e2dbd2" : "#1a1714", border:"none", color:"#f0ebe3", width:30, height:30, borderRadius:2, cursor: loading||!input.trim() ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.2s" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div style={{ fontSize:9, color:"#8a8178", letterSpacing:"0.06em", textAlign:"center", marginTop:7, textTransform:"uppercase", fontFamily:"monospace" }}>
          enter to send · shift+enter for new line
        </div>
      </div>

    </div>
  );
}
