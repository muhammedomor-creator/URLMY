"use client";
import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { nanoid } from "nanoid";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function Home() {
  const [url, setUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      const path = window.location.pathname.replace("/", "");
      if (path && path !== "") {
        setIsRedirecting(true);
        try {
          const docRef = doc(db, "links", path.toLowerCase());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            window.location.href = docSnap.data().originalUrl;
          } else {
            setError("৪৪৪ - এই ছোট লিংকটি ডাটাবেজে পাওয়া যায়নি!");
            setIsRedirecting(false);
          }
        } catch (err) {
          setError("ডাটাবেজ কানেকশনে সমস্যা হয়েছে।");
          setIsRedirecting(false);
        }
      }
    };
    handleRedirect();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setLoading(true);

    try {
      let slug = customSlug ? customSlug.trim().toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '') : nanoid(5);

      if (customSlug && slug.length === 0) {
        setError("কাস্টম নামটি সঠিক নয়!");
        setLoading(false);
        return;
      }

      const docRef = doc(db, "links", slug);
      const docSnap = await getDoc(docRef);

      if (customSlug && docSnap.exists()) {
        setError("এই নামটি ইতিমধ্যে ব্যবহার করা হয়েছে! অন্য নাম দিন।");
        setLoading(false);
        return;
      }

      await setDoc(doc(db, "links", slug), {
        originalUrl: url,
        createdAt: new Date().toISOString(),
      });

      setShortUrl(`${window.location.origin}/${slug}`);
      setUrl("");
      setCustomSlug("");
    } catch (err) {
      setError("লিংক তৈরি করতে সমস্যা হয়েছে। ফায়ারবেস সেটিংস চেক করুন।");
    } finally {
      setLoading(false);
    }
  };

  if (isRedirecting) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px", fontFamily: "sans-serif" }}>
        <h2>🔄 মূল ওয়েবসাইটে নিয়ে যাওয়া হচ্ছে...</h2>
        <p>অনুগ্রহ করে একটু অপেক্ষা করুন।</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "450px", margin: "40px auto", padding: "20px", fontFamily: "system-ui, sans-serif", borderRadius: "12px", backgroundColor: "#fff", boxSizing: "border-box", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
      <h2 style={{ textAlign: "center", color: "#222", marginBottom: "20px" }}>🔗 কাস্টম ইউআরএল শর্টনার</h2>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>বড় লিংকটি দিন:</label>
          <input
            type="url"
            placeholder="https://example.com/long-link..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "16px", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", fontSize: "14px" }}>কাস্টম নাম (ঐচ্ছিক):</label>
          <input
            type="text"
            placeholder="যেমন: my-fb"
            value={customSlug}
            onChange={(e) => setCustomSlug(e.target.value)}
            style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "16px", boxSizing: "border-box" }}
          />
        </div>

        <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", backgroundColor: "#0070f3", color: "white", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: "bold", cursor: "pointer" }}>
          {loading ? "তৈরি হচ্ছে..." : "লিংক ছোট করুন ✨"}
        </button>
      </form>

      {shortUrl && (
        <div style={{ marginTop: "20px", padding: "15px", backgroundColor: "#e6f7ff", border: "1px solid #91d5ff", borderRadius: "8px" }}>
          <p style={{ margin: "0 0 5px 0", color: "#0050b3", fontWeight: "600" }}>🎉 আপনার ছোট লিংক তৈরি হয়েছে:</p>
          <a href={shortUrl} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", color: "#1890ff", fontWeight: "bold", textDecoration: "none" }}>{shortUrl}</a>
        </div>
      )}

      {error && (
        <p style={{ color: "#ff4d4f", marginTop: "15px", textAlign: "center", fontWeight: "500" }}>⚠️ {error}</p>
      )}
    </div>
  );
}
