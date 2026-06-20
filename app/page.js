
"use client";
import { useState, useEffect } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "firebase/firestore";
import { nanoid } from "nanoid";

// ফায়ারবেস কনফিগারেশন
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
  // নেভিগেশন ও স্ক্রিন কন্ট্রোল
  const [currentScreen, setCurrentScreen] = useState("login"); // 'login' | 'register' | 'forgot' | 'verify' | 'reset_password' | 'dashboard'
  const [userPhone, setUserPhone] = useState("");
  
  // ফর্ম ইনপুট স্টেট
  const [phoneInput, setPhoneInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [resetPasswordInput, setResetPasswordInput] = useState("");
  
  // ইউআরএল শর্টনার স্টেট
  const [url, setUrl] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [linkNote, setLinkNote] = useState(""); 
  const [shortUrl, setShortUrl] = useState("");
  
  // ড্যাশবোর্ড ও হিস্টোরি স্টেট
  const [userLinks, setUserLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // ওটিপি ভেরিফিকেশন মেমোরি
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpPurpose, setOtpPurpose] = useState(""); 
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [tempNoteText, setTempNoteText] = useState("");

  // ১. সেশন এবং রিডাইরেকশন হ্যান্ডলিং
  useEffect(() => {
    const path = window.location.pathname.replace("/", "");
    
    if (path && path !== "") {
      setIsRedirecting(true);
      const handleRedirect = async () => {
        try {
          const docRef = doc(db, "links", path.toLowerCase());
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            window.location.href = docSnap.data().originalUrl;
          } else {
            setError("৪৪৪ - দুঃখিত, এই শর্ট লিংকটি খুঁজে পাওয়া যায়নি!");
            setIsRedirecting(false);
          }
        } catch (err) {
          setError("ডাটাবেজ কানেকশনে সমস্যা হয়েছে।");
          setIsRedirecting(false);
        }
      };
      handleRedirect();
    } else {
      const savedSession = localStorage.getItem("url_user_phone");
      if (savedSession) {
        setUserPhone(savedSession);
        setCurrentScreen("dashboard");
        fetchUserLinks(savedSession);
      }
    }
  }, []);

  // ২. ফোন নম্বর স্ট্যান্ডার্ডাইজেশন (১০১% নিখুঁত ফরম্যাটিং)
  // এটি যেকোনো ফরম্যাট থেকে ১১ ডিজিটের স্ট্যান্ডার্ড '01XXXXXXXXX' বের করবে
  const cleanBDPhone = (phone) => {
    let cleaned = phone.replace(/\D/g, ""); // সব নন-ডিজিট ক্যারেক্টার মুছে ফেলা
    
    // যদি নম্বরটি ৮৮০ দিয়ে শুরু হয় এবং মোট ১৩ ডিজিট হয়
    if (cleaned.startsWith("880") && cleaned.length === 13) {
      cleaned = cleaned.substring(2);
    }
    // যদি নম্বরটি ০ ছাড়া শুধু ১ দিয়ে শুরু হয় এবং ১০ ডিজিট হয়
    if (!cleaned.startsWith("0") && cleaned.length === 10) {
      cleaned = "0" + cleaned;
    }
    return cleaned;
  };

  // এপিআই-এর জন্য '8801XXXXXXXXX' ফরম্যাট জেনারেট করা
  const getOtpFormattedPhone = (phone) => {
    const standard = cleanBDPhone(phone);
    return "88" + standard;
  };

  // ৩. ড্যাশবোর্ড ডাটা লোড
  const fetchUserLinks = async (phone) => {
    try {
      const querySnapshot = await getDocs(collection(db, "links"));
      const allLinks = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.userId === phone) {
          allLinks.push({ id: doc.id, ...data });
        }
      });
      allLinks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUserLinks(allLinks);
    } catch (err) {
      console.error("হিস্টোরি লোড করা যায়নি:", err);
    }
  };

  // ৪. হোয়াটসঅ্যাপ এপিআই-এর মাধ্যমে ওটিপি পাঠানো (টেস্টারের লজিক অনুযায়ী)
  const sendWhatsAppOTP = async (targetPhone, code) => {
    try {
      // এপিআই-এর জন্য সঠিক ১৩ ডিজিট ফরম্যাট (যেমন: 8801572922663)
      const formattedPhone = getOtpFormattedPhone(targetPhone);
      
      console.log("Sending OTP to:", formattedPhone, "with code:", code);

      const response = await fetch("https://otp-api-hmrz.onrender.com/send-otp", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          otpCode: code
        })
      });

      return response.ok;
    } catch (err) {
      console.error("ওটিপি পাঠাতে সমস্যা হয়েছে:", err);
      return false;
    }
  };

  // মোবাইল নম্বর সঠিক কি না পরীক্ষা করা
  const isValidBDPhone = (phone) => {
    const standard = cleanBDPhone(phone);
    const regex = /^(01[3-9]\d{8})$/;
    return regex.test(standard);
  };

  // ৫. রেজিস্ট্রেশন সাবমিট ও ওটিপি ট্র্রিগার
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isValidBDPhone(phoneInput)) {
      setError("অনুগ্রহ করে একটি সঠিক বাংলাদেশী মোবাইল নম্বর দিন!");
      return;
    }

    if (passwordInput.length < 6) {
      setError("নিরাপত্তার স্বার্থে পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!");
      return;
    }

    if (passwordInput !== confirmPasswordInput) {
      setError("উভয় পাসওয়ার্ড হুবহু এক হতে হবে!");
      return;
    }

    setLoading(true);
    const standardizedPhone = cleanBDPhone(phoneInput);

    try {
      // ফায়ারস্টোরে স্ট্যান্ডার্ড নাম্বারে চেক করা হচ্ছে
      const userRef = doc(db, "users", standardizedPhone);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        setError("এই মোবাইল নম্বর দিয়ে ইতিমধ্যে আইডি খোলা হয়েছে!");
        setLoading(false);
        return;
      }

      // ৬ ডিজিটের ওটিপি তৈরি
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otpCode);
      setOtpPurpose("register");

      const otpSent = await sendWhatsAppOTP(standardizedPhone, otpCode);
      if (otpSent) {
        setSuccess("আপনার হোয়াটসঅ্যাপ নম্বরে ৬ ডিজিটের কোড পাঠানো হয়েছে।");
        setCurrentScreen("verify");
      } else {
        setError("ওটিপি পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার নম্বরটি ভালো করে চেক করুন।");
      }
    } catch (err) {
      setError("রেজিস্ট্রেশন প্রক্রিয়ায় সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // ৬. ওটিপি কোড ভেরিফিকেশন ও আইডি তৈরি সম্পন্ন করা
  const handleOtpVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (otpInput.trim() !== generatedOtp) {
      setError("ভুল ওটিপি কোড! অনুগ্রহ করে আপনার হোয়াটসঅ্যাপ চেক করুন।");
      return;
    }

    setLoading(true);
    const standardizedPhone = cleanBDPhone(phoneInput);

    try {
      if (otpPurpose === "register") {
        await setDoc(doc(db, "users", standardizedPhone), {
          phone: standardizedPhone,
          password: passwordInput,
          createdAt: new Date().toISOString()
        });

        localStorage.setItem("url_user_phone", standardizedPhone);
        setUserPhone(standardizedPhone);
        setSuccess("আপনার আইডি সফলভাবে তৈরি হয়েছে!");
        setCurrentScreen("dashboard");
        fetchUserLinks(standardizedPhone);
      } else if (otpPurpose === "forgot") {
        setCurrentScreen("reset_password");
      }
    } catch (err) {
      setError("অ্যাকাউন্ট ভেরিফিকেশন সম্পূর্ণ করা যায়নি।");
    } finally {
      setLoading(false);
    }
  };

  // ৭. লগইন হ্যান্ডলার
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const standardizedPhone = cleanBDPhone(phoneInput);

    try {
      const userRef = doc(db, "users", standardizedPhone);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists() || userSnap.data().password !== passwordInput) {
        setError("মোবাইল নম্বর অথবা পাসওয়ার্ডটি সঠিক নয়!");
        setLoading(false);
        return;
      }

      localStorage.setItem("url_user_phone", standardizedPhone);
      setUserPhone(standardizedPhone);
      setSuccess("সফলভাবে লগইন করা হয়েছে!");
      setCurrentScreen("dashboard");
      fetchUserLinks(standardizedPhone);
    } catch (err) {
      setError("লগইন করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // ৮. পাসওয়ার্ড ভুলে গেলে ওটিপি পাঠানো
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!isValidBDPhone(phoneInput)) {
      setError("অনুগ্রহ করে একটি সঠিক বাংলাদেশী মোবাইল নম্বর দিন!");
      return;
    }

    setLoading(true);
    const standardizedPhone = cleanBDPhone(phoneInput);

    try {
      const userRef = doc(db, "users", standardizedPhone);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("এই মোবাইল নম্বর দিয়ে কোনো আইডি তৈরি করা হয়নি!");
        setLoading(false);
        return;
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otpCode);
      setOtpPurpose("forgot");

      const otpSent = await sendWhatsAppOTP(standardizedPhone, otpCode);
      if (otpSent) {
        setSuccess("পাসওয়ার্ড রিসেট করার জন্য হোয়াটসঅ্যাপে কোড পাঠানো হয়েছে।");
        setCurrentScreen("verify");
      } else {
        setError("ওটিপি কোড পাঠাতে সমস্যা হয়েছে।");
      }
    } catch (err) {
      setError("সার্ভারে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  // ৯. নতুন পাসওয়ার্ড সেভ করা
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (resetPasswordInput.length < 6) {
      setError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে!");
      return;
    }

    setLoading(true);
    const standardizedPhone = cleanBDPhone(phoneInput);

    try {
      const userRef = doc(db, "users", standardizedPhone);
      await updateDoc(userRef, {
        password: resetPasswordInput
      });

      setSuccess("আপনার পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। লগইন করুন।");
      setPasswordInput("");
      setCurrentScreen("login");
    } catch (err) {
      setError("পাসওয়ার্ড পরিবর্তন করা যায়নি।");
    } finally {
      setLoading(false);
    }
  };

  // ১০. লিংক ছোট করা
  const handleCreateShortLink = async (e) => {
    e.preventDefault();
    setError("");
    setShortUrl("");
    setCopied(false);
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
        setError("এই নামটি ইতিমধ্যে অন্য কেউ নিয়েছে! অনুগ্রহ করে অন্য নাম দিন।");
        setLoading(false);
        return;
      }

      await setDoc(docRef, {
        originalUrl: url,
        userId: userPhone,
        title: linkNote.trim() || "কাস্টম লিংক",
        createdAt: new Date().toISOString(),
      });

      setShortUrl(`${window.location.origin}/${slug}`);
      setUrl("");
      setCustomSlug("");
      setLinkNote("");
      fetchUserLinks(userPhone);
    } catch (err) {
      setError("লিংক ছোট করতে সমস্যা হয়েছে। ডাটাবেজ চেক করুন।");
    } finally {
      setLoading(false);
    }
  };

  // ১১. সরাসরি নোট পরিবর্তন করা
  const handleUpdateNote = async (linkId) => {
    try {
      const docRef = doc(db, "links", linkId);
      await updateDoc(docRef, {
        title: tempNoteText.trim() || "কাস্টম লিংক"
      });
      setEditingNoteId(null);
      fetchUserLinks(userPhone);
    } catch (err) {
      setError("নোট পরিবর্তন করা যায়নি।");
    }
  };

  // ১২. লিংক ডিলিট
  const handleDeleteLink = async (linkId) => {
    if (confirm("আপনি কি নিশ্চিতভাবে এই শর্ট লিংকটি ডিলিট করতে চান?")) {
      try {
        await deleteDoc(doc(db, "links", linkId));
        fetchUserLinks(userPhone);
      } catch (err) {
        setError("লিংকটি ডিলিট করা সম্ভব হয়নি।");
      }
    }
  };

  // ১৩. কপি টু ক্লিপবোর্ড
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ১৪. লগআউট
  const handleLogout = () => {
    localStorage.removeItem("url_user_phone");
    setUserPhone("");
    setPhoneInput("");
    setPasswordInput("");
    setCurrentScreen("login");
    setUserLinks([]);
  };

  if (isRedirecting) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", backgroundColor: "#0f172a", color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ width: "50px", height: "50px", border: "5px solid #334155", borderTop: "5px solid #38bdf8", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
        <h2 style={{ marginTop: "24px", fontWeight: "600" }}>🔄 মূল ওয়েবসাইটে নিয়ে যাওয়া হচ্ছে...</h2>
        <p style={{ color: "#94a3b8", marginTop: "8px" }}>অনুগ্রহ করে একটু অপেক্ষা করুন।</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "system-ui, sans-serif", boxSizing: "border-box", color: "#f8fafc" }}>
      
      {/* লগইন স্ক্রিন */}
      {currentScreen === "login" && (
        <div style={{ maxWidth: "450px", width: "100%", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "32px", borderRadius: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "40px" }}>🔐</span>
            <h2 style={{ margin: "12px 0 6px 0", fontSize: "24px", fontWeight: "700" }}>লগইন করুন</h2>
            <p style={{ margin: "0", color: "#94a3b8", fontSize: "14px" }}>আপনার শর্ট লিংকগুলোর হিস্টোরি আজীবন সেভ রাখতে দয়া করে আইডি লগইন করুন।</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>মোবাইল নম্বর</label>
              <input
                type="text"
                placeholder="যেমন: 017XXXXXXXX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>পাসওয়ার্ড</label>
              <input
                type="password"
                placeholder="আপনার পাসওয়ার্ড দিন"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "13px" }}>
              <button type="button" onClick={() => setCurrentScreen("forgot")} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", padding: "0" }}>পাসওয়ার্ড ভুলে গেছেন?</button>
              <button type="button" onClick={() => { setCurrentScreen("register"); setPhoneInput(""); setPasswordInput(""); }} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", padding: "0" }}>নতুন আইডি তৈরি করুন</button>
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
              {loading ? "অপেক্ষা করুন..." : "লগইন করুন 🚀"}
            </button>
          </form>

          {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
        </div>
      )}

      {/* রেজিস্ট্রেশন স্ক্রিন */}
      {currentScreen === "register" && (
        <div style={{ maxWidth: "450px", width: "100%", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "32px", borderRadius: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "40px" }}>📱</span>
            <h2 style={{ margin: "12px 0 6px 0", fontSize: "24px", fontWeight: "700" }}>নতুন আইডি তৈরি করুন</h2>
            <p style={{ margin: "0", color: "#94a3b8", fontSize: "14px" }}>হোয়াটসঅ্যাপ ওটিপি-র মাধ্যমে ভেরিফিকেশন সম্পন্ন করুন।</p>
          </div>

          <form onSubmit={handleRegisterSubmit}>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>মোবাইল নম্বর (হোয়াটসঅ্যাপ সচল থাকতে হবে)</label>
              <input
                type="text"
                placeholder="যেমন: 017XXXXXXXX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষরের)</label>
              <input
                type="password"
                placeholder="একটি পাসওয়ার্ড সেট করুন"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>পাসওয়ার্ডটি পুনরায় দিন</label>
              <input
                type="password"
                placeholder="পাসওয়ার্ডটি নিশ্চিত করুন"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "600", cursor: "pointer", marginBottom: "16px" }}>
              {loading ? "কোড পাঠানো হচ্ছে..." : "কোড পাঠান (WhatsApp OTP) 💬"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button type="button" onClick={() => { setCurrentScreen("login"); setPhoneInput(""); setPasswordInput(""); }} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>ইতিমধ্যে আইডি আছে? লগইন করুন</button>
            </div>
          </form>

          {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
        </div>
      )}

      {/* ওটিপি ভেরিফিকেশন স্ক্রিন */}
      {currentScreen === "verify" && (
        <div style={{ maxWidth: "450px", width: "100%", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "32px", borderRadius: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "40px" }}>💬</span>
            <h2 style={{ margin: "12px 0 6px 0", fontSize: "24px", fontWeight: "700" }}>ওটিপি কোড ভেরিফাই</h2>
            <p style={{ margin: "0", color: "#22c55e", fontSize: "14px", fontWeight: "500" }}>{success}</p>
          </div>

          <form onSubmit={handleOtpVerify}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", color: "#cbd5e1", textAlign: "center" }}>আপনার হোয়াটসঅ্যাপে পাঠানো ৬ ডিজিটের কোডটি দিন</label>
              <input
                type="text"
                placeholder="কোডটি এখানে লিখুন"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                required
                maxLength="6"
                style={{ width: "100%", padding: "14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "20px", letterSpacing: "8px", textAlign: "center", boxSizing: "border-box" }}
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", backgroundColor: "#38bdf8", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
              {loading ? "যাচাই করা হচ্ছে..." : "কোড ভেরিফাই করুন ✓"}
            </button>
          </form>

          {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
        </div>
      )}

      {/* পাসওয়ার্ড ভুলে যাওয়ার স্ক্রিন */}
      {currentScreen === "forgot" && (
        <div style={{ maxWidth: "450px", width: "100%", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "32px", borderRadius: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "40px" }}>🔍</span>
            <h2 style={{ margin: "12px 0 6px 0", fontSize: "24px", fontWeight: "700" }}>পাসওয়ার্ড রিসেট</h2>
            <p style={{ margin: "0", color: "#94a3b8", fontSize: "14px" }}>আপনার নিবন্ধিত হোয়াটসঅ্যাপ নম্বরে আমরা পাসওয়ার্ড পরিবর্তন কোড পাঠাবো।</p>
          </div>

          <form onSubmit={handleForgotPassword}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>আপনার মোবাইল নম্বর</label>
              <input
                type="text"
                placeholder="যেমন: 017XXXXXXXX"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", backgroundColor: "#e11d48", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "600", cursor: "pointer", marginBottom: "16px" }}>
              {loading ? "কোড পাঠানো হচ্ছে..." : "রিসেট কোড পাঠান 💬"}
            </button>

            <div style={{ textAlign: "center" }}>
              <button type="button" onClick={() => setCurrentScreen("login")} style={{ color: "#38bdf8", background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}>লগইন পেজে ফিরে যান</button>
            </div>
          </form>

          {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
        </div>
      )}

      {/* নতুন পাসওয়ার্ড সেট করার স্ক্রিন */}
      {currentScreen === "reset_password" && (
        <div style={{ maxWidth: "450px", width: "100%", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "32px", borderRadius: "24px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <span style={{ fontSize: "40px" }}>🔑</span>
            <h2 style={{ margin: "12px 0 6px 0", fontSize: "24px", fontWeight: "700" }}>নতুন পাসওয়ার্ড দিন</h2>
            <p style={{ margin: "0", color: "#94a3b8", fontSize: "14px" }}>আপনার অ্যাকাউন্টের জন্য একটি নতুন পাসওয়ার্ড সেট করুন।</p>
          </div>

          <form onSubmit={handlePasswordReset}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষরের)</label>
              <input
                type="password"
                placeholder="নতুন পাসওয়ার্ড লিখুন"
                value={resetPasswordInput}
                onChange={(e) => setResetPasswordInput(e.target.value)}
                required
                style={{ width: "100%", padding: "12px 14px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
              />
            </div>

            <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: "600", cursor: "pointer" }}>
              {loading ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড নিশ্চিত করুন ✓"}
            </button>
          </form>

          {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
        </div>
      )}

      {/* প্রধান ড্যাশবোর্ড ও হিস্টোরি স্ক্রিন */}
      {currentScreen === "dashboard" && (
        <div style={{ maxWidth: "900px", width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* ড্যাশবোর্ড হেডার */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "16px 24px", borderRadius: "20px", border: "1px solid rgba(255, 255, 255, 0.1)", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "28px" }}>🚀</span>
              <div>
                <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "700" }}>আমার কন্ট্রোল প্যানেল</h3>
                <p style={{ margin: "0", color: "#94a3b8", fontSize: "12px" }}>মোবাইল আইডি: {userPhone}</p>
              </div>
            </div>
            <button onClick={handleLogout} style={{ padding: "8px 16px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
              লগআউট করুন 🚪
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
            
            {/* লিংক শর্ট করার ফর্ম */}
            <div style={{ background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "28px", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>🔗 কাস্টম লিংক তৈরি করুন</h3>
              
              <form onSubmit={handleCreateShortLink}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>বড় লিংকটি দিন</label>
                    <input
                      type="url"
                      placeholder="https://example.com/very-long-link..."
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      required
                      style={{ width: "100%", padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
                    />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>কাস্টম নাম (ঐচ্ছিক)</label>
                      <input
                        type="text"
                        placeholder="facebook-link"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        style={{ width: "100%", padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#cbd5e1" }}>মনে রাখার জন্য কাস্টম ট্যাগ/নোট</label>
                      <input
                        type="text"
                        placeholder="যেমন: আমার ফেসবুক আইডি"
                        value={linkNote}
                        onChange={(e) => setLinkNote(e.target.value)}
                        style={{ width: "100%", padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.6)", border: "1px solid #334155", borderRadius: "10px", color: "white", fontSize: "15px", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                </div>

                <button type="submit" disabled={loading} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)", color: "white", border: "none", borderRadius: "12px", fontSize: "16px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
                  {loading ? "তৈরি হচ্ছে..." : "লিংক ছোট করুন ✨"}
                </button>
              </form>

              {shortUrl && (
                <div style={{ marginTop: "24px", padding: "16px", backgroundColor: "rgba(14, 165, 233, 0.12)", border: "1px solid rgba(14, 165, 233, 0.2)", borderRadius: "14px" }}>
                  <p style={{ margin: "0 0 8px 0", color: "#38bdf8", fontWeight: "600", fontSize: "14px" }}>🎉 ছোট লিংক তৈরি হয়েছে:</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(15, 23, 42, 0.4)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                    <a href={shortUrl} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", color: "#f8fafc", fontWeight: "500", fontSize: "14px", flex: "1", textDecoration: "none" }}>{shortUrl}</a>
                    <button onClick={() => copyToClipboard(shortUrl)} style={{ padding: "8px 14px", backgroundColor: copied ? "#22c55e" : "#334155", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }}>
                      {copied ? "কপি হয়েছে! ✓" : "কপি করুন"}
                    </button>
                  </div>
                </div>
              )}

              {error && <div style={{ marginTop: "16px", padding: "10px", backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: "8px", color: "#fca5a5", fontSize: "14px", textAlign: "center" }}>⚠️ {error}</div>}
            </div>

            {/* আমার লিংক হিস্টোরি */}
            <div style={{ background: "rgba(30, 41, 59, 0.7)", backdropFilter: "blur(16px)", padding: "28px", borderRadius: "24px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ margin: "0", fontSize: "20px", fontWeight: "700" }}>📋 আমার সব ছোট লিংক ({userLinks.length} টি)</h3>
                <button onClick={() => fetchUserLinks(userPhone)} style={{ fontSize: "13px", padding: "6px 12px", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cbd5e1", borderRadius: "8px", cursor: "pointer" }}>রিফ্রেশ করুন 🔄</button>
              </div>

              {userLinks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <span style={{ fontSize: "40px" }}>📂</span>
                  <p style={{ marginTop: "12px", fontSize: "15px" }}>আপনার তৈরি করা কোনো ছোট লিংক পাওয়া যায়নি। উপরে নতুন লিংক তৈরি করুন!</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {userLinks.map((link) => (
                    <div key={link.id} style={{ backgroundColor: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        
                        {/* ট্যাগ বা কাস্টম নোট ও শর্ট লিংক */}
                        <div style={{ flex: "1" }}>
                          {editingNoteId === link.id ? (
                            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                              <input
                                type="text"
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                style={{ padding: "4px 8px", backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid #38bdf8", borderRadius: "6px", color: "white", fontSize: "13px" }}
                              />
                              <button onClick={() => handleUpdateNote(link.id)} style={{ padding: "4px 8px", backgroundColor: "#22c55e", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>সেভ</button>
                              <button onClick={() => setEditingNoteId(null)} style={{ padding: "4px 8px", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}>বাতিল</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                              <span style={{ backgroundColor: "rgba(56, 189, 248, 0.15)", color: "#38bdf8", padding: "3px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "600" }}>
                                📌 {link.title || "কাস্টম লিংক"}
                              </span>
                              <button onClick={() => { setEditingNoteId(link.id); setTempNoteText(link.title || ""); }} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>এডিট করুন ✏️</button>
                            </div>
                          )}

                          {/* ছোট লিংক */}
                          <a href={`${window.location.origin}/${link.id}`} target="_blank" rel="noreferrer" style={{ color: "#38bdf8", fontWeight: "700", textDecoration: "none", fontSize: "15px", wordBreak: "break-all" }}>
                            {window.location.origin}/{link.id}
                          </a>
                        </div>

                        {/* অ্যাকশন বাটনসমূহ */}
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button onClick={() => copyToClipboard(`${window.location.origin}/${link.id}`)} style={{ padding: "6px 12px", backgroundColor: "#334155", color: "white", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>কপি</button>
                          <button onClick={() => handleDeleteLink(link.id)} style={{ padding: "6px 12px", backgroundColor: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "8px", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}>ডিলিট 🗑️</button>
                        </div>
                      </div>

                      {/* আসল বড় লিংক */}
                      <div style={{ fontSize: "12px", color: "#94a3b8", wordBreak: "break-all", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "8px" }}>
                        🔗 <strong>আসল লিংক:</strong> {link.originalUrl}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}