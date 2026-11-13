import { type FormEvent, useEffect, useRef, useState } from "react"
import gsap from "gsap"

type Mode = "signup" | "login"

function FilmIllustration() {
    return (
        <div className="auth-art" aria-hidden="true">
            <div className="auth-art-grid" />
            <div className="art-sun" />
            <div className="art-ring art-ring-one" />
            <div className="art-ring art-ring-two" />
            <div className="film-strip film-strip-one"><i /><i /><i /><i /><i /></div>
            <div className="film-strip film-strip-two"><i /><i /><i /><i /><i /></div>
            <div className="camera-shape"><span className="camera-lens" /><span className="camera-top" /><span className="camera-leg camera-leg-one" /><span className="camera-leg camera-leg-two" /></div>
            <div className="popcorn-bowl"><span className="popcorn popcorn-one" /><span className="popcorn popcorn-two" /><span className="popcorn popcorn-three" /><span className="bowl" /></div>
            <div className="art-copy"><span className="art-kicker">a little space</span><strong>for your<br /><em>next story.</em></strong><span className="art-note">watch · share · remember</span></div>
            <div className="art-star star-one">✦</div><div className="art-star star-two">✦</div><div className="art-star star-three">✧</div>
        </div>
    )
}

export default function AuthScreen() {
    const [mode, setMode] = useState<Mode>("signup")
    const [submitted, setSubmitted] = useState(false)
    const formRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        gsap.fromTo(".auth-art > *", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .75, stagger: .06, ease: "power3.out" })
        gsap.fromTo(".auth-form-panel > *", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: .65, stagger: .08, ease: "power3.out", delay: .2 })
        gsap.to(".art-ring-one", { rotate: 360, duration: 28, repeat: -1, ease: "none" })
        gsap.to(".art-ring-two", { rotate: -360, duration: 35, repeat: -1, ease: "none" })
    }, [])

    const switchMode = (nextMode: Mode) => {
        if (nextMode === mode) return
        setSubmitted(false)
        gsap.to(formRef.current, { opacity: 0, x: nextMode === "login" ? 18 : -18, duration: .18, onComplete: () => {
            setMode(nextMode)
            gsap.fromTo(formRef.current, { opacity: 0, x: nextMode === "login" ? -18 : 18 }, { opacity: 1, x: 0, duration: .35, ease: "power2.out" })
        } })
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSubmitted(true)
    }

    return (
        <main className={`auth-screen ${mode}`}>
            <section className="auth-shell">
                <FilmIllustration />
                <div className="auth-form-panel" ref={formRef}>
                    <header className="auth-header"><a className="auth-brand" href="#top">lumen<span>+</span></a><span className="auth-issue">private beta · 01</span></header>
                    <div className="auth-content">
                        <div className="auth-tabs" role="tablist" aria-label="Authentication mode"><button className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")} role="tab" aria-selected={mode === "signup"}>Create account</button><button className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")} role="tab" aria-selected={mode === "login"}>Sign in</button></div>
                        {submitted ? <div className="auth-success"><div className="success-mark">✦</div><p className="auth-eyebrow">you’re on the list</p><h1>Welcome<br /><em>inside.</em></h1><p className="auth-description">Your private little cinema is ready. We’ll take you there soon.</p><button className="text-button" onClick={() => setSubmitted(false)}>back to the form <span>↗</span></button></div> : <form onSubmit={submit}>
                            <p className="auth-eyebrow">{mode === "signup" ? "hello, friend" : "welcome back"}</p>
                            <h1>{mode === "signup" ? <>Make room<br /><em>for wonder.</em></> : <>Good to see<br /><em>you again.</em></>}</h1>
                            <p className="auth-description">{mode === "signup" ? "Save the moments worth replaying, and share them with the people who make them matter." : "Sign in to return to your saved stories, private screenings, and favorite frames."}</p>
                            {mode === "signup" && <label>your name<input name="name" autoComplete="name" placeholder="What should we call you?" required /></label>}
                            <label>email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></label>
                            <label>password<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="••••••••" required /></label>
                            {mode === "login" && <a className="forgot" href="#forgot">forgot your password?</a>}
                            <button className="primary-button" type="submit">{mode === "signup" ? "Start my story" : "Take me in"}<span>↗</span></button>
                            <div className="auth-divider"><span>or continue with</span></div><div className="socials"><button type="button" aria-label="Continue with Google">G</button><button type="button" aria-label="Continue with Apple">●</button><button type="button" aria-label="Continue with email">@</button></div>
                        </form>}
                    </div>
                    <footer className="auth-footer"><span>made for the soft-hearted</span><span>© 2026 lumen</span></footer>
                </div>
            </section>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&display=swap');
                :root { --ink:#302029; --muted:#9b7d88; --pink:#f25683; --magenta:#c52e71; --cream:#fffaf4; --lilac:#ddd2ff; }
                * { box-sizing:border-box; } body { margin:0; background:#f6eef0; color:var(--ink); font-family:'Manrope',sans-serif; } button,input { font:inherit; } button,a { -webkit-tap-highlight-color:transparent; }
                .auth-screen { min-height:100vh; padding:clamp(18px,4vw,60px); display:grid; place-items:center; overflow:hidden; background:radial-gradient(circle at 12% 90%,#ffd9dc 0,transparent 32%),#f8f1f1; }.auth-shell { width:min(1240px,100%); min-height:min(780px,calc(100vh - 80px)); display:grid; grid-template-columns:1.03fr .97fr; overflow:hidden; border-radius:26px; background:var(--cream); box-shadow:0 28px 90px rgba(105,39,77,.16); }
                .auth-art { position:relative; overflow:hidden; min-height:650px; background:linear-gradient(140deg,#b52978,#e63f7f 49%,#f98e73); color:#fff8f3; }.auth-art:before { content:''; position:absolute; width:82%; aspect-ratio:1; left:-20%; bottom:-35%; border-radius:45% 55% 50% 50%; background:#7f2378; opacity:.45; }.auth-art:after { content:''; position:absolute; width:100%; height:100%; background:radial-gradient(circle at 72% 22%,#ffd969 0 7%,transparent 7.3%),radial-gradient(circle at 80% 79%,#61d3cb 0 5%,transparent 5.3%); opacity:.9; }.auth-art-grid { position:absolute; inset:0; opacity:.12; background:linear-gradient(90deg,transparent 49%,#fff 50%,transparent 51%),linear-gradient(0deg,transparent 49%,#fff 50%,transparent 51%); background-size:72px 72px; transform:rotate(13deg) scale(1.35); }.art-sun { position:absolute; width:330px; aspect-ratio:1; border-radius:50%; top:15%; right:8%; background:#ffd76b; box-shadow:0 0 0 22px rgba(255,215,107,.12),0 0 0 44px rgba(255,215,107,.08); }.art-ring { position:absolute; border:1px solid rgba(255,255,255,.55); border-radius:50%; transform:skewY(-16deg) rotate(22deg); }.art-ring-one { width:460px; height:270px; top:20%; left:15%; }.art-ring-two { width:390px; height:230px; top:28%; left:22%; border-color:rgba(255,255,255,.28); }.film-strip { position:absolute; z-index:2; width:280px; height:53px; padding:7px 5px; display:flex; gap:7px; background:#261b36; box-shadow:0 12px 20px rgba(59,19,66,.24); }.film-strip i { flex:1; background:#f5798d; border:1px solid rgba(255,255,255,.24); }.film-strip-one { top:27%; left:6%; transform:rotate(-18deg); }.film-strip-two { right:-5%; bottom:24%; transform:rotate(18deg); background:#492257; }.film-strip-two i { background:#f1ad70; }.camera-shape { position:absolute; z-index:3; width:230px; height:145px; right:14%; bottom:20%; border-radius:19px; transform:rotate(-9deg); background:#f8cda3; box-shadow:13px 15px 0 rgba(123,36,91,.23); }.camera-lens { position:absolute; width:92px; height:92px; border-radius:50%; left:63px; top:27px; border:18px solid #5f2669; background:#73c6c4; box-shadow:inset 0 0 0 13px #f7a4a5; }.camera-top { position:absolute; width:70px; height:22px; top:-20px; left:36px; background:#f8cda3; border-radius:10px 10px 0 0; }.camera-leg { position:absolute; width:12px; height:100px; bottom:-82px; background:#5f2669; }.camera-leg-one { left:55px; transform:rotate(16deg); }.camera-leg-two { right:55px; transform:rotate(-16deg); }.popcorn-bowl { position:absolute; z-index:4; bottom:7%; left:10%; width:105px; height:100px; }.bowl { position:absolute; bottom:0; width:100%; height:59px; border-radius:8px 8px 44px 44px; background:#f2d46f; border:8px solid #fff5c7; border-top:0; transform:perspective(50px) rotateX(-9deg); }.popcorn { position:absolute; z-index:1; width:37px; height:37px; border-radius:50%; background:#fff8d5; box-shadow:inset -7px -5px 0 #f3d873; }.popcorn-one { left:12px; top:10px; }.popcorn-two { left:39px; top:0; }.popcorn-three { right:7px; top:13px; }.art-copy { position:absolute; z-index:5; top:11%; left:10%; }.art-kicker,.art-note { display:block; font:10px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.13em; }.art-copy strong { display:block; margin-top:22px; font:600 clamp(49px,6vw,86px)/.83 'Fraunces',serif; letter-spacing:-.07em; }.art-copy em { color:#ffd76b; font-style:italic; }.art-note { margin-top:25px; opacity:.8; }.art-star { position:absolute; z-index:5; font-size:28px; color:#ffd76b; }.star-one { top:15%; right:20%; }.star-two { left:52%; bottom:14%; color:#73d5ca; }.star-three { top:44%; left:9%; font-size:18px; }
                .auth-form-panel { min-width:0; display:flex; flex-direction:column; background:#fffdf9; }.auth-header { display:flex; justify-content:space-between; align-items:center; padding:28px 38px; border-bottom:1px solid #f0e6e5; }.auth-brand { color:var(--ink); font:800 22px 'Manrope',sans-serif; letter-spacing:-.08em; text-decoration:none; }.auth-brand span { color:var(--pink); padding-left:2px; }.auth-issue { color:#b59ca4; font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }.auth-content { width:min(395px,100%); margin:auto; padding:50px 28px 60px; }.auth-tabs { display:flex; gap:25px; margin-bottom:45px; border-bottom:1px solid #f0e6e5; }.auth-tabs button { position:relative; border:0; background:none; color:#b8a3a7; padding:0 0 14px; cursor:pointer; font-size:12px; }.auth-tabs button.active { color:var(--ink); font-weight:700; }.auth-tabs button.active:after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:2px; background:var(--pink); }.auth-eyebrow { margin:0 0 16px; color:var(--pink); font:10px 'DM Mono',monospace; letter-spacing:.14em; text-transform:uppercase; }.auth-content h1 { margin:0; color:var(--ink); font:600 clamp(47px,5vw,67px)/.87 'Fraunces',serif; letter-spacing:-.07em; }.auth-content h1 em { color:var(--pink); font-style:italic; }.auth-description { max-width:330px; margin:24px 0 30px; color:var(--muted); font-size:12px; line-height:1.75; }.auth-content label { display:block; margin-top:19px; color:#927b83; font:9px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.12em; }.auth-content input { display:block; width:100%; padding:11px 0 9px; border:0; border-bottom:1px solid #e6d9dc; outline:0; color:var(--ink); background:transparent; font:14px 'Manrope',sans-serif; }.auth-content input:focus { border-color:var(--pink); }.forgot { display:block; margin-top:17px; color:var(--pink); font-size:10px; text-decoration:none; }.primary-button { display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:30px; padding:16px 17px; border:1px solid var(--pink); border-radius:3px; background:var(--pink); color:#fff; cursor:pointer; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; transition:.25s; }.primary-button:hover { background:var(--magenta); border-color:var(--magenta); transform:translateY(-2px); }.primary-button span { font-size:18px; }.auth-divider { display:flex; align-items:center; gap:12px; margin:28px 0 18px; color:#bca7ac; font:9px 'DM Mono',monospace; text-transform:uppercase; }.auth-divider:before,.auth-divider:after { content:''; flex:1; height:1px; background:#eee3e3; }.socials { display:flex; justify-content:center; gap:10px; }.socials button { width:36px; height:36px; border:1px solid #e7dadd; border-radius:50%; color:#785f6a; background:#fff; cursor:pointer; font-weight:700; }.socials button:hover { color:var(--pink); border-color:var(--pink); }.auth-footer { display:flex; justify-content:space-between; padding:21px 38px; border-top:1px solid #f0e6e5; color:#b5a2a7; font:8px 'DM Mono',monospace; text-transform:uppercase; letter-spacing:.1em; }.auth-success { padding-top:25px; }.success-mark { color:var(--pink); font-size:42px; margin-bottom:15px; }.text-button { border:0; border-bottom:1px solid var(--pink); color:var(--pink); background:none; padding:7px 0; cursor:pointer; font:10px 'DM Mono',monospace; text-transform:uppercase; }.text-button span { margin-left:18px; }
                @media (max-width:800px) { .auth-screen { padding:0; place-items:stretch; }.auth-shell { min-height:100vh; border-radius:0; display:flex; flex-direction:column; }.auth-art { min-height:360px; flex:0 0 360px; }.art-sun { width:230px; right:5%; top:8%; }.art-copy { top:12%; left:8%; }.art-copy strong { font-size:58px; }.camera-shape { transform:scale(.7) rotate(-9deg); right:3%; bottom:4%; }.popcorn-bowl { transform:scale(.75); left:3%; bottom:2%; }.film-strip-one { top:47%; left:-7%; }.film-strip-two { bottom:10%; right:-13%; }.auth-form-panel { flex:1; }.auth-header { padding:22px 24px; }.auth-content { padding:39px 25px 48px; margin:0 auto; width:min(430px,100%); }.auth-footer { padding:18px 24px; } }
            `}</style>
        </main>
    )
}
